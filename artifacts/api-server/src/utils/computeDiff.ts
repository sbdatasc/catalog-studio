import type { SchemaSnapshot, SchemaDiff } from "@workspace/db";

/**
 * computeDiff — pure function, no DB dependencies.
 * Computes the structural diff between two schema snapshots.
 * When oldSnapshot is null (first publish), all items appear as "added".
 */
export function computeDiff(
  oldSnapshot: SchemaSnapshot | null,
  newSnapshot: SchemaSnapshot,
): SchemaDiff {
  const oldTemplates = oldSnapshot?.templates ?? [];
  const newTemplates = newSnapshot.templates;

  const oldTemplateMap = new Map(oldTemplates.map((t) => [t.id, t]));
  const newTemplateMap = new Map(newTemplates.map((t) => [t.id, t]));

  const templatesAdded = newTemplates
    .filter((t) => !oldTemplateMap.has(t.id))
    .map((t) => t.name);

  const templatesRemoved = oldTemplates
    .filter((t) => !newTemplateMap.has(t.id))
    .map((t) => t.name);

  const byTemplate: SchemaDiff["byTemplate"] = {};

  // For templates that exist in both (or only in new when old is null)
  for (const newTpl of newTemplates) {
    const oldTpl = oldTemplateMap.get(newTpl.id);

    const oldSections = oldTpl?.sections ?? [];
    const newSections = newTpl.sections;

    const oldSectionMap = new Map(oldSections.map((s) => [s.id, s]));
    const newSectionMap = new Map(newSections.map((s) => [s.id, s]));

    const sectionsAdded = newSections
      .filter((s) => !oldSectionMap.has(s.id))
      .map((s) => s.name);

    const sectionsRemoved = oldSections
      .filter((s) => !newSectionMap.has(s.id))
      .map((s) => s.name);

    // Collect all attributes
    const oldAttrs = oldSections.flatMap((s) => s.attributes);
    const newAttrs = newSections.flatMap((s) => s.attributes);

    const oldAttrMap = new Map(oldAttrs.map((a) => [a.id, a]));
    const newAttrMap = new Map(newAttrs.map((a) => [a.id, a]));

    const attributesAdded = newAttrs
      .filter((a) => !oldAttrMap.has(a.id))
      .map((a) => ({ name: a.name, type: a.attributeType as string }));

    const attributesRemoved = oldAttrs
      .filter((a) => !newAttrMap.has(a.id))
      .map((a) => ({ name: a.name, type: a.attributeType as string }));

    const attributesModified: SchemaDiff["byTemplate"][string]["attributesModified"] = [];

    for (const newAttr of newAttrs) {
      const oldAttr = oldAttrMap.get(newAttr.id);
      if (!oldAttr) continue;

      // Track required changes
      if (oldAttr.required !== newAttr.required) {
        attributesModified.push({
          name: newAttr.name,
          field: "required",
          from: String(oldAttr.required),
          to: String(newAttr.required),
        });
      }
    }

    const hasChanges =
      sectionsAdded.length > 0 ||
      sectionsRemoved.length > 0 ||
      attributesAdded.length > 0 ||
      attributesRemoved.length > 0 ||
      attributesModified.length > 0;

    if (hasChanges) {
      byTemplate[newTpl.name] = {
        sectionsAdded,
        sectionsRemoved,
        attributesAdded,
        attributesRemoved,
        attributesModified,
      };
    }
  }

  // For templates that were removed — show all their sections/attrs as removed
  for (const oldTpl of oldTemplates) {
    if (!newTemplateMap.has(oldTpl.id)) {
      const sectionsRemoved = oldTpl.sections.map((s) => s.name);
      const attributesRemoved = oldTpl.sections
        .flatMap((s) => s.attributes)
        .map((a) => ({ name: a.name, type: a.attributeType as string }));

      if (sectionsRemoved.length > 0 || attributesRemoved.length > 0) {
        byTemplate[oldTpl.name] = {
          sectionsAdded: [],
          sectionsRemoved,
          attributesAdded: [],
          attributesRemoved,
          attributesModified: [],
        };
      }
    }
  }

  // Relationships
  const oldRels = oldTemplates.flatMap((t) =>
    (t.relationships ?? []).map((r) => ({
      ...r,
      fromTemplateName: t.name,
      toTemplateName: oldTemplates.find((tt) => tt.id === r.toTemplateId)?.name ?? r.toTemplateId,
    })),
  );

  const newRels = newTemplates.flatMap((t) =>
    (t.relationships ?? []).map((r) => ({
      ...r,
      fromTemplateName: t.name,
      toTemplateName: newTemplates.find((tt) => tt.id === r.toTemplateId)?.name ?? r.toTemplateId,
    })),
  );

  const oldRelIds = new Set(oldRels.map((r) => r.id));
  const newRelIds = new Set(newRels.map((r) => r.id));

  const relationshipsAdded = newRels
    .filter((r) => !oldRelIds.has(r.id))
    .map((r) => ({
      from: r.fromTemplateName,
      label: r.label,
      to: r.toTemplateName,
      cardinality: r.cardinality,
    }));

  const relationshipsRemoved = oldRels
    .filter((r) => !newRelIds.has(r.id))
    .map((r) => ({ from: r.fromTemplateName, label: r.label, to: r.toTemplateName }));

  return {
    templatesAdded,
    templatesRemoved,
    byTemplate,
    relationshipsAdded,
    relationshipsRemoved,
  };
}
