import type { FieldType, SnapshotField, SchemaSnapshot } from "@workspace/db";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Converts a JavaScript value to its storage string representation.
 * Returns null when value is null/undefined (field not filled in).
 */
export function toStorageString(
  value: unknown,
  fieldType: FieldType,
): string | null {
  if (value === null || value === undefined) return null;

  switch (fieldType) {
    case "string":
    case "text":
    case "date":
    case "enum":
    case "reference":
      return String(value);

    case "number":
      return String(value);

    case "boolean":
      return value ? "true" : "false";

    default: {
      const _exhaustive: never = fieldType;
      throw new Error(`Unknown field type: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Converts a stored string value back to the correct JavaScript type.
 * Returns null for null input (field was not filled in).
 */
export function fromStorageString(
  text: string | null,
  fieldType: FieldType,
): unknown {
  if (text === null) return null;

  switch (fieldType) {
    case "string":
    case "text":
    case "date":
    case "enum":
    case "reference":
      return text;

    case "number": {
      const n = parseFloat(text);
      return isNaN(n) ? null : n;
    }

    case "boolean":
      return text === "true";

    default: {
      const _exhaustive: never = fieldType;
      throw new Error(`Unknown field type: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Validates a field value against its field definition and the published schema.
 * Returns { valid: true } on success, or { valid: false, error: "..." } on failure.
 */
export function validateFieldValue(
  value: unknown,
  field: SnapshotField,
  _publishedSchema: SchemaSnapshot,
): ValidationResult {
  // Null check for required fields
  if (value === null || value === undefined || value === "") {
    if (field.required) {
      return { valid: false, error: `Field "${field.name}" is required` };
    }
    return { valid: true };
  }

  switch (field.fieldType) {
    case "string": {
      if (typeof value !== "string") {
        return { valid: false, error: `Field "${field.name}" must be a string` };
      }
      if (value.length > 500) {
        return {
          valid: false,
          error: `Field "${field.name}" exceeds max length of 500 characters`,
        };
      }
      return { valid: true };
    }

    case "text": {
      if (typeof value !== "string") {
        return { valid: false, error: `Field "${field.name}" must be a string` };
      }
      if (value.length > 10000) {
        return {
          valid: false,
          error: `Field "${field.name}" exceeds max length of 10000 characters`,
        };
      }
      return { valid: true };
    }

    case "number": {
      const n = typeof value === "string" ? parseFloat(value) : value;
      if (typeof n !== "number" || !isFinite(n)) {
        return {
          valid: false,
          error: `Field "${field.name}" must be a valid number`,
        };
      }
      return { valid: true };
    }

    case "boolean": {
      if (value !== true && value !== false && value !== "true" && value !== "false") {
        return {
          valid: false,
          error: `Field "${field.name}" must be a boolean`,
        };
      }
      return { valid: true };
    }

    case "date": {
      if (typeof value !== "string") {
        return {
          valid: false,
          error: `Field "${field.name}" must be an ISO 8601 date string`,
        };
      }
      const d = new Date(value);
      if (isNaN(d.getTime())) {
        return {
          valid: false,
          error: `Field "${field.name}" must be a valid ISO 8601 date`,
        };
      }
      return { valid: true };
    }

    case "enum": {
      const config = field.config as { options: string[] } | null;
      if (!config?.options) {
        return { valid: false, error: `Field "${field.name}" has no enum options configured` };
      }
      if (!config.options.includes(String(value))) {
        return {
          valid: false,
          error: `Field "${field.name}" must be one of: ${config.options.join(", ")}`,
        };
      }
      return { valid: true };
    }

    case "reference": {
      if (typeof value !== "string" || !/^[0-9a-f-]{36}$/.test(value)) {
        return {
          valid: false,
          error: `Field "${field.name}" must be a valid UUID reference`,
        };
      }
      return { valid: true };
    }

    default: {
      const _exhaustive: never = field.fieldType;
      return {
        valid: false,
        error: `Unknown field type: ${String(_exhaustive)}`,
      };
    }
  }
}
