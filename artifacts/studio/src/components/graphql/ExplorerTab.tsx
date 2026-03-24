import { useEffect } from "react";
import type { SchemaSnapshot } from "@/lib/apiClient";
import { useQueryBuilderStore } from "@/stores/queryBuilderStore";
import { QueryBuilderCanvas } from "./QueryBuilderCanvas";
import { QueryFieldPanel } from "./QueryFieldPanel";
import { LiveQueryPreview } from "./LiveQueryPreview";
import { QueryResultsPanel } from "./QueryResultsPanel";
import { NoSchemaPublishedBanner } from "@/components/operational/NoSchemaPublishedBanner";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExplorerTabProps {
  catalogId: string;
  snapshot: SchemaSnapshot | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExplorerTab({ catalogId, snapshot }: ExplorerTabProps) {
  const setSnapshot = useQueryBuilderStore((s) => s.setSnapshot);
  const setRootTemplate = useQueryBuilderStore((s) => s.setRootTemplate);
  const setActiveTab = useQueryBuilderStore((s) => s.setActiveTab);
  const setGraphiQLQuery = useQueryBuilderStore((s) => s.setGraphiQLQuery);
  const reset = useQueryBuilderStore((s) => s.reset);

  const state = useQueryBuilderStore((s) => s.state);
  const generatedQuery = useQueryBuilderStore((s) => s.generatedQuery);
  const queryResults = useQueryBuilderStore((s) => s.queryResults);
  const isRunning = useQueryBuilderStore((s) => s.isRunning);
  const runError = useQueryBuilderStore((s) => s.runError);
  const activePanelTemplateId = useQueryBuilderStore((s) => s.activePanelTemplateId);
  const runQuery = useQueryBuilderStore((s) => s.runQuery);

  // Sync snapshot into store whenever it changes
  useEffect(() => {
    setSnapshot(snapshot);
  }, [snapshot, setSnapshot]);

  // Reset builder state when catalog changes
  useEffect(() => {
    reset();
  }, [catalogId, reset]);

  if (!snapshot) {
    return <NoSchemaPublishedBanner catalogId={catalogId} />;
  }

  function handleSetRoot(templateId: string) {
    // Toggle: click the current root to deselect it
    if (state.rootTemplateId === templateId) {
      setRootTemplate(null);
    } else {
      setRootTemplate(templateId);
    }
  }

  function handleOpenInGraphiQL() {
    setGraphiQLQuery(generatedQuery);
    setActiveTab("graphiql");
  }

  function handleRun() {
    runQuery(catalogId);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Main area: canvas (left 60%) + field panel (right 40%) */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Canvas */}
        <div className="flex-[3] min-h-0 relative">
          <QueryBuilderCanvas snapshot={snapshot} state={state} onSetRoot={handleSetRoot} />
        </div>

        {/* Field panel */}
        <div className="flex-[2] min-h-0 border-l border-border overflow-hidden">
          <QueryFieldPanel
            snapshot={snapshot}
            state={state}
            activePanelTemplateId={activePanelTemplateId}
          />
        </div>
      </div>

      {/* Live query preview — fixed height at bottom */}
      <div style={{ height: "200px" }} className="shrink-0 overflow-hidden flex flex-col">
        <LiveQueryPreview
          generatedQuery={generatedQuery}
          isRunning={isRunning}
          catalogId={catalogId}
          onRun={handleRun}
          onOpenInGraphiQL={handleOpenInGraphiQL}
        />
      </div>

      {/* Results panel — expands below preview when results available */}
      <QueryResultsPanel results={queryResults} isRunning={isRunning} runError={runError} />
    </div>
  );
}
