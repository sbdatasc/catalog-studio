import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, XCircle, Loader2, ArrowRight, Clock, ChevronDown, ChevronRight, GitBranch, Plus, Minus, Edit2, UserCheck } from "lucide-react";
import { DesignerNav } from "@/components/DesignerNav";
import { usePublishStore } from "@/stores/publishStore";
import { usePermissions } from "@/hooks/usePermissions";
import type { SchemaVersion, SchemaDiff, ChecklistCheck } from "@/lib/apiClient";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function diffIsEmpty(diff: SchemaDiff | null): boolean {
  if (!diff) return true;
  return (
    diff.templatesAdded.length === 0 &&
    diff.templatesRemoved.length === 0 &&
    diff.relationshipsAdded.length === 0 &&
    diff.relationshipsRemoved.length === 0 &&
    Object.keys(diff.byTemplate).length === 0
  );
}

// ---------------------------------------------------------------------------
// Checklist item
// ---------------------------------------------------------------------------

function ChecklistItem({ check, onNav }: { check: ChecklistCheck; onNav?: (route: string) => void }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-0.5 flex-shrink-0">
        {check.passing ? (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        ) : (
          <XCircle className="w-5 h-5 text-destructive" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={["text-sm font-medium", check.passing ? "text-foreground" : "text-destructive"].join(" ")}>
          {check.message}
        </p>
      </div>
      {!check.passing && check.navRoute && onNav && (
        <button
          onClick={() => onNav(check.navRoute!)}
          className="flex-shrink-0 flex items-center gap-1 text-xs text-primary hover:underline font-medium"
          data-testid={`checklist-fix-${check.id}`}
        >
          Fix <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirm modal
// ---------------------------------------------------------------------------

function ConfirmPublishModal({
  open,
  onClose,
  onConfirm,
  publishing,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  publishing: boolean;
  error: string | null;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-xl shadow-xl border border-border w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-foreground mb-2">Publish Schema</h2>
        <p className="text-sm text-muted-foreground mb-4">
          This will create a new schema version. Any entries will have their field values migrated
          to the new schema. This action cannot be undone.
        </p>
        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={publishing}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={publishing}
            data-testid="confirm-publish-btn"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {publishing && <Loader2 className="w-4 h-4 animate-spin" />}
            {publishing ? "Publishing…" : "Publish Schema"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diff panel
// ---------------------------------------------------------------------------

function DiffSection({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-2">
      <p className={["text-xs font-semibold uppercase tracking-wide mb-1", color].join(" ")}>{label}</p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item} className="text-xs text-foreground font-mono px-2">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DiffPanel({ diff, loading }: { diff: SchemaDiff | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!diff) return <p className="text-sm text-muted-foreground py-4">No diff available.</p>;
  if (diffIsEmpty(diff)) return <p className="text-sm text-muted-foreground py-4">No schema changes in this version.</p>;

  return (
    <div className="space-y-4">
      {diff.templatesAdded.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-3">
          <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1 flex items-center gap-1">
            <Plus className="w-3 h-3" /> Templates Added
          </p>
          {diff.templatesAdded.map((n) => <p key={n} className="text-xs font-mono text-green-800 dark:text-green-300">{n}</p>)}
        </div>
      )}
      {diff.templatesRemoved.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide mb-1 flex items-center gap-1">
            <Minus className="w-3 h-3" /> Templates Removed
          </p>
          {diff.templatesRemoved.map((n) => <p key={n} className="text-xs font-mono text-red-800 dark:text-red-300">{n}</p>)}
        </div>
      )}
      {Object.entries(diff.byTemplate).map(([templateName, changes]) => (
        <div key={templateName} className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5 text-primary" /> {templateName}
          </p>
          <DiffSection label="Sections Added" items={changes.sectionsAdded} color="text-green-600 dark:text-green-400" />
          <DiffSection label="Sections Removed" items={changes.sectionsRemoved} color="text-red-600 dark:text-red-400" />
          {changes.attributesAdded.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-600 dark:text-green-400 mb-1">
                Attributes Added
              </p>
              {changes.attributesAdded.map((a) => (
                <p key={a.name} className="text-xs font-mono text-foreground px-2">
                  {a.name} <span className="text-muted-foreground">({a.type})</span>
                </p>
              ))}
            </div>
          )}
          {changes.attributesRemoved.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 mb-1">
                Attributes Removed
              </p>
              {changes.attributesRemoved.map((a) => (
                <p key={a.name} className="text-xs font-mono text-foreground px-2">
                  {a.name} <span className="text-muted-foreground">({a.type})</span>
                </p>
              ))}
            </div>
          )}
          {changes.attributesModified.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-yellow-600 dark:text-yellow-400 mb-1 flex items-center gap-1">
                <Edit2 className="w-3 h-3" /> Attributes Modified
              </p>
              {changes.attributesModified.map((m) => (
                <p key={`${m.name}-${m.field}`} className="text-xs font-mono text-foreground px-2">
                  {m.name}.{m.field}: <span className="text-red-600 line-through">{m.from}</span>{" "}
                  <span className="text-green-600">{m.to}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
      {diff.relationshipsAdded.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-3">
          <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">
            Relationships Added
          </p>
          {diff.relationshipsAdded.map((r, i) => (
            <p key={i} className="text-xs font-mono text-green-800 dark:text-green-300">
              {r.from} —[{r.label}]→ {r.to} ({r.cardinality})
            </p>
          ))}
        </div>
      )}
      {diff.relationshipsRemoved.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide mb-1">
            Relationships Removed
          </p>
          {diff.relationshipsRemoved.map((r, i) => (
            <p key={i} className="text-xs font-mono text-red-800 dark:text-red-300">
              {r.from} —[{r.label}]→ {r.to}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Version history row
// ---------------------------------------------------------------------------

function VersionRow({ version, selected, onSelect }: { version: SchemaVersion; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      data-testid={`version-row-${version.versionNumber}`}
      className={[
        "w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-muted/50",
        selected ? "bg-primary/5 border-l-2 border-primary" : "border-l-2 border-transparent",
      ].join(" ")}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">v{version.versionNumber}</span>
          {version.isCurrent && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
              Current
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDate(version.publishedAt)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">{version.entryCount} entries</p>
      </div>
      {selected ? (
        <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      ) : (
        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main PublishPage
// ---------------------------------------------------------------------------

export function PublishPage({ catalogId }: { catalogId: string }) {
  const [, navigate] = useLocation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const {
    checklist,
    checklistLoading,
    fetchChecklist,
    currentVersion,
    fetchCurrentVersion,
    history,
    historyLoading,
    fetchHistory,
    selectedVersionId,
    selectedDiff,
    diffLoading,
    selectVersion,
    publish,
    publishing,
    publishError,
    reset,
  } = usePublishStore();

  const { canPublishSchema, role } = usePermissions(catalogId);

  useEffect(() => {
    if (role === "api_consumer") {
      navigate(`/catalogs/${catalogId}/graphql`, { replace: true });
    }
  }, [role, catalogId, navigate]);

  useEffect(() => {
    reset();
    fetchChecklist(catalogId);
    fetchCurrentVersion(catalogId);
    fetchHistory(catalogId);
  }, [catalogId]);

  const handlePublish = async () => {
    const result = await publish(catalogId);
    if (result) {
      setConfirmOpen(false);
    }
  };

  const handleNavToFix = (route: string) => {
    navigate(route);
  };

  const allPassing = checklist?.allPassing ?? false;

  return (
    <>
      <div className="flex flex-col h-screen bg-background overflow-hidden">
        <DesignerNav catalogId={catalogId} tab="publish" />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Publish Schema</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Create a versioned snapshot of the current schema for use by the catalog entry engine.
                </p>
              </div>
              {currentVersion && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Current Version</p>
                  <p className="text-lg font-bold text-foreground">v{currentVersion.versionNumber}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(currentVersion.publishedAt)}</p>
                </div>
              )}
            </div>

            {/* Role lock banner for non-publishers */}
            {!canPublishSchema && (
              <div className="flex items-center gap-3 px-5 py-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800/50 dark:text-blue-300">
                <UserCheck className="w-4 h-4 shrink-0" />
                <p className="text-sm">
                  <span className="font-medium capitalize">Your role on this catalog is {role ?? "unknown"}.</span>{" "}
                  You have read-only access to Designer Mode.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Left: Checklist + Publish button */}
              <div className="space-y-6">
                <div className="rounded-xl border border-border bg-card">
                  <div className="px-5 py-4 border-b border-border">
                    <h2 className="text-sm font-semibold text-foreground">Pre-Publish Checklist</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">All items must pass before publishing.</p>
                  </div>
                  <div className="px-5 divide-y divide-border">
                    {checklistLoading ? (
                      <div className="flex items-center gap-2 py-6 text-muted-foreground text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading checklist…
                      </div>
                    ) : checklist ? (
                      checklist.checks.map((check) => (
                        <ChecklistItem key={check.id} check={check} onNav={handleNavToFix} />
                      ))
                    ) : (
                      <p className="py-4 text-sm text-muted-foreground">Unable to load checklist.</p>
                    )}
                  </div>
                </div>

                {canPublishSchema && (
                  <button
                    disabled={!allPassing || publishing || checklistLoading}
                    onClick={() => setConfirmOpen(true)}
                    data-testid="publish-btn"
                    className={[
                      "w-full px-5 py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2",
                      allPassing && !publishing && !checklistLoading
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                        : "bg-muted text-muted-foreground cursor-not-allowed",
                    ].join(" ")}
                  >
                    {publishing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Publishing…
                      </>
                    ) : (
                      "Publish Schema"
                    )}
                  </button>
                )}

                {publishError && !confirmOpen && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                    {publishError.message}
                  </div>
                )}
              </div>

              {/* Right: Version history + diff panel */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="text-sm font-semibold text-foreground">Version History</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Click a version to view its changes.</p>
                </div>

                {historyLoading ? (
                  <div className="flex items-center gap-2 p-5 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading history…
                  </div>
                ) : history.length === 0 ? (
                  <div className="p-5 text-center">
                    <p className="text-sm text-muted-foreground">No versions published yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {history.map((version) => (
                      <div key={version.id}>
                        <VersionRow
                          version={version}
                          selected={selectedVersionId === version.id}
                          onSelect={() =>
                            selectVersion(selectedVersionId === version.id ? null : version.id)
                          }
                        />
                        {selectedVersionId === version.id && (
                          <div className="px-5 py-4 bg-muted/30 border-t border-border">
                            <DiffPanel diff={selectedDiff} loading={diffLoading} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmPublishModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handlePublish}
        publishing={publishing}
        error={publishError?.message ?? null}
      />
    </>
  );
}
