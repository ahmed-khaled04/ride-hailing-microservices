/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.createExtension("pgcrypto", { ifNotExists: true });

  pgm.createTable("trips", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    rider_id: {
      type: "uuid",
      notNull: true,
    },
    driver_id: {
      type: "uuid",
    },
    status: {
      type: "text",
      notNull: true,
      default: "requested",
      check:
        "status IN ('requested', 'offer_pending', 'matched', 'driver_en_route', 'in_progress', 'completed', 'cancelled')",
    },
    origin_lat: {
      type: "double precision",
      notNull: true,
    },
    origin_lng: {
      type: "double precision",
      notNull: true,
    },
    dest_lat: {
      type: "double precision",
      notNull: true,
    },
    dest_lng: {
      type: "double precision",
      notNull: true,
    },
    cancelled_by: {
      type: "uuid",
    },
    cancellation_reason: {
      type: "text",
    },
    requested_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
    matched_at: {
      type: "timestamptz",
    },
    completed_at: {
      type: "timestamptz",
    },
    cancelled_at: {
      type: "timestamptz",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable("trips");
};
