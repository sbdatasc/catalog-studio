import { describe, it, expect } from "vitest";
import { generateExampleQueries } from "./exampleQueries";
import type { SchemaSnapshot } from "@/lib/apiClient";

function makeSnapshot(overrides: Partial<SchemaSnapshot> = {}): SchemaSnapshot {
  return {
    templates: [
      {
        id: "tpl-1",
        name: "Product",
        slug: "product",
        isReferenceData: false,
        sections: [
          {
            id: "sec-1",
            name: "Details",
            attributes: [
              {
                id: "attr-1",
                name: "Name",
                slug: "name",
                attributeType: "text",
                required: true,
                config: null,
              },
              {
                id: "attr-2",
                name: "Price",
                slug: "price",
                attributeType: "number",
                required: false,
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

describe("generateExampleQueries", () => {
  it("returns exactly 3 queries for a valid snapshot", () => {
    const snapshot = makeSnapshot();
    const queries = generateExampleQueries(snapshot);
    expect(queries).toHaveLength(3);
  });

  it("returns an empty array when there are no non-reference-data templates", () => {
    const snapshot = makeSnapshot({
      templates: [
        {
          id: "tpl-ref",
          name: "Category",
          slug: "category",
          isReferenceData: true,
          sections: [],
          relationships: [],
        },
      ],
    });
    const queries = generateExampleQueries(snapshot);
    expect(queries).toHaveLength(0);
  });

  it("returns an empty array for an empty templates array", () => {
    const snapshot = makeSnapshot({ templates: [] });
    const queries = generateExampleQueries(snapshot);
    expect(queries).toHaveLength(0);
  });

  it("first query is a list query", () => {
    const snapshot = makeSnapshot();
    const queries = generateExampleQueries(snapshot);
    expect(queries[0]!.label).toMatch(/list/i);
    expect(queries[0]!.query).toMatch(/query\s+ListProducts/i);
    expect(queries[0]!.query).toContain("products");
  });

  it("second query is a single-item query with an ID parameter", () => {
    const snapshot = makeSnapshot();
    const queries = generateExampleQueries(snapshot);
    expect(queries[1]!.label).toMatch(/get.*by id/i);
    expect(queries[1]!.query).toMatch(/\$id:\s*ID!/i);
    expect(queries[1]!.query).toContain("product(id:");
  });

  it("third query is a filter query when there are no relationships", () => {
    const snapshot = makeSnapshot();
    const queries = generateExampleQueries(snapshot);
    expect(queries[2]!.label).toMatch(/filter/i);
    expect(queries[2]!.query).toMatch(/Filter/);
  });

  it("third query is a traversal query when a relationship exists", () => {
    const snapshot = makeSnapshot({
      templates: [
        {
          id: "tpl-1",
          name: "Product",
          slug: "product",
          isReferenceData: false,
          sections: [
            {
              id: "sec-1",
              name: "Details",
              attributes: [
                {
                  id: "attr-1",
                  name: "Name",
                  slug: "name",
                  attributeType: "text",
                  required: true,
                  config: null,
                },
              ],
            },
          ],
          relationships: [
            {
              id: "rel-1",
              label: "belongs to",
              fromTemplateId: "tpl-1",
              toTemplateId: "tpl-2",
              cardinality: "M:N",
              direction: "from",
            },
          ],
        },
      ],
    });
    const queries = generateExampleQueries(snapshot);
    expect(queries[2]!.label).toContain("belongs to");
    expect(queries[2]!.query).toContain("belongs_to");
  });

  it("queries include scalar attribute slugs", () => {
    const snapshot = makeSnapshot();
    const queries = generateExampleQueries(snapshot);
    for (const q of queries) {
      expect(q.query).toContain("name");
      expect(q.query).toContain("price");
    }
  });

  it("queries always include id and display_name fields", () => {
    const snapshot = makeSnapshot();
    const queries = generateExampleQueries(snapshot);
    for (const q of queries) {
      expect(q.query).toContain("id");
      expect(q.query).toContain("display_name");
    }
  });

  it("skips reference-data templates and uses the first non-reference-data template", () => {
    const snapshot = makeSnapshot({
      templates: [
        {
          id: "tpl-ref",
          name: "RefCategory",
          slug: "ref_category",
          isReferenceData: true,
          sections: [],
          relationships: [],
        },
        {
          id: "tpl-1",
          name: "Widget",
          slug: "widget",
          isReferenceData: false,
          sections: [
            {
              id: "sec-1",
              name: "Info",
              attributes: [
                {
                  id: "attr-1",
                  name: "Title",
                  slug: "title",
                  attributeType: "text",
                  required: false,
                  config: null,
                },
              ],
            },
          ],
          relationships: [],
        },
      ],
    });
    const queries = generateExampleQueries(snapshot);
    expect(queries).toHaveLength(3);
    expect(queries[0]!.query).toContain("widget");
    expect(queries[0]!.query).not.toContain("ref_category");
  });
});
