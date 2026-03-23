import { describe, it, expect } from "vitest";
import {
  toStorageString,
  fromStorageString,
  validateAttributeValue,
  toDisplayString,
} from "./coercionService";
import type { SnapshotAttribute } from "@workspace/db";

function makeAttr(
  overrides: Partial<SnapshotAttribute> = {},
): SnapshotAttribute {
  return {
    id: "attr-1",
    name: "Test Attr",
    slug: "test_attr",
    description: null,
    attributeType: "text",
    required: false,
    displayOrder: 0,
    config: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// toStorageString
// ---------------------------------------------------------------------------
describe("toStorageString", () => {
  it("returns null for null input", () => {
    expect(toStorageString(null, "text")).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(toStorageString(undefined, "text")).toBeNull();
  });

  it("converts string → text as-is", () => {
    expect(toStorageString("hello", "text")).toBe("hello");
  });

  it("converts string → string as-is", () => {
    expect(toStorageString("foo", "string")).toBe("foo");
  });

  it("converts number → string", () => {
    expect(toStorageString(42, "number")).toBe("42");
    expect(toStorageString(3.14, "number")).toBe("3.14");
  });

  it("converts boolean true → 'true'", () => {
    expect(toStorageString(true, "boolean")).toBe("true");
  });

  it("converts boolean false → 'false'", () => {
    expect(toStorageString(false, "boolean")).toBe("false");
  });

  it("converts date string as-is", () => {
    expect(toStorageString("2024-01-15", "date")).toBe("2024-01-15");
  });

  it("converts enum value as-is", () => {
    expect(toStorageString("active", "enum")).toBe("active");
  });

  it("converts reference UUID as-is", () => {
    const uuid = "4b81fccf-8cc6-465b-970d-29a155aaf9bc";
    expect(toStorageString(uuid, "reference")).toBe(uuid);
  });

  it("converts reference_data UUID as-is", () => {
    const uuid = "4b81fccf-8cc6-465b-970d-29a155aaf9bc";
    expect(toStorageString(uuid, "reference_data")).toBe(uuid);
  });
});

// ---------------------------------------------------------------------------
// fromStorageString
// ---------------------------------------------------------------------------
describe("fromStorageString", () => {
  it("returns null for null text", () => {
    expect(fromStorageString(null, "text")).toBeNull();
  });

  it("parses text back as string", () => {
    expect(fromStorageString("hello", "text")).toBe("hello");
  });

  it("parses number string back to number", () => {
    expect(fromStorageString("42", "number")).toBe(42);
    expect(fromStorageString("3.14", "number")).toBeCloseTo(3.14);
  });

  it("returns null for non-numeric number string", () => {
    expect(fromStorageString("abc", "number")).toBeNull();
  });

  it("parses 'true' boolean back", () => {
    expect(fromStorageString("true", "boolean")).toBe(true);
  });

  it("parses 'false' boolean back", () => {
    expect(fromStorageString("false", "boolean")).toBe(false);
  });

  it("parses date string back as string", () => {
    expect(fromStorageString("2024-01-15", "date")).toBe("2024-01-15");
  });

  it("parses enum back as string", () => {
    expect(fromStorageString("active", "enum")).toBe("active");
  });

  it("parses reference UUID back as string", () => {
    const uuid = "4b81fccf-8cc6-465b-970d-29a155aaf9bc";
    expect(fromStorageString(uuid, "reference")).toBe(uuid);
  });
});

// ---------------------------------------------------------------------------
// validateAttributeValue
// ---------------------------------------------------------------------------
describe("validateAttributeValue", () => {
  describe("required field checks", () => {
    it("returns invalid for null required attribute", () => {
      const attr = makeAttr({ required: true });
      const result = validateAttributeValue(null, attr);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/required/i);
    });

    it("returns invalid for empty string on required attribute", () => {
      const attr = makeAttr({ required: true });
      const result = validateAttributeValue("", attr);
      expect(result.valid).toBe(false);
    });

    it("returns valid for null on non-required attribute", () => {
      const attr = makeAttr({ required: false });
      const result = validateAttributeValue(null, attr);
      expect(result.valid).toBe(true);
    });
  });

  describe("string type", () => {
    it("accepts a short string", () => {
      const attr = makeAttr({ attributeType: "string" });
      expect(validateAttributeValue("short", attr).valid).toBe(true);
    });

    it("rejects non-string values", () => {
      const attr = makeAttr({ attributeType: "string" });
      expect(validateAttributeValue(123, attr).valid).toBe(false);
    });

    it("rejects strings over 500 chars", () => {
      const attr = makeAttr({ attributeType: "string" });
      expect(validateAttributeValue("x".repeat(501), attr).valid).toBe(false);
    });
  });

  describe("text type", () => {
    it("accepts long text up to 10000 chars", () => {
      const attr = makeAttr({ attributeType: "text" });
      expect(validateAttributeValue("x".repeat(10000), attr).valid).toBe(true);
    });

    it("rejects text over 10000 chars", () => {
      const attr = makeAttr({ attributeType: "text" });
      expect(validateAttributeValue("x".repeat(10001), attr).valid).toBe(false);
    });
  });

  describe("number type", () => {
    it("accepts a numeric value", () => {
      const attr = makeAttr({ attributeType: "number" });
      expect(validateAttributeValue(42, attr).valid).toBe(true);
    });

    it("accepts a numeric string", () => {
      const attr = makeAttr({ attributeType: "number" });
      expect(validateAttributeValue("3.14", attr).valid).toBe(true);
    });

    it("rejects a non-numeric string", () => {
      const attr = makeAttr({ attributeType: "number" });
      expect(validateAttributeValue("not-a-number", attr).valid).toBe(false);
    });

    it("rejects Infinity", () => {
      const attr = makeAttr({ attributeType: "number" });
      expect(validateAttributeValue(Infinity, attr).valid).toBe(false);
    });
  });

  describe("boolean type", () => {
    it("accepts true", () => {
      const attr = makeAttr({ attributeType: "boolean" });
      expect(validateAttributeValue(true, attr).valid).toBe(true);
    });

    it("accepts false", () => {
      const attr = makeAttr({ attributeType: "boolean" });
      expect(validateAttributeValue(false, attr).valid).toBe(true);
    });

    it("accepts string 'true'", () => {
      const attr = makeAttr({ attributeType: "boolean" });
      expect(validateAttributeValue("true", attr).valid).toBe(true);
    });

    it("rejects arbitrary strings", () => {
      const attr = makeAttr({ attributeType: "boolean" });
      expect(validateAttributeValue("yes", attr).valid).toBe(false);
    });
  });

  describe("date type", () => {
    it("accepts a valid ISO date", () => {
      const attr = makeAttr({ attributeType: "date" });
      expect(validateAttributeValue("2024-06-15", attr).valid).toBe(true);
    });

    it("rejects an invalid date string", () => {
      const attr = makeAttr({ attributeType: "date" });
      expect(validateAttributeValue("not-a-date", attr).valid).toBe(false);
    });

    it("rejects non-string values", () => {
      const attr = makeAttr({ attributeType: "date" });
      expect(validateAttributeValue(12345, attr).valid).toBe(false);
    });
  });

  describe("enum type", () => {
    it("accepts a value in the options list", () => {
      const attr = makeAttr({
        attributeType: "enum",
        config: { options: ["active", "inactive"] } as unknown as null,
      });
      expect(validateAttributeValue("active", attr).valid).toBe(true);
    });

    it("rejects a value not in the options list", () => {
      const attr = makeAttr({
        attributeType: "enum",
        config: { options: ["active", "inactive"] } as unknown as null,
      });
      expect(validateAttributeValue("pending", attr).valid).toBe(false);
    });

    it("rejects when no config is present", () => {
      const attr = makeAttr({ attributeType: "enum", config: null });
      expect(validateAttributeValue("active", attr).valid).toBe(false);
    });
  });

  describe("reference type", () => {
    it("accepts a valid UUID", () => {
      const attr = makeAttr({ attributeType: "reference" });
      expect(validateAttributeValue("4b81fccf-8cc6-465b-970d-29a155aaf9bc", attr).valid).toBe(true);
    });

    it("rejects a non-UUID string", () => {
      const attr = makeAttr({ attributeType: "reference" });
      expect(validateAttributeValue("not-a-uuid", attr).valid).toBe(false);
    });
  });

  describe("reference_data type", () => {
    it("accepts a valid UUID", () => {
      const attr = makeAttr({ attributeType: "reference_data" });
      expect(validateAttributeValue("4b81fccf-8cc6-465b-970d-29a155aaf9bc", attr).valid).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// toDisplayString
// ---------------------------------------------------------------------------
describe("toDisplayString", () => {
  it("returns null for null input", () => {
    expect(toDisplayString(null, "text")).toBeNull();
  });

  it("returns 'Yes' for 'true' boolean", () => {
    expect(toDisplayString("true", "boolean")).toBe("Yes");
  });

  it("returns 'No' for 'false' boolean", () => {
    expect(toDisplayString("false", "boolean")).toBe("No");
  });

  it("formats a valid date string", () => {
    const result = toDisplayString("2024-06-15", "date");
    expect(result).toMatch(/2024/);
    expect(result).toMatch(/Jun/);
  });

  it("returns invalid date strings unchanged", () => {
    const result = toDisplayString("not-a-date", "date");
    expect(result).toBe("not-a-date");
  });

  it("returns text values unchanged", () => {
    expect(toDisplayString("hello", "text")).toBe("hello");
  });

  it("returns enum values unchanged", () => {
    expect(toDisplayString("active", "enum")).toBe("active");
  });
});
