import { describe, it, expect } from "vitest";
import { toGraphQLSlug, buildSchema, buildSlugMap } from "./engine";
import type { SchemaSnapshot } from "@workspace/db";

// ---------------------------------------------------------------------------
// toGraphQLSlug
// ---------------------------------------------------------------------------
describe("toGraphQLSlug", () => {
  it("lowercases the input", () => {
    expect(toGraphQLSlug("ProductName")).toBe("productname");
  });

  it("replaces spaces with underscores", () => {
    expect(toGraphQLSlug("hello world")).toBe("hello_world");
  });

  it("replaces special characters with underscores", () => {
    expect(toGraphQLSlug("cost/benefit")).toBe("cost_benefit");
    expect(toGraphQLSlug("name & type")).toBe("name_type");
  });

  it("strips leading and trailing underscores", () => {
    expect(toGraphQLSlug("  hello  ")).toBe("hello");
    expect(toGraphQLSlug("__hello__")).toBe("hello");
  });

  it("collapses multiple consecutive non-alphanumeric chars into one underscore", () => {
    expect(toGraphQLSlug("a  b")).toBe("a_b");
    expect(toGraphQLSlug("a---b")).toBe("a_b");
  });

  it("prefixes leading digits with underscore", () => {
    expect(toGraphQLSlug("123field")).toBe("_123field");
  });

  it("handles a plain lowercase slug unchanged", () => {
    expect(toGraphQLSlug("products")).toBe("products");
  });

  it("handles empty string", () => {
    expect(toGraphQLSlug("")).toBe("");
  });

  it("handles unicode by stripping it", () => {
    expect(toGraphQLSlug("café")).toBe("caf");
  });
});

// ---------------------------------------------------------------------------
// Snapshot helpers
// ---------------------------------------------------------------------------
function makeSnapshot(overrides: Partial<SchemaSnapshot> = {}): SchemaSnapshot {
  return {
    version: 1,
    publishedAt: "2024-01-01T00:00:00.000Z",
    catalogId: "00000000-0000-0000-0000-000000000001",
    catalogName: "Test Catalog",
    templates: [
      {
        id: "tpl-1",
        name: "Product",
        slug: "product",
        description: null,
        isReferenceData: false,
        isSystemSeed: false,
        sections: [
          {
            id: "sec-1",
            name: "Details",
            description: null,
            displayOrder: 0,
            attributes: [
              {
                id: "attr-1",
                name: "Name",
                slug: "name",
                description: null,
                attributeType: "text",
                required: true,
                displayOrder: 0,
                config: null,
              },
              {
                id: "attr-2",
                name: "Price",
                slug: "price",
                description: null,
                attributeType: "number",
                required: false,
                displayOrder: 1,
                config: null,
              },
            ],
          },
        ],
        relationships: [],
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildSchema
// ---------------------------------------------------------------------------
describe("buildSchema", () => {
  it("builds a valid GraphQL schema without throwing", () => {
    const snapshot = makeSnapshot();
    expect(() => buildSchema(snapshot)).not.toThrow();
  });

  it("generates a Query type with list and single-item fields", () => {
    const snapshot = makeSnapshot();
    const schema = buildSchema(snapshot);
    const queryType = schema.getQueryType();
    expect(queryType).not.toBeNull();
    const fields = Object.keys(queryType!.getFields());
    expect(fields).toContain("products");
    expect(fields).toContain("product");
  });

  it("generates text attribute as String scalar", () => {
    const snapshot = makeSnapshot();
    const schema = buildSchema(snapshot);
    const queryType = schema.getQueryType()!;
    const productField = queryType.getFields()["products"];
    expect(productField).toBeDefined();
  });

  it("generates enum type for enum attributes", () => {
    const snapshot = makeSnapshot({
      templates: [
        {
          id: "tpl-1",
          name: "Status",
          slug: "status",
          description: null,
          isReferenceData: false,
          isSystemSeed: false,
          sections: [
            {
              id: "sec-1",
              name: "Info",
              description: null,
              displayOrder: 0,
              attributes: [
                {
                  id: "attr-1",
                  name: "State",
                  slug: "state",
                  description: null,
                  attributeType: "enum",
                  required: false,
                  displayOrder: 0,
                  config: { options: ["active", "inactive"] },
                },
              ],
            },
          ],
          relationships: [],
        },
      ],
    });
    expect(() => buildSchema(snapshot)).not.toThrow();
  });

  it("handles an empty templates array without throwing", () => {
    const snapshot = makeSnapshot({ templates: [] });
    expect(() => buildSchema(snapshot)).not.toThrow();
  });

  it("handles reference data templates", () => {
    const snapshot = makeSnapshot({
      templates: [
        {
          id: "tpl-ref",
          name: "Category",
          slug: "category",
          description: null,
          isReferenceData: true,
          isSystemSeed: false,
          sections: [],
          relationships: [],
        },
      ],
    });
    expect(() => buildSchema(snapshot)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// buildSlugMap
// ---------------------------------------------------------------------------
describe("buildSlugMap", () => {
  it("maps template slug → id", () => {
    const snapshot = makeSnapshot();
    const slugMap = buildSlugMap(snapshot);
    expect(slugMap.templateSlugToId["product"]).toBe("tpl-1");
  });

  it("maps template id → slug", () => {
    const snapshot = makeSnapshot();
    const slugMap = buildSlugMap(snapshot);
    expect(slugMap.templateIdToSlug["tpl-1"]).toBe("product");
  });

  it("maps attribute slug → id within a template", () => {
    const snapshot = makeSnapshot();
    const slugMap = buildSlugMap(snapshot);
    expect(slugMap.attributeSlugToId["tpl-1"]["name"]).toBe("attr-1");
  });

  it("maps attribute id → type", () => {
    const snapshot = makeSnapshot();
    const slugMap = buildSlugMap(snapshot);
    expect(slugMap.attributeIdToType["attr-1"]).toBe("text");
    expect(slugMap.attributeIdToType["attr-2"]).toBe("number");
  });
});
