# Ride-Hailing Microservices — Project Guide

## What this is

A from-scratch learning/demo project: a mini ride-hailing backend (rider requests a trip, gets matched to a nearby driver, tracks them live, gets notified through state changes), built as 6 independent Node.js/TypeScript microservices. The point isn't a polished product — it's deliberate practice with distributed-systems problems: event-driven state machines, Redis geospatial queries, WebSocket streaming, and above all **correct concurrent matching** (never double-assign a driver to two riders at once).

## Status

Step 1 (Docker Compose skeleton) is done and verified: `docker compose up --build` brings up all 8 containers (postgres, redis, gateway, auth-service, trip-service, matching-service, location-service, notification-service), each Node service is a bare Express stub exposing `GET /health`, and all healthchecks pass.

Step 2 (Auth service + Gateway JWT verification) is done and verified end-to-end.

Auth service: `users` table (`id`, `email` unique, `password`, `name`, `role` check `rider`/`driver`, `created_at`) via `node-pg-migrate` (CommonJS-style migration files — the tool's ESM template default conflicts with this project's `"module": "commonjs"` tsconfig), migrations run automatically on container start (`sh -c "npm run migrate:up && npm run dev"` in docker-compose), `pg` Pool wired via `DATABASE_URL`, `JWT_SECRET` set (same value) on both `auth-service` and `gateway` in docker-compose. `POST /auth/signup` and `POST /auth/login` are both implemented and tested (bcrypt hash/compare, JWT issuance, `23505` unique-violation → clean 409 on signup, generic "Email or password is incorrect" 401 on both bad-email and bad-password login cases to avoid user-enumeration). Request validation is in place via zod schemas (`signupSchema`, `loginSchema`) applied through a reusable `validate(schema)` middleware factory, and a centralized `errorHandler` middleware (last in the Express stack) translates thrown `HttpError`s into proper status codes.

Gateway: `verifyToken` middleware reads `Authorization: Bearer <token>`, verifies via `jwt.verify` with the shared `JWT_SECRET`, and attaches the decoded `{ sub, role }` payload to `req.user` (typed via a global `Express.Request` augmentation in `src/types/express.d.ts`) before calling `next()`; invalid/expired/missing tokens all return a clean `401` through the same `HttpError`/`errorHandler` pattern used in auth-service. `POST/GET /auth/*` is proxied to `auth-service` via `http-proxy-middleware` (`pathRewrite` needed to restore the `/auth` prefix Express strips when a router is mounted with `app.use("/auth", ...)`), left public/unprotected since signup/login happen before a token exists. A temporary `GET /me` route (protected by `verifyToken`, echoes `req.user`) still exists for quick middleware checks. `/trips/*` is now a real protected proxy: `app.use("/trips", verifyToken, tripsProxy)`, where `tripsProxy` (`src/proxy/tripsProxy.ts`) injects `x-user-id`/`x-user-role` headers onto the outgoing request from `req.user` via `http-proxy-middleware`'s `on.proxyReq` hook (v4.2.0 API — `on: { proxyReq: (proxyReq, req) => {...} }`, not the older `onProxyReq` option). Verified end-to-end: signup → login → create a trip through the Gateway, with the DB row's `rider_id` confirmed to match the JWT's `sub` claim.

Step 3 (Trip service) is done and verified end-to-end through the Gateway. `trips` table (`id`, `rider_id`, `driver_id` nullable, `status` check across all 7 state-machine states with default `'requested'`, `origin_lat/lng`, `dest_lat/lng` as `double precision`, `cancelled_by`, `cancellation_reason`, `requested_at`/`matched_at`/`completed_at`/`cancelled_at`, `created_at`) via `node-pg-migrate`, same pattern as auth-service (migrations auto-run on container start).

