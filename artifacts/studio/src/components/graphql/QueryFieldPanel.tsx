import { useState } from "react";
import { X, ChevronRight, ChevronDown, Plus, Layers } from "lucide-react";
import type { SchemaSnapshot, SnapshotTemplate, SnapshotRelationship } from "@/lib/apiClient";
import type { QueryBuilderState, QueryFilter } from "@/graphql/queryBuilder";
import { getScalarAttrs, getOperatorsForType } from "@/graphql/queryBuilder";
import { useQueryBuilderStore } from "@/stores/queryBuilderStore";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QueryFieldPanelProps {
  snapshot: SchemaSnapshot;
  state: QueryBuilderState;
  activePanelTemplateId: string | null;
}

// ---------------------------------------------------------------------------
// FilterRow sub-component
// ---------------------------------------------------------------------------

interface FilterRowProps {
  filter: QueryFilter;
  index: number;
  templateId: string;
  tpl: SnapshotTemplate;
  state: QueryBuilderState;
}

function FilterRow({ filter, index, templateId, tpl, state }: FilterRowProps) {
  const removeFilter = useQueryBuilderStore((s) => s.removeFilter);
  const addFilter = useQueryBuilderStore((s) => s.addFilter);

  const attrs = getScalarAttrs(tpl);
  const selectedSlugs = state.selectedFields[templateId] ?? new Set<string>();
  const availableAttrs = attrs.filter((a) => selectedSlugs.has(a.slug) || a.slug === filter.attributeSlug);

  const currentAttr = attrs.find((a) => a.slug === filter.attributeSlug);
  const operators = currentAttr ? getOperatorsForType(currentAttr.attributeType) : [{ value: "eq", label: "equals" }];

  function updateFilter(partial: Partial<QueryFilter>) {
    const updated = { ...filter, ...partial };
    removeFilter(templateId, index);
    addFilter(templateId, updated);
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Attribute selector */}
      <select
        value={filter.attributeSlug}
        onChange={(e) => updateFilter({ attributeSlug: e.target.value, operator: "eq", value: "" })}
        className="text-xs border border-border rounded px-1.5 py-1 bg-background text-foreground min-w-0 max-w-[100px]"
      >
        {availableAttrs.map((a) => (
          <option key={a.slug} value={a.slug}>
            {a.name}
          </option>
        ))}
      </select>

      {/* Operator selector */}
      <select
        value={filter.operator}
        onChange={(e) => updateFilter({ operator: e.target.value })}
        className="text-xs border border-border rounded px-1.5 py-1 bg-background text-foreground min-w-0 max-w-[90px]"
      >
        {operators.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {/* Value input */}
      {currentAttr?.attributeType === "boolean" ? (
        <select
          value={filter.value}
          onChange={(e) => updateFilter({ value: e.target.value })}
          className="text-xs border border-border rounded px-1.5 py-1 bg-background text-foreground min-w-0 w-16"
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : (
        <input
          type={currentAttr?.attributeType === "number" ? "number" : "text"}
          value={filter.value}
          onChange={(e) => updateFilter({ value: e.target.value })}
          placeholder="value"
          className="text-xs border border-border rounded px-1.5 py-1 bg-background text-foreground min-w-0 flex-1 min-w-[60px] max-w-[100px]"
        />
      )}

      {/* Remove */}
      <button
        onClick={() => removeFilter(templateId, index)}
        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
        title="Remove filter"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function QueryFieldPanel({ snapshot, state, activePanelTemplateId }: QueryFieldPanelProps) {
  const toggleField = useQueryBuilderStore((s) => s.toggleField);
  const selectAllFields = useQueryBuilderStore((s) => s.selectAllFields);
  const clearAllFields = useQueryBuilderStore((s) => s.clearAllFields);
  const expandRelationship = useQueryBuilderStore((s) => s.expandRelationship);
  const collapseRelationship = useQueryBuilderStore((s) => s.collapseRelationship);
  const addFilter = useQueryBuilderStore((s) => s.addFilter);
  const setActivePanelTemplate = useQueryBuilderStore((s) => s.setActivePanelTemplate);
  const [showRelated, setShowRelated] = useState(true);
  const [showFilters, setShowFilters] = useState(true);

  if (!activePanelTemplateId || !state.rootTemplateId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <Layers className="w-12 h-12 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">Click a template node to start building your query</p>
      </div>
    );
  }

  const rootTpl = snapshot.templates.find((t) => t.id === state.rootTemplateId);
  const activeTpl = snapshot.templates.find((t) => t.id === activePanelTemplateId);
  if (!activeTpl || !rootTpl) return null;

  const isShowingLinked = activePanelTemplateId !== state.rootTemplateId;
  const scalarAttrs = getScalarAttrs(activeTpl);
  const selectedSlugs = state.selectedFields[activePanelTemplateId] ?? new Set<string>();
  const filters = state.filters[activePanelTemplateId] ?? [];

  // Relationships for this template (from-side only, same as engine)
  const fromRels: SnapshotRelationship[] = activeTpl.relationships.filter(
    (r) => r.fromTemplateId === activeTpl.id,
  );

  // Depth: root = 0, expanded linked = 1 (max depth 2 means level 1 nodes cannot expand)
  const isAtMaxDepth = isShowingLinked; // depth 1 cannot expand further

  function handleAddFilter() {
    const firstAttr = scalarAttrs.find((a) => selectedSlugs.has(a.slug)) ?? scalarAttrs[0];
    if (!firstAttr) return;
    const operators = getOperatorsForType(firstAttr.attributeType);
    addFilter(activePanelTemplateId!, {
      attributeSlug: firstAttr.slug,
      operator: operators[0]?.value ?? "eq",
      value: "",
    });
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30 shrink-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 mb-1">
          <button
            className="text-xs text-primary hover:underline font-medium"
            onClick={() => setActivePanelTemplate(state.rootTemplateId!)}
          >
            {rootTpl.name}
          </button>
          {isShowingLinked && (
            <>
              <span className="text-xs text-muted-foreground">→</span>
              <span className="text-xs text-foreground font-medium">{activeTpl.name}</span>
            </>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{activeTpl.name}</p>
          <div className="flex gap-1">
            <button
              onClick={() => selectAllFields(activePanelTemplateId)}
              className="text-xs text-primary hover:underline"
            >
              Select All
            </button>
            <span className="text-xs text-muted-foreground">·</span>
            <button
              onClick={() => clearAllFields(activePanelTemplateId)}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Scalar fields */}
        <div className="px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Fields</p>
          <div className="space-y-1">
            {scalarAttrs.map((attr) => {
              const isId = attr.slug === "id";
              const checked = isId || selectedSlugs.has(attr.slug);
              return (
                <label
                  key={attr.slug}
                  className={[
                    "flex items-center gap-2 rounded px-2 py-1.5 transition-colors",
                    isId ? "opacity-60 cursor-not-allowed" : "hover:bg-muted/50 cursor-pointer",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isId}
                    onChange={() => !isId && toggleField(activePanelTemplateId, attr.slug)}
                    className="rounded accent-primary shrink-0"
                  />
                  <span className="text-sm text-foreground flex-1 truncate">{attr.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{attr.attributeType}</span>
                </label>
              );
            })}
            {scalarAttrs.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">No scalar fields defined.</p>
            )}
          </div>
        </div>

        {/* Related section */}
        {fromRels.length > 0 && !isAtMaxDepth && (
          <div className="px-4 py-2 border-t border-border">
            <button
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 hover:text-foreground"
              onClick={() => setShowRelated((v) => !v)}
            >
              {showRelated ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Related Entries
            </button>
            {showRelated && (
              <div className="space-y-1.5">
                {fromRels.map((rel) => {
                  const targetTpl = snapshot.templates.find((t) => t.id === rel.toTemplateId);
                  if (!targetTpl) return null;
                  const isExpanded = state.expandedRelIds.includes(rel.id);
                  return (
                    <div
                      key={rel.id}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-foreground truncate block">{rel.label}</span>
                        <span className="text-xs text-muted-foreground">→ {targetTpl.name}</span>
                      </div>
                      {isExpanded ? (
                        <button
                          onClick={() => collapseRelationship(rel.id)}
                          className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5 shrink-0 hover:bg-muted transition-colors"
                        >
                          ← Collapse
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            expandRelationship(rel.id);
                          }}
                          className="text-xs text-primary hover:text-primary/80 border border-primary/30 rounded px-2 py-0.5 shrink-0 hover:bg-primary/5 transition-colors"
                        >
                          → Expand
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Related section — at max depth, show disabled */}
        {fromRels.length > 0 && isAtMaxDepth && (
          <div className="px-4 py-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Related Entries
            </p>
            {fromRels.map((rel) => (
              <div key={rel.id} className="flex items-center gap-2 px-2 py-1.5 opacity-50">
                <span className="text-sm text-foreground flex-1 truncate">{rel.label}</span>
                <span className="text-xs text-muted-foreground border border-border rounded px-2 py-0.5" title="Maximum query depth reached">
                  Max depth
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Filters section */}
        <div className="px-4 py-3 border-t border-border">
          <button
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 hover:text-foreground"
            onClick={() => setShowFilters((v) => !v)}
          >
            {showFilters ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Filters
          </button>
          {showFilters && (
            <div className="space-y-2">
              {filters.map((f, i) => (
                <FilterRow
                  key={i}
                  filter={f}
                  index={i}
                  templateId={activePanelTemplateId}
                  tpl={activeTpl}
                  state={state}
                />
              ))}
              <button
                onClick={handleAddFilter}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors mt-1"
              >
                <Plus className="w-3 h-3" />
                Add Filter
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
