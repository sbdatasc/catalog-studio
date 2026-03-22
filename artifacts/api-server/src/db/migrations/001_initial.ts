import type pg from "pg";

/**
 * Migration 001 — Initial schema (PRD-02 Amendment v2).
 * Creates all domain tables plus the db_migrations tracking table.
 * Wrapped in a single transaction — any failure rolls back and halts startup.
 *
 * Schema hierarchy:
 *   Catalog → Template (is_reference_data flag) → Section → Attribute
 *   Catalog → catalog_entries → catalog_field_values, catalog_entry_relationships
 *
 * Note: reference_datasets / reference_values tables do NOT exist (voided in v2).
 *
 * NEVER EDIT THIS FILE once it has been applied to any database.
 * Create a new migration file (002_*.ts) for any structural changes.
 */
export async function up(client: pg.PoolClient): Promise<void> {
  await client.query(`
    BEGIN;

    -- -----------------------------------------------------------------------
    -- catalogs — top-level scoping object with lifecycle status
    -- -----------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS catalogs (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      status      VARCHAR(20)  NOT NULL DEFAULT 'draft',
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
      CONSTRAINT catalogs_status_check
        CHECK (status IN ('draft', 'pilot', 'published', 'discontinued'))
    );

    -- -----------------------------------------------------------------------
    -- schema_templates — standard templates + reference data templates
    -- -----------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS schema_templates (
      id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      catalog_id        UUID         NOT NULL REFERENCES catalogs(id) ON DELETE CASCADE,
      name              VARCHAR(100) NOT NULL,
      slug              VARCHAR(100) NOT NULL,
      description       TEXT,
      is_system_seed    BOOLEAN      NOT NULL DEFAULT false,
      is_reference_data BOOLEAN      NOT NULL DEFAULT false,
      created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
    );

    -- Per-catalog uniqueness (names/slugs unique within a catalog, not globally)
    CREATE UNIQUE INDEX IF NOT EXISTS schema_templates_catalog_name_unique
      ON schema_templates(catalog_id, name);
    CREATE UNIQUE INDEX IF NOT EXISTS schema_templates_catalog_slug_unique
      ON schema_templates(catalog_id, slug);

    -- -----------------------------------------------------------------------
    -- schema_sections — intermediate layer; all attributes belong to a section
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
    -- schema_attributes — belong to a section, not directly to a template
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
    -- schema_relationships — template-to-template links
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
    -- schema_versions — published schema snapshots (immutable)
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
    -- catalog_entries — EAV root, scoped to a catalog
    -- -----------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS catalog_entries (
      id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      catalog_id        UUID         NOT NULL REFERENCES catalogs(id) ON DELETE CASCADE,
      template_id       UUID         NOT NULL,
      template_slug     VARCHAR(100) NOT NULL,
      schema_version_id UUID         NOT NULL REFERENCES schema_versions(id),
      display_name      VARCHAR(500),
      created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
    );

    -- -----------------------------------------------------------------------
    -- catalog_field_values — EAV attribute value store
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
    -- catalog_entry_relationships — entry-to-entry relationship instances
    -- -----------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS catalog_entry_relationships (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      from_entry_id    UUID        NOT NULL REFERENCES catalog_entries(id) ON DELETE CASCADE,
      to_entry_id      UUID        NOT NULL REFERENCES catalog_entries(id) ON DELETE CASCADE,
      relationship_id  UUID        NOT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT catalog_entry_relationships_unique
        UNIQUE (from_entry_id, to_entry_id, relationship_id)
    );

    INSERT INTO db_migrations (version) VALUES (1)
    ON CONFLICT (version) DO NOTHING;

    COMMIT;
  `);
}
