import { useState } from "react";
import { Copy, ExternalLink, Play, CheckCircle2, AlertCircle } from "lucide-react";

interface LiveQueryPreviewProps {
  generatedQuery: string;
  isRunning: boolean;
  catalogId: string;
  onRun: () => void;
  onOpenInGraphiQL: () => void;
}

export function LiveQueryPreview({
  generatedQuery,
  isRunning,
  catalogId,
  onRun,
  onOpenInGraphiQL,
}: LiveQueryPreviewProps) {
  const [copied, setCopied] = useState(false);

  const isEmpty = !generatedQuery;
  const isValid = !isEmpty;

  async function handleCopy() {
    if (!generatedQuery) return;
    await navigator.clipboard.writeText(generatedQuery);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col h-full border-t border-border bg-muted/20">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5">
          {isEmpty ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <AlertCircle className="w-3 h-3" />
              Click a template node to start
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              Valid query
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            disabled={isEmpty}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-muted-foreground hover:text-foreground"
            title="Copy query"
          >
            <Copy className="w-3 h-3" />
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={onOpenInGraphiQL}
            disabled={isEmpty}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-muted-foreground hover:text-foreground"
            title="Open in GraphiQL tab"
          >
            <ExternalLink className="w-3 h-3" />
            Open in GraphiQL
          </button>
          <button
            onClick={onRun}
            disabled={isEmpty || isRunning}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <Play className="w-3 h-3" />
            {isRunning ? "Running..." : "Run Query"}
          </button>
        </div>
      </div>

      {/* Query text */}
      <div className="flex-1 overflow-auto p-3 min-h-0">
        {isEmpty ? (
          <p className="text-xs text-muted-foreground italic">
            Your generated query will appear here as you build it...
          </p>
        ) : (
          <pre className="text-xs font-mono text-foreground whitespace-pre leading-relaxed">
            {colorizeQuery(generatedQuery)}
          </pre>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Very simple syntax coloring via React spans (no syntax highlighting lib needed)
// ---------------------------------------------------------------------------

function colorizeQuery(query: string): React.ReactNode {
  const lines = query.split("\n");
  return lines.map((line, i) => (
    <span key={i}>
      {colorizeLine(line)}
      {i < lines.length - 1 ? "\n" : ""}
    </span>
  ));
}

function colorizeLine(line: string): React.ReactNode {
  // Keywords: query, where, mutation
  const keyword = /^(\s*)(query|mutation|fragment)\b/;
  if (keyword.test(line)) {
    return (
      <>
        <span className="text-purple-500 dark:text-purple-400 font-semibold">{line.trim()}</span>
      </>
    );
  }

  // Closing braces
  if (/^\s*\}$/.test(line)) {
    return <span className="text-foreground">{line}</span>;
  }

  // Lines with string values in where clause: name: { contains: "x" }
  return (
    <span
      dangerouslySetInnerHTML={{
        __html: line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          // Field names before {
          .replace(
            /^(\s+)([a-z_]+)(\s*\{)/g,
            '$1<span class="text-blue-500 dark:text-blue-400">$2</span>$3',
          )
          // Simple field names (no colon after)
          .replace(
            /^(\s+)([a-z_]+)$/g,
            '$1<span class="text-sky-600 dark:text-sky-400">$2</span>',
          )
          // Operators / keys inside where
          .replace(
            /([a-z_]+)(\s*:)/g,
            '<span class="text-amber-600 dark:text-amber-400">$1</span>$2',
          )
          // String values
          .replace(/"([^"]*)"/g, '<span class="text-emerald-600 dark:text-emerald-400">"$1"</span>')
          // Numeric values
          .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="text-orange-500">$1</span>')
          // Boolean values
          .replace(
            /:\s*(true|false)/g,
            ': <span class="text-rose-500 dark:text-rose-400">$1</span>',
          ),
      }}
    />
  );
}
