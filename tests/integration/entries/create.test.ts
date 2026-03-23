import { describe, it, expect, afterEach } from "vitest";
import supertest from "supertest";
import app from "../../../artifacts/api-server/src/app";
import { cleanupTestData } from "../helpers/db";
import { createAndPublishTestCatalog } from "../helpers/factories";

const createdCatalogIds: string[] = [];

afterEach(async () => {
  if (createdCatalogIds.length > 0) {
    await cleanupTestData({ catalogIds: [...createdCatalogIds] });
    createdCatalogIds.length = 0;
  }
});

describe("POST /api/entries", () => {
  it("returns 4xx when catalogId is missing", async () => {
    const res = await supertest(app)
      .post("/api/entries")
      .send({ templateId: "tpl-1", fieldValues: {} })
      .set("Content-Type", "application/json");

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.body.error).not.toBeNull();
  });

  it("returns 4xx for a non-existent catalog", async () => {
    const res = await supertest(app)
      .post("/api/entries")
      .send({
        catalogId: "00000000-0000-0000-0000-000000000000",
        templateId: "00000000-0000-0000-0000-000000000001",
        fieldValues: {},
      })
      .set("Content-Type", "application/json");

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("creates an entry for a published catalog", async () => {
    const { catalog, template, attr } = await createAndPublishTestCatalog();
    createdCatalogIds.push(catalog.id);

    const res = await supertest(app)
      .post("/api/entries")
      .send({
        catalogId: catalog.id,
        templateId: template.id,
        fieldValues: [{ attributeId: attr.id, value: "Test Product" }],
      })
      .set("Content-Type", "application/json");

    expect([200, 201]).toContain(res.status);
    if (res.body.data) {
      expect(res.body.data.catalogId).toBe(catalog.id);
      expect(res.body.data.templateId).toBe(template.id);
    }
  });
});

describe("GET /api/entries", () => {
  it("returns 4xx when catalogId is missing", async () => {
    const res = await supertest(app).get("/api/entries?templateId=tpl-1");
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.body.error).not.toBeNull();
  });

  it("returns entry list for a catalog", async () => {
    const { catalog, template } = await createAndPublishTestCatalog();
    createdCatalogIds.push(catalog.id);

    const res = await supertest(app).get(
      `/api/entries?catalogId=${catalog.id}&templateId=${template.id}`,
    );

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.entries)).toBe(true);
  });
});
