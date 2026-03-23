import type { SchemaSnapshot } from "@/lib/apiClient";

export function getCompatibleTemplateIds(
  sourceTemplateId: string,
  snapshot: SchemaSnapshot,
): string[] {
  const compatible = new Set<string>();
  for (const template of snapshot.templates) {
    for (const rel of template.relationships) {
      if (rel.fromTemplateId === sourceTemplateId && rel.toTemplateId !== sourceTemplateId) {
        compatible.add(rel.toTemplateId);
      } else if (rel.toTemplateId === sourceTemplateId && rel.fromTemplateId !== sourceTemplateId) {
        compatible.add(rel.fromTemplateId);
      }
    }
  }
  return Array.from(compatible);
}
