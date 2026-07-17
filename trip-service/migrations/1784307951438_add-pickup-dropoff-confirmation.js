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
  pgm.addColumn("trips", {
    driver_pickup_confirmed_at: { type: "timestamptz" },
    rider_pickup_confirmed_at: { type: "timestamptz" },
    driver_dropoff_confirmed_at: { type: "timestamptz" },
    rider_dropoff_confirmed_at: { type: "timestamptz" },
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropColumn("trips", [
    "driver_pickup_confirmed_at",
    "rider_pickup_confirmed_at",
    "driver_dropoff_confirmed_at",
    "rider_dropoff_confirmed_at",
  ]);
};
