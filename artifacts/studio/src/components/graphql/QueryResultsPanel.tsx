import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useState } from "react";

interface QueryResultsPanelProps {
  results: unknown | null;
  isRunning: boolean;
  runError: string | null;
}

export function QueryResultsPanel({ results, isRunning, runError }: QueryResultsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const hasResults = results !== null;
  const visible = isRunning || hasResults || runError;
  if (!visible) return null;

  // Count entries in the results (top-level array values)
  let entryCount: number | null = null;
  if (hasResults && results && typeof results === "object") {
    const vals = Object.values(results as Record<string, unknown>);
    if (vals.length > 0 && Array.isArray(vals[0])) {
      entryCount = (vals[0] as unknown[]).length;
    }
  }

  return (
    <div className="border-t border-border bg-background shrink-0" style={{ maxHeight: "300px" }}>
      {/* Results toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">Results</span>
          {isRunning && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Running query...
            </span>
          )}
          {!isRunning && runError && (
            <span className="text-xs text-destructive">{runError}</span>
          )}
          {!isRunning && !runError && entryCount !== null && (
            <span className="text-xs text-muted-foreground">
              Returned {entryCount} {entryCount === 1 ? "entry" : "entries"}.
            </span>
          )}
          {!isRunning && !runError && hasResults && entryCount === 0 && (
            <span className="text-xs text-muted-foreground">No results returned.</span>
          )}
        </div>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="overflow-auto p-3" style={{ maxHeight: "252px" }}>
          {isRunning && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}
          {!isRunning && runError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive font-mono">
              {runError}
            </div>
          )}
          {!isRunning && !runError && hasResults && (
            <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all leading-relaxed">
              {JSON.stringify(results, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
