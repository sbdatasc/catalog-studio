import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// AttributeType enum — complete set of MVP attribute types
// ---------------------------------------------------------------------------

export type AttributeType = (typeof AttributeType)[keyof typeof AttributeType];
export const AttributeType = {
  STRING: "string",
  TEXT: "text",
  NUMBER: "number",
  BOOLEAN: "boolean",
  DATE: "date",
  ENUM: "enum",
  REFERENCE: "reference",
  REFERENCE_DATA: "reference_data",
} as const;

export const AttributeTypeValues = Object.values(AttributeType) as [
  string,
  ...string[],
];

// ---------------------------------------------------------------------------
// Config Zod schemas — validated at write time in templateService
// ---------------------------------------------------------------------------

export const EnumAttributeConfigSchema = z.object({
  attributeType: z.literal("enum"),
  config: z.object({ options: z.array(z.string()).min(1) }),
});

export const ReferenceAttributeConfigSchema = z.object({
  attributeType: z.literal("reference"),
  config: z.object({ targetTemplateId: z.string().uuid() }),
});

// PRD-02 Amendment v2: reference_data config now uses targetTemplateId (not referenceDatasetId)
export const ReferenceDataAttributeConfigSchema = z.object({
  attributeType: z.literal("reference_data"),
  config: z.object({ targetTemplateId: z.string().uuid() }),
});

export const SimpleAttributeConfigSchema = z.object({
  attributeType: z.enum(["string", "text", "number", "boolean", "date"]),
  config: z.null(),
});

export const AttributeConfigSchema = z.discriminatedUnion("attributeType", [
  EnumAttributeConfigSchema,
  ReferenceAttributeConfigSchema,
  ReferenceDataAttributeConfigSchema,
  SimpleAttributeConfigSchema,
]);

export type AttributeConfig =
  | { options: string[] }
  | { targetTemplateId: string }
  | null;

// ---------------------------------------------------------------------------
// Schema snapshot types — v2 shape (PRD-02 Amendment v2)
// ---------------------------------------------------------------------------

export interface SnapshotAttribute {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  attributeType: AttributeType;
  required: boolean;
  displayOrder: number;
  config: AttributeConfig;
}

export interface SnapshotSection {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
  attributes: SnapshotAttribute[];
}

export interface SnapshotRelationship {
  id: string;
  fromTemplateId: string;
  toTemplateId: string;
  label: string;
  cardinality: "1:1" | "1:N" | "M:N";
  direction: "from" | "to" | "both";
}

export interface SnapshotTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystemSeed: boolean;
  isReferenceData: boolean;
  sections: SnapshotSection[];
  relationships: SnapshotRelationship[];
}

// SchemaSnapshot v2 — includes catalogId/catalogName, no referenceDatasetsSnapshot
export interface SchemaSnapshot {
  version: number;
  publishedAt: string;
  catalogId: string;
  catalogName: string;
  templates: SnapshotTemplate[];
}
