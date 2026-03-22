import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowRight, ArrowLeft, ArrowLeftRight, Plus, Trash2, Pencil, GitFork } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSchemaStore } from "@/stores/schemaStore";
import { useUiStore } from "@/stores/uiStore";

interface Props {
  catalogId: string;
  templateId: string;
  isLocked: boolean;
}

const CARDINALITY_COLORS: Record<string, string> = {
  "1:1": "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  "1:N": "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400",
  "M:N": "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
};

function DirectionIcon({ direction }: { direction: "from" | "to" | "both" }) {
  if (direction === "from") return <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />;
  if (direction === "to") return <ArrowLeft className="w-3.5 h-3.5 text-muted-foreground" />;
  return <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground" />;
}

export function TemplateRelationshipsTab({ catalogId, templateId, isLocked }: Props) {
  const { relationshipsByCatalog, relationshipsLoading, fetchRelationships } = useSchemaStore();
  const { openCreateRelDrawer, openEditRelDrawer, openDeleteRelModal } = useUiStore();

  const relsLoading = relationshipsLoading[catalogId] ?? false;
  const allRels = relationshipsByCatalog[catalogId] ?? [];

  const templateRels = allRels.filter(
    (r) => r.fromTemplateId === templateId || r.toTemplateId === templateId,
  );

  useEffect(() => {
    if (!relationshipsByCatalog[catalogId]) {
      fetchRelationships(catalogId);
    }
  }, [catalogId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (relsLoading) {
    return (
      <div className="space-y-3 mt-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 bg-muted/40 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {templateRels.length === 0
              ? "No relationships yet."
              : `${templateRels.length} relationship${templateRels.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isLocked && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => openCreateRelDrawer({ fromTemplateId: templateId })}
              data-testid="btn-add-rel-from-template"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            asChild
            className="text-muted-foreground text-xs"
          >
            <Link href={`/catalogs/${catalogId}/designer/relationships`}>
              <GitFork className="w-3.5 h-3.5 mr-1.5" />
              View Graph
            </Link>
          </Button>
        </div>
      </div>

      {/* Relationship list */}
      {templateRels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-xl text-center">
          <p className="text-muted-foreground text-sm mb-3">
            No relationships defined for this template.
          </p>
          {!isLocked && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openCreateRelDrawer({ fromTemplateId: templateId })}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Relationship
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {templateRels.map((rel) => {
            const isFrom = rel.fromTemplateId === templateId;
            const otherTemplateName = isFrom ? rel.toTemplateName : rel.fromTemplateName;

            return (
              <div
                key={rel.id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card hover:border-border/80 hover:bg-muted/20 transition-colors group"
                data-testid={`rel-row-${rel.id}`}
              >
                {/* Direction icon */}
                <div className="shrink-0">
                  <DirectionIcon direction={rel.direction} />
                </div>

                {/* Label and other template */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{rel.label}</span>
                    <Badge
                      variant="secondary"
                      className={`text-xs font-mono ${CARDINALITY_COLORS[rel.cardinality] ?? ""}`}
                    >
                      {rel.cardinality}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isFrom ? "→" : "←"} {otherTemplateName}
                    {rel.entryLinkCount > 0 && (
                      <span className="ml-2 text-muted-foreground/60">
                        ({rel.entryLinkCount} {rel.entryLinkCount === 1 ? "entry" : "entries"})
                      </span>
                    )}
                  </p>
                </div>

                {/* Actions */}
                {!isLocked && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => openEditRelDrawer(rel.id)}
                      title="Edit relationship"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => openDeleteRelModal(rel.id)}
                      title="Delete relationship"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
