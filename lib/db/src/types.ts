import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// FieldType enum — the complete set of MVP field types (no additions without a new PRD)
// ---------------------------------------------------------------------------

export type FieldType = (typeof FieldType)[keyof typeof FieldType];
export const FieldType = {
  STRING: "string",
  TEXT: "text",
  NUMBER: "number",
  BOOLEAN: "boolean",
  DATE: "date",
  ENUM: "enum",
  REFERENCE: "reference",
} as const;

export const FieldTypeValues = Object.values(FieldType) as [
  string,
  ...string[],
];

// ---------------------------------------------------------------------------
// Config Zod schemas — validated at write time in schemaService
// ---------------------------------------------------------------------------

export const EnumFieldConfigSchema = z.object({
  fieldType: z.literal("enum"),
  config: z.object({ options: z.array(z.string()).min(1) }),
});

export const ReferenceFieldConfigSchema = z.object({
  fieldType: z.literal("reference"),
  config: z.object({ targetEntityTypeId: z.string().uuid() }),
});

export const SimpleFieldConfigSchema = z.object({
  fieldType: z.enum(["string", "text", "number", "boolean", "date"]),
  config: z.null(),
});

export const FieldConfigSchema = z.discriminatedUnion("fieldType", [
  EnumFieldConfigSchema,
  ReferenceFieldConfigSchema,
  SimpleFieldConfigSchema,
]);

export type FieldConfig =
  | { options: string[] }
  | { targetEntityTypeId: string }
  | null;

// ---------------------------------------------------------------------------
// Schema snapshot types — the immutable publish snapshot shape
// ---------------------------------------------------------------------------

export interface SnapshotField {
  id: string;
  name: string;
  slug: string;
  fieldType: FieldType;
  required: boolean;
  displayOrder: number;
  config: FieldConfig;
}

export interface SnapshotRelationship {
  id: string;
  toEntityTypeId: string;
  fromEntityTypeId: string;
  label: string;
  cardinality: "1:1" | "1:N" | "M:N";
  direction: "from" | "to" | "both";
}

export interface SnapshotEntityType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  fields: SnapshotField[];
  relationships: SnapshotRelationship[];
}

export interface SchemaSnapshot {
  version: number;
  publishedAt: string;
  entityTypes: SnapshotEntityType[];
}
