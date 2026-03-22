import type { AttributeType, SnapshotAttribute, SchemaSnapshot } from "@workspace/db";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Converts a JavaScript value to its storage string representation.
 * Returns null when value is null/undefined (attribute not filled in).
 */
export function toStorageString(
  value: unknown,
  attributeType: AttributeType,
): string | null {
  if (value === null || value === undefined) return null;

  switch (attributeType) {
    case "string":
    case "text":
    case "date":
    case "enum":
    case "reference":
    case "reference_data":
      return String(value);

    case "number":
      return String(value);

    case "boolean":
      return value ? "true" : "false";

    default: {
      const _exhaustive: never = attributeType;
      throw new Error(`Unknown attribute type: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Converts a stored string value back to the correct JavaScript type.
 * Returns null for null input (attribute was not filled in).
 */
export function fromStorageString(
  text: string | null,
  attributeType: AttributeType,
): unknown {
  if (text === null) return null;

  switch (attributeType) {
    case "string":
    case "text":
    case "date":
    case "enum":
    case "reference":
    case "reference_data":
      return text;

    case "number": {
      const n = parseFloat(text);
      return isNaN(n) ? null : n;
    }

    case "boolean":
      return text === "true";

    default: {
      const _exhaustive: never = attributeType;
      throw new Error(`Unknown attribute type: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Validates an attribute value against its attribute definition and the published schema.
 * Returns { valid: true } on success, or { valid: false, error: "..." } on failure.
 */
export function validateAttributeValue(
  value: unknown,
  attribute: SnapshotAttribute,
  publishedSchema: SchemaSnapshot,
): ValidationResult {
  // Null check for required attributes
  if (value === null || value === undefined || value === "") {
    if (attribute.required) {
      return { valid: false, error: `Attribute "${attribute.name}" is required` };
    }
    return { valid: true };
  }

  switch (attribute.attributeType) {
    case "string": {
      if (typeof value !== "string") {
        return { valid: false, error: `Attribute "${attribute.name}" must be a string` };
      }
      if (value.length > 500) {
        return { valid: false, error: `Attribute "${attribute.name}" exceeds max length of 500 characters` };
      }
      return { valid: true };
    }

    case "text": {
      if (typeof value !== "string") {
        return { valid: false, error: `Attribute "${attribute.name}" must be a string` };
      }
      if (value.length > 10000) {
        return { valid: false, error: `Attribute "${attribute.name}" exceeds max length of 10000 characters` };
      }
      return { valid: true };
    }

    case "number": {
      const n = typeof value === "string" ? parseFloat(value) : value;
      if (typeof n !== "number" || !isFinite(n)) {
        return { valid: false, error: `Attribute "${attribute.name}" must be a valid number` };
      }
      return { valid: true };
    }

    case "boolean": {
      if (value !== true && value !== false && value !== "true" && value !== "false") {
        return { valid: false, error: `Attribute "${attribute.name}" must be a boolean` };
      }
      return { valid: true };
    }

    case "date": {
      if (typeof value !== "string") {
        return { valid: false, error: `Attribute "${attribute.name}" must be an ISO 8601 date string` };
      }
      const d = new Date(value);
      if (isNaN(d.getTime())) {
        return { valid: false, error: `Attribute "${attribute.name}" must be a valid ISO 8601 date` };
      }
      return { valid: true };
    }

    case "enum": {
      const config = attribute.config as { options: string[] } | null;
      if (!config?.options) {
        return { valid: false, error: `Attribute "${attribute.name}" has no enum options configured` };
      }
      if (!config.options.includes(String(value))) {
        return {
          valid: false,
          error: `Attribute "${attribute.name}" must be one of: ${config.options.join(", ")}`,
        };
      }
      return { valid: true };
    }

    case "reference": {
      if (typeof value !== "string" || !/^[0-9a-f-]{36}$/.test(value)) {
        return { valid: false, error: `Attribute "${attribute.name}" must be a valid UUID reference` };
      }
      return { valid: true };
    }

    case "reference_data": {
      // Validate value is a string that exists in the reference dataset's active values
      if (typeof value !== "string") {
        return { valid: false, error: `Attribute "${attribute.name}" must be a string (reference data value)` };
      }
      const config = attribute.config as { referenceDatasetId: string } | null;
      if (!config?.referenceDatasetId) {
        return { valid: false, error: `Attribute "${attribute.name}" has no reference dataset configured` };
      }
      // Look up the dataset in the snapshot
      const dataset = publishedSchema.referenceDatasetsSnapshot.find(
        (d) => d.id === config.referenceDatasetId,
      );
      if (!dataset) {
        return { valid: false, error: `Reference dataset for attribute "${attribute.name}" not found in snapshot` };
      }
      const activeValues = dataset.values.filter((v) => v.isActive);
      if (!activeValues.some((v) => v.value === value)) {
        return {
          valid: false,
          error: `Attribute "${attribute.name}" must be one of the active reference values: ${activeValues.map((v) => v.value).join(", ")}`,
        };
      }
      return { valid: true };
    }

    default: {
      const _exhaustive: never = attribute.attributeType;
      return { valid: false, error: `Unknown attribute type: ${String(_exhaustive)}` };
    }
  }
}
