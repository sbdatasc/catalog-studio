import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@workspace/db";
import { logger } from "../lib/logger";
import { runMigrations } from "./migrate";
import { seedIfRequired } from "./seed";

const { Pool } = pg;

type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

let _db: DbInstance | null = null;
let _pool: InstanceType<typeof Pool> | null = null;

/**
 * Returns the initialised Drizzle DB instance.
 * Throws if openDatabase() has not been called yet.
 * Import this in every service function — never pass db as a parameter.
 */
export function getDb(): DbInstance {
  if (!_db) {
    throw new Error(
      "Database not initialised. Call openDatabase() before accessing getDb().",
    );
  }
  return _db;
}

/**
 * Opens the database connection, runs pending migrations, and seeds if required.
 * Must be called once before app.listen(). Calling it a second time is a no-op.
 */
export async function openDatabase(): Promise<void> {
  if (_db) {
    logger.warn("openDatabase() called more than once — ignoring duplicate call");
    return;
  }

  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required.");
  }

  _pool = new Pool({ connectionString });
  _db = drizzle(_pool, { schema });

  await runMigrations(_pool);
  await seedIfRequired(_db);
}

/**
 * Closes the database connection gracefully.
 * Call on process shutdown (SIGTERM / SIGINT).
 */
export async function closeDatabase(): Promise<void> {
  await _pool?.end();
  _pool = null;
  _db = null;
}
