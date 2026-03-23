import type pg from "pg";
import { logger } from "../lib/logger";
import { up as migration001 } from "./migrations/001_initial";
import { up as migration002 } from "./migrations/002_add_node_positions";
import { up as migration003 } from "./migrations/003_add_schema_version_diff";
import { up as migration004 } from "./migrations/004_add_users_and_refresh_tokens";

interface MigrationFile {
  version: number;
  up: (client: pg.PoolClient) => Promise<void>;
}

const MIGRATIONS: MigrationFile[] = [
  { version: 1, up: migration001 },
  { version: 2, up: migration002 },
  { version: 3, up: migration003 },
  { version: 4, up: migration004 },
];

/**
 * Runs all pending migrations against the database.
 * Forward-only: each migration runs once, is transaction-wrapped, and halts the process on failure.
 */
export async function runMigrations(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();

  try {
    // Ensure the tracking table exists (idempotent — uses IF NOT EXISTS)
    await client.query(`
      CREATE TABLE IF NOT EXISTS db_migrations (
        version    INTEGER PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query<{ version: number }>(
      "SELECT version FROM db_migrations ORDER BY version DESC LIMIT 1",
    );

    const currentVersion = rows[0]?.version ?? 0;
    const pending = MIGRATIONS.filter((m) => m.version > currentVersion);

    if (pending.length === 0) {
      logger.info({ currentVersion }, "Database schema is up-to-date");
      return;
    }

    for (const migration of pending) {
      logger.info({ version: migration.version }, "Running migration");
      try {
        await migration.up(client);
        logger.info({ version: migration.version }, "Migration applied successfully");
      } catch (err) {
        logger.error({ version: migration.version, err }, "Migration failed — halting");
        throw err;
      }
    }
  } finally {
    client.release();
  }
}
