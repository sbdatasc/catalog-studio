import type pg from "pg";

/**
 * Migration 002 — Add catalog_node_positions table (D-03 Relationship Graph Builder).
 * Stores per-catalog canvas layout x/y positions for template nodes.
 * UNIQUE(catalog_id, template_id) — one position row per template per catalog.
 *
 * NEVER EDIT THIS FILE once it has been applied to any database.
 */
export async function up(client: pg.PoolClient): Promise<void> {
  await client.query(`
    BEGIN;

    CREATE TABLE IF NOT EXISTS catalog_node_positions (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      catalog_id  UUID         NOT NULL REFERENCES catalogs(id) ON DELETE CASCADE,
      template_id UUID         NOT NULL,
      x           DECIMAL(10,2) NOT NULL,
      y           DECIMAL(10,2) NOT NULL,
      updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
      CONSTRAINT catalog_node_positions_catalog_template_unique
        UNIQUE (catalog_id, template_id)
    );

    INSERT INTO db_migrations (version) VALUES (2);

    COMMIT;
  `);
}
