import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@workspace/db";
import { schemaEntityTypesTable, schemaFieldsTable } from "@workspace/db";
import { logger } from "../lib/logger";

type DbInstance = NodePgDatabase<typeof schema>;

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

interface SeedField {
  name: string;
  fieldType: schema.FieldType;
  required: boolean;
  displayOrder: number;
  config: schema.FieldConfig;
}

interface SeedEntityType {
  name: string;
  description: string | null;
  fields: SeedField[];
}

const SEED_ENTITY_TYPES: SeedEntityType[] = [
  {
    name: "Data Asset",
    description: "A data asset such as a table, dataset, or report",
    fields: [
      { name: "Name", fieldType: "string", required: true, displayOrder: 0, config: null },
      { name: "Description", fieldType: "text", required: false, displayOrder: 1, config: null },
      { name: "Source System", fieldType: "string", required: false, displayOrder: 2, config: null },
      { name: "Owner", fieldType: "string", required: false, displayOrder: 3, config: null },
      { name: "Tags", fieldType: "string", required: false, displayOrder: 4, config: null },
    ],
  },
  {
    name: "Pipeline",
    description: "A data pipeline or ETL job",
    fields: [
      { name: "Name", fieldType: "string", required: true, displayOrder: 0, config: null },
      { name: "Description", fieldType: "text", required: false, displayOrder: 1, config: null },
      { name: "Schedule", fieldType: "string", required: false, displayOrder: 2, config: null },
      {
        name: "Status",
        fieldType: "enum",
        required: false,
        displayOrder: 3,
        config: { options: ["active", "paused", "deprecated"] },
      },
      { name: "Owner", fieldType: "string", required: false, displayOrder: 4, config: null },
    ],
  },
  {
    name: "Glossary Term",
    description: "A business glossary term with an authoritative definition",
    fields: [
      { name: "Term", fieldType: "string", required: true, displayOrder: 0, config: null },
      { name: "Definition", fieldType: "text", required: true, displayOrder: 1, config: null },
      { name: "Domain", fieldType: "string", required: false, displayOrder: 2, config: null },
      {
        name: "Status",
        fieldType: "enum",
        required: false,
        displayOrder: 3,
        config: { options: ["draft", "approved", "deprecated"] },
      },
    ],
  },
  {
    name: "Person / Team",
    description: "A person or team responsible for data assets",
    fields: [
      { name: "Name", fieldType: "string", required: true, displayOrder: 0, config: null },
      { name: "Role", fieldType: "string", required: false, displayOrder: 1, config: null },
      { name: "Email", fieldType: "string", required: false, displayOrder: 2, config: null },
      { name: "Department", fieldType: "string", required: false, displayOrder: 3, config: null },
    ],
  },
  {
    name: "System / Source",
    description: "A system or data source that produces data assets",
    fields: [
      { name: "Name", fieldType: "string", required: true, displayOrder: 0, config: null },
      {
        name: "Type",
        fieldType: "enum",
        required: false,
        displayOrder: 1,
        config: { options: ["database", "API", "file system", "SaaS", "other"] },
      },
      { name: "Description", fieldType: "text", required: false, displayOrder: 2, config: null },
      { name: "Owner", fieldType: "string", required: false, displayOrder: 3, config: null },
    ],
  },
];

/**
 * Seeds the 5 default entity types if the database is empty.
 * Idempotent — calling this on a populated database is a no-op.
 */
export async function seedIfRequired(db: DbInstance): Promise<void> {
  const existing = await db.select({ id: schemaEntityTypesTable.id }).from(schemaEntityTypesTable).limit(1);
  if (existing.length > 0) {
    logger.info("Seed check: entity types already exist — skipping seed");
    return;
  }

  logger.info("Seeding 5 default entity types...");

  for (const entityTypeDef of SEED_ENTITY_TYPES) {
    const slug = toSlug(entityTypeDef.name);

    const [entityType] = await db
      .insert(schemaEntityTypesTable)
      .values({
        name: entityTypeDef.name,
        slug,
        description: entityTypeDef.description,
        isSystemSeed: true,
      })
      .returning();

    for (const fieldDef of entityTypeDef.fields) {
      await db.insert(schemaFieldsTable).values({
        entityTypeId: entityType.id,
        name: fieldDef.name,
        slug: toSlug(fieldDef.name),
        fieldType: fieldDef.fieldType,
        required: fieldDef.required,
        displayOrder: fieldDef.displayOrder,
        config: fieldDef.config,
      });
    }

    logger.info({ name: entityTypeDef.name }, "Seeded entity type");
  }

  logger.info("Seed complete: 5 entity types created");
}
