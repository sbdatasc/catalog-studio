import type { SchemaSnapshot } from "@workspace/db";
import type { getDb } from "../db/connection";

export type DbClient = ReturnType<typeof getDb>;

export interface SlugMap {
  templateSlugToId: Record<string, string>;
  templateIdToSlug: Record<string, string>;
  attributeSlugToId: Record<string, Record<string, string>>;
  attributeIdToType: Record<string, string>;
  attributeIdToConfig: Record<string, Record<string, unknown>>;
}

export interface ResolvedEntry {
  id: string;
  displayName: string | null;
  templateId: string;
  fieldValues: Array<{ attributeId: string; value: string | null }>;
}

export interface GraphQLContext {
  db: DbClient;
  snapshot: SchemaSnapshot;
  slugMap: SlugMap;
  depth: number;
  catalogId: string;
}
