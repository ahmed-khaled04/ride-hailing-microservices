import os from "os";
import { consumeEvent, publishEvents } from "event-bus";

import { pool } from "../db";

async function emitStateChanged(
  tripId: string,
  from: string,
  to: string,
  riderId: string,
  driverId: string | null,
) {
  await publishEvents("trip.state_changed", {
    tripId,
    from,
    to,
    changedAt: new Date().toISOString(),
    riderId,
    driverId,
  });
}

async function handleOfferCreated(tripId: string) {
  const result = await pool.query(
    `UPDATE trips SET status = 'offer_pending'
     WHERE id = $1 AND status = 'requested'
     RETURNING status, rider_id, driver_id`,
    [tripId],
  );
  if (result.rows.length > 0) {
    const row = result.rows[0];
    await emitStateChanged(
      tripId,
      "requested",
      "offer_pending",
      row.rider_id,
      row.driver_id,
    );
  }
}

async function handleMatched(tripId: string, driverId: string) {
  const before = await pool.query(
    "SELECT status, rider_id FROM trips WHERE id = $1",
    [tripId],
  );
  if (before.rows.length === 0) return;
  const from = before.rows[0].status;
  const riderId = before.rows[0].rider_id;

  let result = await pool.query(
    `UPDATE trips SET status = 'matched', driver_id = $2, matched_at = now()
     WHERE id = $1 AND status IN ('requested', 'offer_pending')
     RETURNING status`,
    [tripId, driverId],
  );
  if (result.rows.length > 0) {
    await emitStateChanged(tripId, from, "matched", riderId, driverId);
  }

  result = await pool.query(
    `UPDATE trips SET status = 'driver_en_route'
     WHERE id = $1 AND status = 'matched'
     RETURNING status`,
    [tripId],
  );
  if (result.rows.length > 0) {
    await emitStateChanged(
      tripId,
      "matched",
      "driver_en_route",
      riderId,
      driverId,
    );
  }
}

async function handleNoDriversAvailable(tripId: string) {
  const before = await pool.query(
    "SELECT status, rider_id FROM trips WHERE id = $1",
    [tripId],
  );
  if (before.rows.length === 0) return;
  const from = before.rows[0].status;
  const riderId = before.rows[0].rider_id;
  if (from !== "requested" && from !== "offer_pending") return;

  const result = await pool.query(
    `UPDATE trips SET status = 'requested'
     WHERE id = $1 AND status IN ('requested', 'offer_pending')
     RETURNING status`,
    [tripId],
  );
  if (result.rows.length > 0 && from !== "requested") {
    await emitStateChanged(tripId, from, "requested", riderId, null);
  }
}

export function startTripEventsConsumer() {
  consumeEvent("trip-service", `trip-${os.hostname()}`, async (event) => {
    switch (event.type) {
      case "trip.offer.created":
        await handleOfferCreated(event.data.tripId as string);
        break;
      case "trip.matched":
        await handleMatched(
          event.data.tripId as string,
          event.data.driverId as string,
        );
        break;
      case "trip.no_drivers_available":
        await handleNoDriversAvailable(event.data.tripId as string);
        break;
      default:
        break;
    }
  });
}
