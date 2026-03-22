import type pg from "pg";

/**
 * Migration 001 — Initial schema.
 * Creates all seven domain tables plus the db_migrations tracking table.
 * Wrapped in a single transaction — any failure rolls back and halts startup.
 *
 * NEVER EDIT THIS FILE once it has been applied to any database.
 * Create a new migration file (002_*.ts) for any structural changes.
 */
export async function up(client: pg.PoolClient): Promise<void> {
  await client.query(`
    BEGIN;

    CREATE TABLE IF NOT EXISTS schema_entity_types (
      id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      name           VARCHAR(100) NOT NULL UNIQUE,
      slug           VARCHAR(100) NOT NULL UNIQUE,
      description    TEXT,
      is_system_seed BOOLEAN      NOT NULL DEFAULT false,
      created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS schema_fields (
      id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type_id UUID         NOT NULL REFERENCES schema_entity_types(id) ON DELETE CASCADE,
      name           VARCHAR(100) NOT NULL,
      slug           VARCHAR(100) NOT NULL,
      field_type     VARCHAR(20)  NOT NULL,
      required       BOOLEAN      NOT NULL DEFAULT false,
      display_order  INTEGER      NOT NULL DEFAULT 0,
      config         JSONB,
      created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
      CONSTRAINT schema_fields_entity_type_name_unique UNIQUE (entity_type_id, name)
    );

    CREATE TABLE IF NOT EXISTS schema_relationships (
      id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      from_entity_type_id  UUID         NOT NULL REFERENCES schema_entity_types(id) ON DELETE CASCADE,
      to_entity_type_id    UUID         NOT NULL REFERENCES schema_entity_types(id) ON DELETE CASCADE,
      label                VARCHAR(100) NOT NULL,
      cardinality          VARCHAR(10)  NOT NULL,
      direction            VARCHAR(10)  NOT NULL DEFAULT 'both',
      created_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS schema_versions (
      id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      version_number INTEGER      NOT NULL,
      snapshot       JSONB        NOT NULL,
      published_by   VARCHAR(100),
      published_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
      is_current     BOOLEAN      NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS catalog_entries (
      id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type_id    UUID         NOT NULL,
      entity_type_slug  VARCHAR(100) NOT NULL,
      schema_version_id UUID         NOT NULL REFERENCES schema_versions(id),
      display_name      VARCHAR(500),
      created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS catalog_field_values (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      entry_id    UUID        NOT NULL REFERENCES catalog_entries(id) ON DELETE CASCADE,
      field_id    UUID        NOT NULL,
      value_text  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT catalog_field_values_entry_field_unique UNIQUE (entry_id, field_id)
    );

    CREATE TABLE IF NOT EXISTS catalog_entry_relationships (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      from_entry_id    UUID        NOT NULL REFERENCES catalog_entries(id) ON DELETE CASCADE,
      to_entry_id      UUID        NOT NULL REFERENCES catalog_entries(id) ON DELETE CASCADE,
      relationship_id  UUID        NOT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT catalog_entry_relationships_unique UNIQUE (from_entry_id, to_entry_id, relationship_id)
    );

    INSERT INTO db_migrations (version) VALUES (1)
    ON CONFLICT (version) DO NOTHING;

    COMMIT;
  `);
}
