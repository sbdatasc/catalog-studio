import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Search,
  RotateCcw,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/apiClient";
import type {
  EntryListItem,
  SnapshotTemplate,
  SnapshotRelationship,
  BulkLinkResult,
  BulkLinkEntry,
  EntryLinkInstance,
} from "@/lib/apiClient";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BulkLinkSelectedList({ entries }: { entries: EntryListItem[] }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
        Selected entries ({entries.length})
      </p>
      <div className="max-h-36 overflow-y-auto rounded-md border border-border divide-y divide-border">
        {entries.map((e) => (
          <div key={e.id} className="px-3 py-2 text-sm text-foreground">
            {e.displayName}
          </div>
        ))}
      </div>
    </div>
  );
}

function CardinalityWarningBanner({
  relationship,
  conflictCount,
}: {
  relationship: SnapshotRelationship;
  conflictCount: number;
}) {
  if (conflictCount === 0) return null;
  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
      <p className="text-sm text-amber-800">
        {conflictCount} of your selected entries already{" "}
        {conflictCount === 1 ? "has" : "have"} a{" "}
        <span className="font-medium">{relationship.label}</span> link. Those entries will be
        skipped.
      </p>
    </div>
  );
}

function BulkLinkProgress({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
        <span className="text-sm text-foreground">
          Linking {done} of {total}…
        </span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5">
        <div
          className="bg-primary h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}

function ResultSection({
  title,
  icon,
  entries,
  colorClass,
  defaultOpen = false,
  footer,
}: {
  title: string;
  icon: React.ReactNode;
  entries: BulkLinkEntry[];
  colorClass: string;
  defaultOpen?: boolean;
  footer?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen || entries.length > 0);
  if (entries.length === 0) return null;

  return (
    <div className={cn("rounded-md border px-3 py-2", colorClass)}>
      <button
        className="flex items-center gap-2 w-full text-left"
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
        <span className="text-sm font-medium flex-1">
          {title} ({entries.length})
        </span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <ul className="mt-2 space-y-1 ml-6">
          {entries.map((e) => (
            <li key={e.entryId} className="text-sm text-foreground">
              {e.displayName}
              {e.reason && (
                <span className="text-xs text-muted-foreground ml-1">— {e.reason}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {footer && <div className="mt-2 ml-6">{footer}</div>}
    </div>
  );
}

function BulkLinkResultPanel({
  result,
  relationship,
  onRetryFailed,
  retrying,
}: {
  result: BulkLinkResult;
  relationship: SnapshotRelationship;
  onRetryFailed: () => void;
  retrying: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-foreground">
        Operation complete — {result.attempted} attempted
      </p>

      <ResultSection
        title="Linked successfully"
        icon={<CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
        entries={result.succeeded}
        colorClass="border-green-200 bg-green-50"
        defaultOpen
      />

      <ResultSection
        title={`Skipped — ${relationship.label} cardinality`}
        icon={<MinusCircle className="w-4 h-4 text-amber-600 shrink-0" />}
        entries={result.skipped}
        colorClass="border-amber-200 bg-amber-50"
        footer={
          result.skipped.length > 0 ? (
            <p className="text-xs text-amber-700">
              These entries already have a{" "}
              <span className="font-medium">{relationship.label}</span> link. Remove the existing
              link first to link them here.
            </p>
          ) : undefined
        }
      />

      <ResultSection
        title="Failed — unexpected error"
        icon={<XCircle className="w-4 h-4 text-destructive shrink-0" />}
        entries={result.failed}
        colorClass="border-destructive/20 bg-destructive/5"
        footer={
          result.failed.length > 0 ? (
            <p className="text-xs text-destructive/80">
              These entries could not be linked due to an unexpected error. Please try again
              individually.
            </p>
          ) : undefined
        }
      />

      {result.failed.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetryFailed}
          disabled={retrying}
          className="gap-1.5"
          data-testid="retry-failed-button"
        >
          {retrying ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RotateCcw className="w-4 h-4" />
          )}
          Retry Failed ({result.failed.length})
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main BulkLinkDrawer
// ---------------------------------------------------------------------------

interface Props {
  catalogId: string;
  template: SnapshotTemplate;
  selectedEntries: EntryListItem[];
  onClose: () => void;
  onDone: () => void;
}

type DrawerPhase = "form" | "linking" | "result";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export function BulkLinkDrawer({
  catalogId,
  template,
  selectedEntries,
  onClose,
  onDone,
}: Props) {
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<DrawerPhase>("form");
  const [selectedRelId, setSelectedRelId] = useState<string>("");
  const [targetEntry, setTargetEntry] = useState<EntryListItem | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EntryListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<BulkLinkResult | null>(null);
  const [linkingProgress, setLinkingProgress] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [conflictCount, setConflictCount] = useState(0);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  const relationships = template.relationships;
  const selectedRel = relationships.find((r) => r.id === selectedRelId) ?? null;

  // Determine which template to search for targets
  const targetTemplateId = selectedRel?.toTemplateId ?? "";
  const sourceEntryIds = new Set(selectedEntries.map((e) => e.id));

  // Search for target entries
  useEffect(() => {
    if (!selectedRel || !targetTemplateId || debouncedQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    apiClient.entries
      .search(catalogId, targetTemplateId, debouncedQuery, 20)
      .then(({ data }) => {
        if (!cancelled) {
          // Exclude source entries from results
          setSearchResults((data ?? []).filter((e) => !sourceEntryIds.has(e.id)));
          setSearching(false);
        }
      })
      .catch(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, catalogId, targetTemplateId]);

  // Check cardinality conflicts when relationship changes
  const checkConflicts = useCallback(
    async (rel: SnapshotRelationship) => {
      if (rel.cardinality === "M:N") {
        setConflictCount(0);
        return;
      }
      setCheckingConflicts(true);
      try {
        const results = await Promise.allSettled(
          selectedEntries.map((e) => apiClient.entries.getLinks(e.id)),
        );
        let count = 0;
        for (const r of results) {
          if (r.status === "fulfilled" && r.value.data) {
            const hasLink = (r.value.data as EntryLinkInstance[]).some(
              (l) => l.relationshipId === rel.id && l.direction === "from",
            );
            if (hasLink) count++;
          }
        }
        setConflictCount(count);
      } catch {
        setConflictCount(0);
      } finally {
        setCheckingConflicts(false);
      }
    },
    [selectedEntries],
  );

  useEffect(() => {
    if (selectedRel) {
      checkConflicts(selectedRel);
      setTargetEntry(null);
      setQuery("");
      setSearchResults([]);
    } else {
      setConflictCount(0);
    }
  }, [selectedRelId, selectedRel, checkConflicts]);

  async function runBulkLink(fromEntries: EntryListItem[]) {
    if (!selectedRel || !targetEntry) return;

    setPhase("linking");
    setLinkingProgress(0);

    const bulkResult: BulkLinkResult = {
      attempted: fromEntries.length,
      succeeded: [],
      skipped: [],
      failed: [],
    };

    for (let i = 0; i < fromEntries.length; i++) {
      const fromEntry = fromEntries[i];
      setLinkingProgress(i);

      const { data, error } = await apiClient.entries.link(fromEntry.id, {
        relationshipId: selectedRel.id,
        toEntryId: targetEntry.id,
      });

      if (data) {
        bulkResult.succeeded.push({ entryId: fromEntry.id, displayName: fromEntry.displayName });
      } else if (error) {
        const isConflict =
          error.code === "CONFLICT" || (error.details as { code?: string } | null)?.code === "CONFLICT";
        if (isConflict) {
          bulkResult.skipped.push({
            entryId: fromEntry.id,
            displayName: fromEntry.displayName,
            reason: error.message,
          });
        } else {
          bulkResult.failed.push({
            entryId: fromEntry.id,
            displayName: fromEntry.displayName,
            reason: error.message ?? "Unexpected error",
          });
        }
      }
    }

    setLinkingProgress(fromEntries.length);
    bulkResult.attempted = fromEntries.length;
    setResult(bulkResult);
    setPhase("result");
  }

  async function handleConfirm() {
    await runBulkLink(selectedEntries);
  }

  async function handleRetryFailed() {
    if (!result || result.failed.length === 0) return;
    setRetrying(true);

    const failedEntries: EntryListItem[] = result.failed
      .map((fe) => selectedEntries.find((e) => e.id === fe.entryId))
      .filter(Boolean) as EntryListItem[];

    // Re-run just the failed ones and merge
    const prev = result;
    setPhase("linking");
    setLinkingProgress(0);

    const retryResult: BulkLinkResult = {
      attempted: failedEntries.length,
      succeeded: [],
      skipped: [],
      failed: [],
    };

    for (let i = 0; i < failedEntries.length; i++) {
      const fromEntry = failedEntries[i];
      setLinkingProgress(i);
      const { data, error } = await apiClient.entries.link(fromEntry.id, {
        relationshipId: selectedRel!.id,
        toEntryId: targetEntry!.id,
      });
      if (data) {
        retryResult.succeeded.push({ entryId: fromEntry.id, displayName: fromEntry.displayName });
      } else if (error) {
        const isConflict =
          error.code === "CONFLICT" || (error.details as { code?: string } | null)?.code === "CONFLICT";
        if (isConflict) {
          retryResult.skipped.push({ entryId: fromEntry.id, displayName: fromEntry.displayName, reason: error.message });
        } else {
          retryResult.failed.push({ entryId: fromEntry.id, displayName: fromEntry.displayName, reason: error.message });
        }
      }
    }

    // Merge: replace old failed with retry outcomes
    const merged: BulkLinkResult = {
      attempted: prev.attempted,
      succeeded: [...prev.succeeded, ...retryResult.succeeded],
      skipped: [...prev.skipped, ...retryResult.skipped],
      failed: retryResult.failed,
    };

    setLinkingProgress(failedEntries.length);
    setResult(merged);
    setPhase("result");
    setRetrying(false);
  }

  const canConfirm = !!selectedRel && !!targetEntry && phase === "form";
  const title =
    phase === "result"
      ? "Bulk Link Results"
      : `Link ${selectedEntries.length} ${selectedEntries.length === 1 ? "entry" : "entries"} to…`;

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && phase !== "linking") onClose();
      }}
    >
      <SheetContent
        className="w-[460px] sm:max-w-[460px] p-0 flex flex-col border-l border-border bg-card"
        onInteractOutside={(e) => {
          if (phase === "linking") e.preventDefault();
          else onClose();
        }}
        onEscapeKeyDown={(e) => {
          if (phase === "linking") e.preventDefault();
          else onClose();
        }}
      >
        <SheetHeader className="px-6 py-4 border-b border-border/50">
          <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* FORM PHASE */}
          {phase === "form" && (
            <>
              <BulkLinkSelectedList entries={selectedEntries} />

              {/* Relationship selector */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-2">
                  Relationship
                </label>
                {relationships.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No relationships defined for this template.
                  </p>
                ) : (
                  <Select
                    value={selectedRelId}
                    onValueChange={setSelectedRelId}
                    data-testid="relationship-selector"
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a relationship…" />
                    </SelectTrigger>
                    <SelectContent>
                      {relationships.map((rel) => (
                        <SelectItem key={rel.id} value={rel.id}>
                          {rel.label}{" "}
                          <span className="text-muted-foreground text-xs ml-1">
                            ({rel.cardinality})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Cardinality warning */}
              {selectedRel && !checkingConflicts && conflictCount > 0 && (
                <CardinalityWarningBanner
                  relationship={selectedRel}
                  conflictCount={conflictCount}
                />
              )}

              {/* Target search */}
              {selectedRel && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-2">
                    Target entry
                  </label>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search entries… (min 2 chars)"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setTargetEntry(null);
                      }}
                      data-testid="target-search-input"
                    />
                  </div>

                  {targetEntry && (
                    <div className="mb-2 px-3 py-2 rounded-md bg-primary/10 border border-primary/30 text-sm font-medium text-primary">
                      ✓ {targetEntry.displayName}
                    </div>
                  )}

                  <div className="min-h-[80px] max-h-[200px] overflow-y-auto rounded-md border border-border">
                    {searching ? (
                      <div className="flex items-center justify-center h-16">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : query.length < 2 ? (
                      <div className="flex items-center justify-center h-16 text-sm text-muted-foreground">
                        Type at least 2 characters to search
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="flex items-center justify-center h-16 text-sm text-muted-foreground">
                        No entries found
                      </div>
                    ) : (
                      <ul className="divide-y divide-border">
                        {searchResults.map((entry) => (
                          <li key={entry.id}>
                            <button
                              className={cn(
                                "w-full text-left px-4 py-2.5 text-sm transition-colors",
                                targetEntry?.id === entry.id
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "hover:bg-muted/50",
                              )}
                              onClick={() => setTargetEntry(entry)}
                            >
                              {entry.displayName}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* LINKING PHASE */}
          {phase === "linking" && (
            <BulkLinkProgress done={linkingProgress} total={selectedEntries.length} />
          )}

          {/* RESULT PHASE */}
          {phase === "result" && result && selectedRel && (
            <BulkLinkResultPanel
              result={result}
              relationship={selectedRel}
              onRetryFailed={handleRetryFailed}
              retrying={retrying}
            />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 flex justify-end gap-3">
          {phase === "form" && (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!canConfirm}
                data-testid="confirm-bulk-link-button"
              >
                Link {selectedEntries.length}{" "}
                {selectedEntries.length === 1 ? "Entry" : "Entries"}
              </Button>
            </>
          )}

          {phase === "linking" && (
            <Button variant="outline" disabled>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Linking…
            </Button>
          )}

          {phase === "result" && (
            <Button onClick={onDone} data-testid="bulk-link-done-button">
              Done
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
