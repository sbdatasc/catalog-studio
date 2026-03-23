import { describe, it, expect } from "vitest";
import { applyFilterToEntries } from "./filters";

interface TestEntry {
  id: string;
  fieldValues: Array<{ attributeId: string; value: string | null }>;
}

const attributeSlugToId: Record<string, string> = {
  name: "attr-1",
  price: "attr-2",
  active: "attr-3",
};

const attributeIdToType: Record<string, string> = {
  "attr-1": "text",
  "attr-2": "number",
  "attr-3": "boolean",
};

function makeEntries(): TestEntry[] {
  return [
    {
      id: "e1",
      fieldValues: [
        { attributeId: "attr-1", value: "Alpha Widget" },
        { attributeId: "attr-2", value: "10" },
        { attributeId: "attr-3", value: "true" },
      ],
    },
    {
      id: "e2",
      fieldValues: [
        { attributeId: "attr-1", value: "Beta Widget" },
        { attributeId: "attr-2", value: "20" },
        { attributeId: "attr-3", value: "false" },
      ],
    },
    {
      id: "e3",
      fieldValues: [
        { attributeId: "attr-1", value: "Gamma Gadget" },
        { attributeId: "attr-2", value: "30" },
        { attributeId: "attr-3", value: "true" },
      ],
    },
  ];
}

describe("applyFilterToEntries", () => {
  describe("string / text filters", () => {
    it("filters by exact equality (eq)", () => {
      const result = applyFilterToEntries(makeEntries(), { name: { eq: "Alpha Widget" } }, attributeSlugToId, attributeIdToType);
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("e1");
    });

    it("filters by contains", () => {
      const result = applyFilterToEntries(makeEntries(), { name: { contains: "Widget" } }, attributeSlugToId, attributeIdToType);
      expect(result).toHaveLength(2);
    });

    it("returns empty array when nothing matches contains", () => {
      const result = applyFilterToEntries(makeEntries(), { name: { contains: "Nonexistent" } }, attributeSlugToId, attributeIdToType);
      expect(result).toHaveLength(0);
    });
  });

  describe("number filters", () => {
    it("filters by eq", () => {
      const result = applyFilterToEntries(makeEntries(), { price: { eq: 10 } }, attributeSlugToId, attributeIdToType);
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("e1");
    });

    it("filters by gte", () => {
      const result = applyFilterToEntries(makeEntries(), { price: { gte: 20 } }, attributeSlugToId, attributeIdToType);
      expect(result).toHaveLength(2);
    });

    it("filters by lte", () => {
      const result = applyFilterToEntries(makeEntries(), { price: { lte: 20 } }, attributeSlugToId, attributeIdToType);
      expect(result).toHaveLength(2);
    });

    it("filters by combined gte + lte range", () => {
      const result = applyFilterToEntries(makeEntries(), { price: { gte: 15, lte: 25 } }, attributeSlugToId, attributeIdToType);
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("e2");
    });
  });

  describe("boolean filters", () => {
    it("filters by eq true", () => {
      const result = applyFilterToEntries(makeEntries(), { active: { eq: true } }, attributeSlugToId, attributeIdToType);
      expect(result).toHaveLength(2);
    });

    it("filters by eq false", () => {
      const result = applyFilterToEntries(makeEntries(), { active: { eq: false } }, attributeSlugToId, attributeIdToType);
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("e2");
    });
  });

  describe("edge cases", () => {
    it("returns all entries when whereArg is empty", () => {
      const result = applyFilterToEntries(makeEntries(), {}, attributeSlugToId, attributeIdToType);
      expect(result).toHaveLength(3);
    });

    it("returns all entries when whereArg is null/undefined", () => {
      const result = applyFilterToEntries(makeEntries(), null as unknown as Record<string, unknown>, attributeSlugToId, attributeIdToType);
      expect(result).toHaveLength(3);
    });

    it("ignores unknown attribute slugs gracefully", () => {
      const result = applyFilterToEntries(makeEntries(), { unknown_field: { eq: "x" } }, attributeSlugToId, attributeIdToType);
      expect(result).toHaveLength(3);
    });
  });
});
