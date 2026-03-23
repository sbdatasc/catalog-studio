import { describe, it, expect, afterEach } from "vitest";
import supertest from "supertest";
import app from "../../../artifacts/api-server/src/app";
import { cleanupTestData } from "../helpers/db";

const createdIds: string[] = [];

afterEach(async () => {
  if (createdIds.length > 0) {
    await cleanupTestData({ catalogIds: [...createdIds] });
    createdIds.length = 0;
  }
});

describe("GET /api/catalogs", () => {
  it("returns 200 with an array", async () => {
    const res = await supertest(app).get("/api/catalogs");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.error).toBeNull();
  });
});

describe("POST /api/catalogs", () => {
  it("creates a catalog and returns 201", async () => {
    const name = `Integration Test ${Date.now()}`;
    const res = await supertest(app)
      .post("/api/catalogs")
      .send({ name })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe(name);
    expect(res.body.data.status).toBe("draft");
    expect(res.body.data.id).toBeDefined();
    expect(res.body.error).toBeNull();
    createdIds.push(res.body.data.id as string);
  });

  it("returns 422 when name is missing", async () => {
    const res = await supertest(app)
      .post("/api/catalogs")
      .send({})
      .set("Content-Type", "application/json");

    expect([400, 422]).toContain(res.status);
    expect(res.body.data).toBeNull();
    expect(res.body.error).not.toBeNull();
  });

  it("returns 4xx when name is an empty or whitespace string", async () => {
    const res = await supertest(app)
      .post("/api/catalogs")
      .send({ name: "   " })
      .set("Content-Type", "application/json");

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe("GET /api/catalogs/:id", () => {
  it("returns 404 for a non-existent catalog", async () => {
    const res = await supertest(app).get("/api/catalogs/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
    expect(res.body.error).not.toBeNull();
  });

  it("returns the catalog by id", async () => {
    const name = `Get Test ${Date.now()}`;
    const createRes = await supertest(app)
      .post("/api/catalogs")
      .send({ name })
      .set("Content-Type", "application/json");

    const id = createRes.body.data.id as string;
    createdIds.push(id);

    const getRes = await supertest(app).get(`/api/catalogs/${id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(id);
    expect(getRes.body.data.name).toBe(name);
  });
});

describe("PATCH /api/catalogs/:id", () => {
  it("updates a catalog name", async () => {
    const originalName = `Patch Source ${Date.now()}`;
    const createRes = await supertest(app)
      .post("/api/catalogs")
      .send({ name: originalName })
      .set("Content-Type", "application/json");

    const id = createRes.body.data.id as string;
    createdIds.push(id);

    const newName = `Updated Name ${Date.now()}`;
    const patchRes = await supertest(app)
      .patch(`/api/catalogs/${id}`)
      .send({ name: newName })
      .set("Content-Type", "application/json");

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.name).toBe(newName);
  });
});
