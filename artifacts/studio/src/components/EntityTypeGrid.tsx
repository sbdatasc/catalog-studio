import { useSchemaStore } from "@/stores/schemaStore";
import { useUiStore } from "@/stores/uiStore";
import { EntityTypeCard } from "./EntityTypeCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Plus } from "lucide-react";

export function EntityTypeGrid() {
  const { templates, templatesLoading, templatesError, fetchTemplates } = useSchemaStore();
  const { openCreateDrawer } = useUiStore();

  if (templatesLoading && templates.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-5 h-[160px] flex flex-col">
            <Skeleton className="h-6 w-3/4 mb-4" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-5/6" />
            <div className="mt-auto pt-4 border-t border-border/50">
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (templatesError) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6 flex flex-col items-center justify-center text-center space-y-3 dark:border-amber-900/50 dark:bg-amber-950/20">
        <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-500" />
        <p className="text-amber-800 dark:text-amber-400 font-medium">
          Could not load templates. Please try again.
        </p>
        <Button
          variant="outline"
          onClick={fetchTemplates}
          className="bg-white hover:bg-amber-50 text-amber-900 border-amber-200 dark:bg-black dark:text-amber-400 dark:border-amber-900 dark:hover:bg-amber-950"
          data-testid="button-retry-load"
        >
          Retry
        </Button>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-12 flex flex-col items-center justify-center text-center bg-card/50">
        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
          <Plus className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">No templates defined yet.</h3>
        <p className="text-muted-foreground max-w-sm mb-6">
          Templates define the structure of the data assets in your catalog. Get started by creating your first template.
        </p>
        <Button onClick={openCreateDrawer} data-testid="button-new-template-empty">
          New Template
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
      {templates.map((t) => (
        <EntityTypeCard key={t.id} template={t} />
      ))}
    </div>
  );
}
