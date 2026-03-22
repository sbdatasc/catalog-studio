import type pg from "pg";

/**
 * Migration 001 — Initial schema (PRD-02 Amendment v1.0).
 * Creates all domain tables plus the db_migrations tracking table.
 * Wrapped in a single transaction — any failure rolls back and halts startup.
 *
 * Schema hierarchy: Template → Section → Attribute (three-level)
 * Reference data: reference_datasets → reference_values
 * Catalog: catalog_entries → catalog_field_values, catalog_entry_relationships
 *
 * NEVER EDIT THIS FILE once it has been applied to any database.
 * Create a new migration file (002_*.ts) for any structural changes.
 */
export async function up(client: pg.PoolClient): Promise<void> {
  await client.query(`
    BEGIN;

    -- -----------------------------------------------------------------------
    -- schema_templates (was schema_entity_types)
    -- -----------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS schema_templates (
      id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      name           VARCHAR(100) NOT NULL UNIQUE,
      slug           VARCHAR(100) NOT NULL UNIQUE,
      description    TEXT,
      is_system_seed BOOLEAN      NOT NULL DEFAULT false,
      created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
    );

    -- -----------------------------------------------------------------------
    -- schema_sections (NEW — Template → Section → Attribute hierarchy)
    -- -----------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS schema_sections (
      id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      template_id   UUID         NOT NULL REFERENCES schema_templates(id) ON DELETE CASCADE,
      name          VARCHAR(100) NOT NULL,
      description   TEXT,
      display_order INTEGER      NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
      CONSTRAINT schema_sections_template_name_unique UNIQUE (template_id, name)
    );

    -- -----------------------------------------------------------------------
    -- schema_attributes (was schema_fields)
    -- parent is section, not template directly; field_type → attribute_type
    -- -----------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS schema_attributes (
      id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      section_id     UUID         NOT NULL REFERENCES schema_sections(id) ON DELETE CASCADE,
      name           VARCHAR(100) NOT NULL,
      slug           VARCHAR(100) NOT NULL,
      description    TEXT,
      attribute_type VARCHAR(20)  NOT NULL,
      required       BOOLEAN      NOT NULL DEFAULT false,
      display_order  INTEGER      NOT NULL DEFAULT 0,
      config         JSONB,
      created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
      CONSTRAINT schema_attributes_section_name_unique UNIQUE (section_id, name)
    );

    -- -----------------------------------------------------------------------
    -- schema_relationships (template-to-template links)
    -- -----------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS schema_relationships (
      id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      from_template_id UUID         NOT NULL REFERENCES schema_templates(id) ON DELETE CASCADE,
      to_template_id   UUID         NOT NULL REFERENCES schema_templates(id) ON DELETE CASCADE,
      label            VARCHAR(100) NOT NULL,
      cardinality      VARCHAR(10)  NOT NULL,
      direction        VARCHAR(10)  NOT NULL DEFAULT 'both',
      created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
    );

    -- -----------------------------------------------------------------------
    -- reference_datasets (NEW — controlled vocabularies)
    -- -----------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS reference_datasets (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
    );

    -- -----------------------------------------------------------------------
    -- reference_values (NEW — values within a reference dataset)
    -- -----------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS reference_values (
      id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      dataset_id    UUID         NOT NULL REFERENCES reference_datasets(id) ON DELETE CASCADE,
      label         VARCHAR(200) NOT NULL,
      value         VARCHAR(200) NOT NULL,
      display_order INTEGER      NOT NULL DEFAULT 0,
      is_active     BOOLEAN      NOT NULL DEFAULT true,
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
      CONSTRAINT reference_values_dataset_value_unique UNIQUE (dataset_id, value)
    );

    -- -----------------------------------------------------------------------
    -- schema_versions (published schema snapshots)
    -- -----------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS schema_versions (
      id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      version_number INTEGER      NOT NULL,
      snapshot       JSONB        NOT NULL,
      published_by   VARCHAR(100),
      published_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
      is_current     BOOLEAN      NOT NULL DEFAULT true
    );

    -- -----------------------------------------------------------------------
    -- catalog_entries (EAV root — template_id replaces entity_type_id)
    -- -----------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS catalog_entries (
      id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      template_id      UUID         NOT NULL,
      template_slug    VARCHAR(100) NOT NULL,
      schema_version_id UUID        NOT NULL REFERENCES schema_versions(id),
      display_name     VARCHAR(500),
      created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
    );

    -- -----------------------------------------------------------------------
    -- catalog_field_values (EAV values — attribute_id replaces field_id)
    -- -----------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS catalog_field_values (
      id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      entry_id     UUID        NOT NULL REFERENCES catalog_entries(id) ON DELETE CASCADE,
      attribute_id UUID        NOT NULL,
      value_text   TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT catalog_field_values_entry_attr_unique UNIQUE (entry_id, attribute_id)
    );

    -- -----------------------------------------------------------------------
    -- catalog_entry_relationships (entry-to-entry links)
    -- -----------------------------------------------------------------------
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