`POST /trips` reads `rider_id` from the Gateway-forwarded `x-user-id` header (not the request body — trip-service trusts the Gateway's JWT verification rather than re-verifying), rejects with 403 if `x-user-role` is `driver`, validates the body via zod (`createTripSchema`, lat ∈ [-90,90], lng ∈ [-180,180]), inserts, returns `{ tripId, status }`, and publishes `trip.requested` via the event-bus package (see step 4 below) — verified end-to-end: the event lands on `stream:trip-events` with the correct envelope and `data` payload immediately after a successful insert.

`GET /trips/:id` validates `id` as a UUID via a params zod schema (`fetchTripSchema`) run through `validate(schema, "params")` — the `validate` middleware was extended to take a `source: "body" | "params"` argument (defaults to `"body"`, so existing callers are unaffected) and writes parsed output back to `req[source]`. Ownership check (`trip.rider_id !== userId && trip.driver_id !== userId`) returns 404, not 403, for both "doesn't exist" and "exists but isn't yours" — deliberate, to avoid leaking trip existence to non-participants.

`POST /trips/:id/cancel` follows the designed two-step pattern: a `SELECT` first for a clean 404 (missing/not-yours, same 404-for-both rule as above), then the actual state transition via `UPDATE trips SET status = 'cancelled', cancelled_by = $1, cancellation_reason = $2, cancelled_at = now() WHERE id = $3 AND status NOT IN ('in_progress', 'completed', 'cancelled') RETURNING id, status` — the `WHERE ... NOT IN` clause is the real concurrency guard (not the initial `SELECT`), so a trip that transitions to `in_progress`/`completed`/`cancelled` between the two queries fails the `UPDATE` (zero rows) and returns 409 instead of double-cancelling. Optional `reason` in body validated via zod (`CancelTripBodySchema`: trimmed string, 1–500 chars). Verified: happy-path cancel, 409 on re-cancelling an already-cancelled trip, 404 for non-owner, 422 for malformed UUID.

Step 4 (shared Redis Streams event-bus helper package) is done and verified end-to-end. `packages/event-bus` is an npm workspace package (root `package.json` declares `"workspaces": ["packages/*"]`) exposing `publishEvents(type, data)` and `consumeEvent(group, consumerName, handler)` against a single `ioredis` client (`REDIS_URL` env var). `publishEvents` builds the `{ eventId, type, occurredAt, data }` envelope (per the Event Schemas table below) and `XADD`s it to `stream:trip-events` as a single JSON-stringified `payload` field. `consumeEvent` creates its consumer group if missing (`XGROUP CREATE ... MKSTREAM`, swallowing only the expected `BUSYGROUP` error on restart), then loops on `XREADGROUP ... BLOCK 5000 ... ">"`, calling the handler per message and only `XACK`-ing on success — a handler that throws leaves its message pending for future redelivery (no `XCLAIM`/stale-pending sweep yet, deliberately deferred). `TripEvent`'s `data` is currently loosely typed (`Record<string, unknown>`); a discriminated union per event `type` can come later once Matching/Notification are consuming and the concrete shapes are pinned down.

Wiring `trip-service` to depend on `event-bus` required widening its Docker build: `docker-compose.yml`'s `trip-service.build` now uses `context: .` (repo root) with an explicit `dockerfile: trip-service/Dockerfile`, so the image build can see both `package.json`/`packages/event-bus` and `trip-service/` and run a single hoisted `npm install` from the workspace root. Volume mounts shifted accordingly — `./trip-service:/app/trip-service` and `./packages:/app/packages`, with anonymous volumes on both `/app/trip-service/node_modules` and `/app/node_modules` to protect the hoisted install from being clobbered by the bind mounts. Hit the known stale-anonymous-volume gotcha during this change (old `node_modules` from the pre-workspace layout persisted across `up --build`, still missing `event-bus`) — resolved with `docker compose up -d --build -V trip-service`. `dual-write` risk (Postgres insert commits, then `publishEvents` fails) is accepted for now — see build-order step 10.

`matching-service` now follows the same workspace-aware Docker pattern (repo-root build context, `matching-service/Dockerfile`, and matching volume mounts in `docker-compose.yml`) as the second `event-bus` consumer.

Gateway's `tripsProxy` covers both new routes for free, no extra Gateway wiring needed.

Step 5 (Matching service) is in progress. The core concurrency-safe claim + first-offer flow is implemented and verified end-to-end (manually seeded a fake driver via `redis-cli GEOADD`/`SET`, fired a real trip through the Gateway, confirmed `trip.offer.created` landed on the stream with the driver correctly flipped `available → offered`). Built so far: `src/redis.ts` (ioredis client + `claimDriver` custom command registered via `defineCommand`, with a matching `declare module "ioredis"` augmentation so TypeScript knows about it), `src/scripts/claimDriver.lua` (atomic compare-and-swap on `driver:{id}:status` — the actual concurrency guard, no TTL on the status key itself), `src/geo.ts` (`findNearbyDrivers` via `GEOSEARCH`, `driverStatusKey`/`driverOfferKey` builders, `createOffer` which sets `driver:{id}:offer` with a TTL), and `src/matching.ts` (`handleTripRequested`: GEOSEARCH candidates, loop trying `claimDriver` nearest-first until one succeeds, `createOffer` + `trip.offer.created` on success, `trip.no_drivers_available` if every candidate is exhausted — this second event type isn't implemented yet). `src/index.ts` wires `consumeEvent("matching-service", `matching-${os.hostname()}`, ...)` from the event-bus package, with a manual type assertion on `event.data` at the call site (loose `Record<string, unknown>` from the package's current type, tightened here since only `trip.requested` events reach this branch).

Not started yet: `POST /offers/:tripId/accept` and `POST /offers/:tripId/reject` REST endpoints (need a way to look up which driver holds the current offer for a given tripId — `driverOfferKey` is currently keyed by driver, not trip, so this needs either a reverse index or the driver's own ID passed in the request), and the polling sweep for offer-TTL expiry (needs a sorted-set tracking structure, e.g. `ZADD offers:pending <expiryTimestamp> <driverId>` alongside `createOffer`, since a plain Redis TTL'd key gives no way to notice expiry after the fact — see Matching Service Design Notes above).

## Confirmed Stack & Decisions

- **Language**: TypeScript across all services
- **Services**: Auth, Trip, Matching, Location/Tracking, Notification, API Gateway (6 total) + React/Leaflet frontend demo
- **Databases**: Postgres (single container, two logical DBs: `auth_db`, `trip_db`), Redis (geo index + driver state + event bus, single instance, three roles)
- **Event bus**: Redis Streams with consumer groups (not RabbitMQ) — reuses the Redis instance already needed for geo/pub-sub
- **Driver-claim race condition fix**: pending-offer with TTL lock (not instant hard-assign) — a Redis Lua script atomically flips driver status `available → offered`, offer expires via TTL if driver doesn't respond, Matching service retries next-nearest candidate on reject/timeout

## Architecture

```
Rider/Driver clients (React + Leaflet)
        |
        v
   API Gateway  ---- verifies JWT, routes REST, proxies WS upgrade
        |
   -----+-------------------------------------------------
   |         |            |              |               |
 Auth      Trip       Matching      Location/Tracking   Notification
 Service   Service     Service         Service             Service
  |          |  ^          |    ^          |  ^                ^
  Postgres   Postgres      |    |        Redis |                |
  (auth_db)  (trip_db)     |    |     (geo+pos) |                |
                           v    |          |    |                |
                      Redis Streams (event bus) -------------------
                      + Redis (driver status / offer keys, geo set)
```

Happy-path event flow: `trip.requested` → Matching consumes → GEOSEARCH nearby available drivers → creates pending offer on top candidate → `trip.offer.created` → Notification pushes to driver → driver accepts/rejects/times out within TTL → `trip.matched` (or retry next candidate) → Trip service transitions state → Notification pushes to rider/driver → Location service streams driver position → `trip.completed`/`trip.cancelled`.

## Services

1. **Auth** — signup/login, bcrypt, issues JWT (`{ sub, role, iat, exp }`). Owns `auth_db.users`. Only the Gateway calls it directly.
2. **Trip** — source of truth for trip state (`requested → offer_pending → matched → driver_en_route → in_progress → completed`, `cancelled` reachable pre-`in_progress`). Owns `trip_db.trips`. Creates trips via REST, but transitions past `requested` happen only via consumed events.
3. **Matching** — the core hard problem. Consumes `trip.requested`, GEOSEARCH candidates, atomic Lua-script claim (pending-offer + TTL), retry logic on reject/timeout, emits `trip.matched` or `trip.no_drivers_available`. Must be safe to run as multiple concurrent instances.
4. **Location/Tracking** — ingests driver location over WebSocket, writes to Redis (`drivers:geo` + last-position hash), streams position to the rider on any active trip.
5. **Notification** — consumes all `trip.*`/offer events, relays to the right Socket.IO room (keyed by userId). Stateless relay only, never mutates trip/driver state.
6. **API Gateway** — single entry point, JWT verification, REST routing, WS proxy, forwards `x-user-id`/`x-user-role` headers downstream.

## Data Stores

- **Postgres**: `auth_db` (Auth), `trip_db` (Trip) — no cross-service joins, no shared tables.
- **Redis**:
  1. Geo index: `drivers:geo` (GEOADD per driverId)
  2. Driver state: `driver:{id}:status` ∈ `{offline, available, offered, matched}`, `driver:{id}:offer` (TTL = offer timeout)
  3. Event bus: `stream:trip-events`, consumer groups per service (`matching-service`, `trip-service`, `notification-service`)

## Event Schemas (`stream:trip-events`)

Envelope: `{ eventId, type, occurredAt, data }`

| Event | Producer | Data |
|---|---|---|
| `trip.requested` | Trip | `{ tripId, riderId, originLat, originLng, destLat, destLng, requestedAt }` |
| `trip.offer.created` | Matching | `{ tripId, driverId, expiresAt }` |
| `trip.offer.accepted` | Matching | `{ tripId, driverId }` |
| `trip.offer.rejected` | Matching | `{ tripId, driverId, reason: 'declined'\|'timeout' }` |
| `trip.matched` | Matching | `{ tripId, driverId, matchedAt }` |
| `trip.no_drivers_available` | Matching | `{ tripId }` |
| `trip.state_changed` | Trip | `{ tripId, from, to, changedAt }` |
| `trip.cancelled` | Trip | `{ tripId, cancelledBy, reason }` |
| `driver.location_updated` | Location | `{ driverId, lat, lng, heading, ts }` (may use plain Redis pub/sub, not the durable stream) |

## REST API Contracts (via Gateway)

| Method & Path | Service | Notes |
|---|---|---|
| `POST /auth/signup` | Auth | `{ email, password, role }` → `{ token }` |
| `POST /auth/login` | Auth | `{ email, password }` → `{ token }` |
| `POST /trips` | Trip | rider creates trip → `{ tripId, status }` |
| `GET /trips/:id` | Trip | current trip state |
| `POST /trips/:id/cancel` | Trip | rider/driver cancels |
| `POST /offers/:tripId/accept` | Matching | driver accepts current offer |
| `POST /offers/:tripId/reject` | Matching | driver declines current offer |
| `POST /drivers/status` | Location/Matching | driver toggles `available`/`offline` |

WebSocket (Socket.IO via Gateway): client authenticates handshake with JWT, joins room by `userId`; server emits `trip:update`, `offer:new`, `location:update`.

## Docker Compose Layout (planned)

Services: `gateway`, `auth-service`, `trip-service`, `matching-service`, `location-service`, `notification-service`, `postgres`, `redis`, `frontend`. Internal Docker network — only `gateway` and `frontend` publish host ports.

## Build Order

1. ~~Docker Compose skeleton + Postgres/Redis wiring + health-checked empty services~~ — done
2. ~~Auth service + Gateway JWT verification~~ — done
3. ~~Trip service (schema, state machine, REST, `trip.requested` producer)~~ — done (event producer still stubbed, pending step 4)
4. ~~Shared Redis Streams event-bus helper package~~ — done
5. Matching service (GEOSEARCH + Lua-script pending-offer claim + retry logic) *(next up)*
6. Location service (WS ingestion, geo updates, position streaming)
7. Notification service (Socket.IO rooms + event relay)
8. React + Leaflet demo wired end-to-end
9. Race-condition test: fire many concurrent `trip.requested` events at the same driver pool, confirm no driver is ever double-offered/double-matched
10. Transactional outbox pattern for event publishing — Postgres write + event publish are currently two independent operations (dual-write problem: if `publishEvents` throws after the DB insert already committed, the trip exists but is stuck at `requested` with no event ever reaching Matching). Current interim behavior: publish failure propagates to `errorHandler` and returns 500 to the caller, even though the DB row is already committed. Proper fix: write the trip row and an outbox event row in the same transaction, then a background relay process reads unpublished outbox rows and pushes them to Redis, marking them published on success — guarantees at-least-once delivery without silently losing events.
11. Swap the Matching service's offer-TTL sweep from polling to Redis key-expiry + keyspace notifications, once the polling version (built in step 5) is working and verified — see Open Question below.

## Matching Service Design Notes

Core concurrency guard: an atomic Lua script does a compare-and-swap on `driver:{id}:status` (`GET` == expected value → `SET` new value, all in one Redis-atomic script) — this, not any application-level check-then-act logic, is what prevents two Matching instances from both claiming the same driver for two different trips at once.

Candidate selection is re-run via a fresh `GEOSEARCH` on every retry (rather than caching/reusing the original candidate list) — drivers are constantly moving, so a stale candidate list could offer a trip to a driver who's no longer actually nearby.

Offer-TTL expiry is handled via a **polling sweep** (Matching periodically scans for offers past their TTL and triggers a retry with the next-nearest candidate) rather than Redis keyspace notifications — chosen as the simpler starting implementation; swapping to keyspace-notification-driven expiry is deferred to build-order step 11.

Build-order sequencing note: Matching (step 5) is built before Location (step 6), so `drivers:geo` and `driver:{id}:status` won't have any real data from a running service yet while Matching is being built/tested. Test data is seeded manually (`redis-cli GEOADD`/`SET`) against the agreed-upon Redis schema during this phase, rather than reordering the build order.

## Open Question

~~Whether the offer TTL sweep is driven by Redis key-expiry + keyspace notifications, or a polling sweep in the Matching service~~ — decided: polling sweep first (step 5), keyspace notifications later (step 11).

---

## Maintenance Instruction

**Always update this file automatically after any significant change** — a new service scaffolded, an architecture/schema decision changed, a build-order step completed, a new event/endpoint added, etc. Don't wait to be asked. Keep this document in sync with reality so the next session can pick up context cold.
