import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@workspace/db";
import {
  catalogsTable,
  schemaTemplatesTable,
  schemaSectionsTable,
  schemaAttributesTable,
} from "@workspace/db";
import { logger } from "../lib/logger";

type DbInstance = NodePgDatabase<typeof schema>;

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

interface SeedAttribute {
  name: string;
  attributeType: schema.AttributeType;
  required: boolean;
  displayOrder: number;
  config: schema.AttributeConfig;
  description?: string | null;
}

interface SeedSection {
  name: string;
  description?: string | null;
  displayOrder: number;
  attributes: SeedAttribute[];
}

interface SeedTemplate {
  name: string;
  description: string | null;
  sections: SeedSection[];
}

const SEED_TEMPLATES: SeedTemplate[] = [
  {
    name: "Data Asset",
    description: "A data asset such as a table, dataset, or report",
    sections: [
      {
        name: "General",
        description: null,
        displayOrder: 0,
        attributes: [
          { name: "Name", attributeType: "string", required: true, displayOrder: 0, config: null },
          { name: "Description", attributeType: "text", required: false, displayOrder: 1, config: null },
          { name: "Source System", attributeType: "string", required: false, displayOrder: 2, config: null },
          { name: "Owner", attributeType: "string", required: false, displayOrder: 3, config: null },
          { name: "Tags", attributeType: "string", required: false, displayOrder: 4, config: null },
        ],
      },
    ],
  },
  {
    name: "Pipeline",
    description: "A data pipeline or ETL job",
    sections: [
      {
        name: "General",
        description: null,
        displayOrder: 0,
        attributes: [
          { name: "Name", attributeType: "string", required: true, displayOrder: 0, config: null },
          { name: "Description", attributeType: "text", required: false, displayOrder: 1, config: null },
          { name: "Schedule", attributeType: "string", required: false, displayOrder: 2, config: null },
          {
            name: "Status",
            attributeType: "enum",
            required: false,
            displayOrder: 3,
            config: { options: ["active", "paused", "deprecated"] },
          },
          { name: "Owner", attributeType: "string", required: false, displayOrder: 4, config: null },
        ],
      },
    ],
  },
  {
    name: "Glossary Term",
    description: "A business glossary term with an authoritative definition",
    sections: [
      {
        name: "General",
        description: null,
        displayOrder: 0,
        attributes: [
          { name: "Term", attributeType: "string", required: true, displayOrder: 0, config: null },
          { name: "Definition", attributeType: "text", required: true, displayOrder: 1, config: null },
          { name: "Domain", attributeType: "string", required: false, displayOrder: 2, config: null },
          {
            name: "Status",
            attributeType: "enum",
            required: false,
            displayOrder: 3,
            config: { options: ["draft", "approved", "deprecated"] },
          },
        ],
      },
    ],
  },
  {
    name: "Person / Team",
    description: "A person or team responsible for data assets",
    sections: [
      {
        name: "General",
        description: null,
        displayOrder: 0,
        attributes: [
          { name: "Name", attributeType: "string", required: true, displayOrder: 0, config: null },
          { name: "Role", attributeType: "string", required: false, displayOrder: 1, config: null },
          { name: "Email", attributeType: "string", required: false, displayOrder: 2, config: null },
          { name: "Department", attributeType: "string", required: false, displayOrder: 3, config: null },
        ],
      },
    ],
  },
  {
    name: "System / Source",
    description: "A system or data source that produces data assets",
    sections: [
      {
        name: "General",
        description: null,
        displayOrder: 0,
        attributes: [
          { name: "Name", attributeType: "string", required: true, displayOrder: 0, config: null },
          {
            name: "Type",
            attributeType: "enum",
            required: false,
            displayOrder: 1,
            config: { options: ["database", "API", "file system", "SaaS", "other"] },
          },
          { name: "Description", attributeType: "text", required: false, displayOrder: 2, config: null },
          { name: "Owner", attributeType: "string", required: false, displayOrder: 3, config: null },
        ],
      },
    ],
  },
];

/**
 * Seeds one "Demo Catalog" (Draft) with the 5 default system templates if the database is empty.
 * Idempotent — calling this on a populated database is a no-op.
 */
export async function seedIfRequired(db: DbInstance): Promise<void> {
  const existingCatalogs = await db.select({ id: catalogsTable.id }).from(catalogsTable).limit(1);
  if (existingCatalogs.length > 0) {
    logger.info("Seed check: catalogs already exist — skipping seed");
    return;
  }

  logger.info("Seeding Demo Catalog with 5 default templates...");

  // Create the demo catalog
  const [catalog] = await db
    .insert(catalogsTable)
    .values({
      name: "Demo Catalog",
      description: "A sample data catalog to get you started",
      status: "draft",
    })
    .returning();

  logger.info({ catalogId: catalog.id }, "Demo Catalog created");

  // Seed templates under the demo catalog
  for (const templateDef of SEED_TEMPLATES) {
    const slug = toSlug(templateDef.name);

    const [template] = await db
      .insert(schemaTemplatesTable)
      .values({
        catalogId: catalog.id,
        name: templateDef.name,
        slug,
        description: templateDef.description,
        isSystemSeed: true,
        isReferenceData: false,
      })
      .returning();

    for (const sectionDef of templateDef.sections) {
      const [section] = await db
        .insert(schemaSectionsTable)
        .values({
          templateId: template.id,
          name: sectionDef.name,
          description: sectionDef.description ?? null,
          displayOrder: sectionDef.displayOrder,
        })
        .returning();

      for (const attrDef of sectionDef.attributes) {
        await db.insert(schemaAttributesTable).values({
          sectionId: section.id,
          name: attrDef.name,
          slug: toSlug(attrDef.name),
          description: attrDef.description ?? null,
          attributeType: attrDef.attributeType,
          required: attrDef.required,
          displayOrder: attrDef.displayOrder,
          config: attrDef.config,
        });
      }
    }

    logger.info({ name: templateDef.name }, "Seeded template");
  }

  logger.info("Seed complete: Demo Catalog + 5 templates created");
}
