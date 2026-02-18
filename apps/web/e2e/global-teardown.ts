/**
 * Playwright global teardown — disconnects the DB pool.
 */

import { disconnectDb } from "./helpers/db";

export default async function globalTeardown() {
  await disconnectDb();
}
