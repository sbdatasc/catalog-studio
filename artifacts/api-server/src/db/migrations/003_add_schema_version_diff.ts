import type pg from "pg";

/**
 * Migration 003 — Add diff, entry_count, and catalog_id columns to schema_versions (D-04).
 * - catalog_id: links each schema version to its catalog
 * - diff: JSONB storing the structural diff between this version and the previous one
 * - entry_count: number of catalog entries at time of publish
 *
 * NEVER EDIT THIS FILE once it has been applied to any database.
 */
export async function up(client: pg.PoolClient): Promise<void> {
  await client.query(`
    BEGIN;

    ALTER TABLE schema_versions
      ADD COLUMN IF NOT EXISTS catalog_id UUID REFERENCES catalogs(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS diff JSONB NULL,
      ADD COLUMN IF NOT EXISTS entry_count INTEGER NOT NULL DEFAULT 0;

    INSERT INTO db_migrations (version) VALUES (3);

    COMMIT;
  `);
}
