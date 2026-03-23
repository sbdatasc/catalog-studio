import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { SchemaSnapshot } from "@/lib/apiClient";
import { generateExampleQueries } from "@/graphql/exampleQueries";

interface Props {
  schema: SchemaSnapshot;
  onSelect: (query: string) => void;
}

export function ExampleQueriesPanel({ schema, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false);
  const examples = generateExampleQueries(schema);

  if (!examples.length) return null;

  return (
    <div className="border-b border-border bg-muted/30 shrink-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="h-12 px-4 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left"
        data-testid="examples-toggle"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        Examples
      </button>
      {expanded && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {examples.map((ex, i) => (
            <button
              key={i}
              onClick={() => {
                onSelect(ex.query);
                setExpanded(false);
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-card border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
              data-testid={`example-query-${i}`}
            >
              {ex.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
