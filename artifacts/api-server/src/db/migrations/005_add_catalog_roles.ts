import type pg from "pg";

/**
 * Migration 005 — Add catalog_roles table (A-04).
 * - catalog_roles: maps (catalog_id, user_id) → catalog_role with assigner tracking
 * - UNIQUE(catalog_id, user_id) — one role per user per catalog
 * - createCatalog() inserts creator as catalog_admin in the same transaction
 *
 * NEVER EDIT THIS FILE once it has been applied to any database.
 */
export async function up(client: pg.PoolClient): Promise<void> {
  await client.query(`
    BEGIN;

    CREATE TABLE IF NOT EXISTS catalog_roles (
      id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      catalog_id   UUID         NOT NULL REFERENCES catalogs(id) ON DELETE CASCADE,
      user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      catalog_role VARCHAR(20)  NOT NULL,
      assigned_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
      assigned_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
      UNIQUE (catalog_id, user_id)
    );

    INSERT INTO db_migrations (version) VALUES (5);

    COMMIT;
  `);
}
