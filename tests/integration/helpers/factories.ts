import { getDb } from "../../../artifacts/api-server/src/db/connection";
import {
  catalogsTable,
  schemaTemplatesTable,
  schemaSectionsTable,
  schemaAttributesTable,
  schemaVersionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^([0-9])/, "_$1") || "template";
}

export async function createTestCatalog(overrides: Partial<typeof catalogsTable.$inferInsert> = {}) {
  const db = getDb();
  const [catalog] = await db
    .insert(catalogsTable)
    .values({
      name: overrides.name ?? `Test Catalog ${Date.now()}`,
      description: null,
      status: "draft",
      ...overrides,
    })
    .returning();
  return catalog!;
}

export async function createTestTemplate(
  catalogId: string,
  overrides: Partial<typeof schemaTemplatesTable.$inferInsert> = {},
) {
  const db = getDb();
  const name = overrides.name ?? `Template ${Date.now()}`;
  const [template] = await db
    .insert(schemaTemplatesTable)
    .values({
      catalogId,
      name,
      slug: overrides.slug ?? toSlug(name),
      description: null,
      isReferenceData: false,
      ...overrides,
    })
    .returning();
  return template!;
}

export async function createTestSection(
  templateId: string,
  overrides: Partial<typeof schemaSectionsTable.$inferInsert> = {},
) {
  const db = getDb();
  const [section] = await db
    .insert(schemaSectionsTable)
    .values({
      templateId,
      name: overrides.name ?? `Section ${Date.now()}`,
      description: null,
      displayOrder: 0,
      ...overrides,
    })
    .returning();
  return section!;
}

export async function createTestAttribute(
  sectionId: string,
  overrides: Partial<typeof schemaAttributesTable.$inferInsert> = {},
) {
  const db = getDb();
  const [attr] = await db
    .insert(schemaAttributesTable)
    .values({
      sectionId,
      name: overrides.name ?? `Attr ${Date.now()}`,
      slug: overrides.slug ?? toSlug(overrides.name ?? `attr_${Date.now()}`),
      attributeType: "text",
      required: false,
      config: null,
      displayOrder: 0,
      ...overrides,
    })
    .returning();
  return attr!;
}

export async function createAndPublishTestCatalog() {
  const catalog = await createTestCatalog({ name: `Published Catalog ${Date.now()}` });
  const template = await createTestTemplate(catalog.id, { name: "Product", slug: "product" });
  const section = await createTestSection(template.id, { name: "Details" });
  const attr = await createTestAttribute(section.id, {
    name: "Name",
    slug: "name",
    attributeType: "text",
    required: true,
  });

  const db = getDb();
  const snapshot = {
    templates: [
      {
        id: template.id,
        name: template.name,
        slug: "product",
        isReferenceData: false,
        sections: [
          {
            id: section.id,
            name: section.name,
            attributes: [
              {
                id: attr.id,
                name: "Name",
                slug: "name",
                attributeType: "text",
                required: true,
                config: null,
              },
            ],
          },
        ],
        relationships: [],
      },
    ],
  };

  await db.insert(schemaVersionsTable).values({
    catalogId: catalog.id,
    versionNumber: 1,
    snapshot,
    publishedAt: new Date(),
    catalogName: catalog.name,
    entryCount: 0,
  });

  await db.update(catalogsTable).set({ status: "pilot" }).where(eq(catalogsTable.id, catalog.id));

  const [updated] = await db.select().from(catalogsTable).where(eq(catalogsTable.id, catalog.id));
  return { catalog: updated!, template, section, attr };
}
