import type { AttributeType, SnapshotAttribute } from "@workspace/db";

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
 * Validates an attribute value against its attribute definition.
 * Returns { valid: true } on success, or { valid: false, error: "..." } on failure.
 *
 * Note: reference and reference_data types only validate format here.
 * DB-level existence checks happen in entryService.
 */
export function validateAttributeValue(
  value: unknown,
  attribute: SnapshotAttribute,
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

    case "reference":
    case "reference_data": {
      if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
        return { valid: false, error: `Attribute "${attribute.name}" must be a valid UUID reference` };
      }
      return { valid: true };
    }

    default: {
      const _exhaustive: never = attribute.attributeType;
      return { valid: false, error: `Unknown attribute type: ${String(_exhaustive)}` };
    }
  }
}

/**
 * Formats a stored value as a human-readable display string.
 * Returns null for null/undefined values.
 */
export function toDisplayString(
  valueText: string | null,
  attributeType: AttributeType,
): string | null {
  if (valueText === null || valueText === undefined) return null;

  switch (attributeType) {
    case "boolean":
      return valueText === "true" ? "Yes" : "No";

    case "date": {
      const d = new Date(valueText);
      if (isNaN(d.getTime())) return valueText;
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }

    default:
      return valueText;
  }
}
