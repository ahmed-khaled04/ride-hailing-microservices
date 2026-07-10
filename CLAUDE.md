# Ride-Hailing Microservices — Project Guide

## What this is

A from-scratch learning/demo project: a mini ride-hailing backend (rider requests a trip, gets matched to a nearby driver, tracks them live, gets notified through state changes), built as 6 independent Node.js/TypeScript microservices. The point isn't a polished product — it's deliberate practice with distributed-systems problems: event-driven state machines, Redis geospatial queries, WebSocket streaming, and above all **correct concurrent matching** (never double-assign a driver to two riders at once).

## Status

Architecture and requirements planning is complete. **No code has been written yet.** Next step is Docker Compose skeleton (see Build Order below).

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

1. Docker Compose skeleton + Postgres/Redis wiring + health-checked empty services *(next up)*
2. Auth service + Gateway JWT verification
3. Trip service (schema, state machine, REST, `trip.requested` producer)
4. Shared Redis Streams event-bus helper package
5. Matching service (GEOSEARCH + Lua-script pending-offer claim + retry logic)
6. Location service (WS ingestion, geo updates, position streaming)
7. Notification service (Socket.IO rooms + event relay)
8. React + Leaflet demo wired end-to-end
9. Race-condition test: fire many concurrent `trip.requested` events at the same driver pool, confirm no driver is ever double-offered/double-matched

## Open Question

Whether the offer TTL sweep is driven by Redis key-expiry + keyspace notifications, or a polling sweep in the Matching service — decide when implementing that service.

---

## Maintenance Instruction

**Always update this file automatically after any significant change** — a new service scaffolded, an architecture/schema decision changed, a build-order step completed, a new event/endpoint added, etc. Don't wait to be asked. Keep this document in sync with reality so the next session can pick up context cold.
