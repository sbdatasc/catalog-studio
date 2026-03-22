import { useEffect, useMemo } from "react";
import { Link } from "wouter";
import { Loader2, Plus, AlertCircle, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/uiStore";
import { useSchemaStore } from "@/stores/schemaStore";
import { useEntryStore } from "@/stores/entryStore";
import { OperationalNav } from "@/components/operational/OperationalNav";
import { NoSchemaPublishedBanner } from "@/components/operational/NoSchemaPublishedBanner";
import { EntryForm } from "@/components/operational/EntryForm";
import type { SnapshotTemplate } from "@/lib/apiClient";

interface Props {
  catalogId: string;
}

export function OperationalPage({ catalogId }: Props) {
  const setActiveCatalog = useUiStore((s) => s.setActiveCatalog);
  const activeTemplateTabId = useUiStore((s) => s.activeTemplateTabId);
  const setActiveTemplateTab = useUiStore((s) => s.setActiveTemplateTab);
  const isEntryFormOpen = useUiStore((s) => s.isEntryFormOpen);
  const openEntryForm = useUiStore((s) => s.openEntryForm);
  const closeEntryForm = useUiStore((s) => s.closeEntryForm);

  const publishedSchemasByCatalog = useSchemaStore((s) => s.publishedSchemasByCatalog);
  const publishedSchemaLoading = useSchemaStore((s) => s.publishedSchemaLoading);
  const publishedSchemaError = useSchemaStore((s) => s.publishedSchemaError);
  const fetchPublishedSchema = useSchemaStore((s) => s.fetchPublishedSchema);

  const entriesByTemplate = useEntryStore((s) => s.entriesByTemplate);
  const entriesLoading = useEntryStore((s) => s.entriesLoading);
  const entriesError = useEntryStore((s) => s.entriesError);
  const fetchEntries = useEntryStore((s) => s.fetchEntries);

  const snapshot = publishedSchemasByCatalog[catalogId];
  const isLoading = publishedSchemaLoading[catalogId] ?? true;
  const loadError = publishedSchemaError[catalogId] ?? null;

  const templateTabs = useMemo<SnapshotTemplate[]>(() => {
    if (!snapshot) return [];
    return snapshot.templates
      .filter((t) => !t.isReferenceData)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [snapshot]);

  useEffect(() => {
    setActiveCatalog(catalogId, "published");
    fetchPublishedSchema(catalogId);
  }, [catalogId, setActiveCatalog, fetchPublishedSchema]);

  useEffect(() => {
    if (templateTabs.length === 0) return;
    const isValid = activeTemplateTabId && templateTabs.some((t) => t.id === activeTemplateTabId);
    if (!isValid) {
      setActiveTemplateTab(templateTabs[0].id);
    }
  }, [templateTabs, activeTemplateTabId, setActiveTemplateTab]);

  useEffect(() => {
    if (activeTemplateTabId) {
      fetchEntries(catalogId, activeTemplateTabId);
    }
  }, [activeTemplateTabId, catalogId, fetchEntries]);

  const activeTemplate = useMemo(
    () => templateTabs.find((t) => t.id === activeTemplateTabId) ?? null,
    [templateTabs, activeTemplateTabId],
  );

  const activeEntries = activeTemplateTabId ? (entriesByTemplate[activeTemplateTabId] ?? []) : [];
  const activeEntriesLoading = activeTemplateTabId ? (entriesLoading[activeTemplateTabId] ?? false) : false;
  const activeEntriesError = activeTemplateTabId ? (entriesError[activeTemplateTabId] ?? null) : null;

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen">
        <div className="h-16 border-b border-border bg-card flex items-center px-6 gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
            <Database className="w-4 h-4" />
          </div>
          <span className="font-semibold text-lg">Operational</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col h-screen">
        <div className="h-16 border-b border-border bg-card" />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-destructive p-8">
          <AlertCircle className="w-8 h-8" />
          <p className="text-sm">Could not load schema. Please refresh the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {snapshot ? (
        <OperationalNav
          catalogId={catalogId}
          catalogName={snapshot.catalogName}
          tabs={templateTabs}
        />
      ) : (
        <div className="flex flex-col border-b border-border bg-card">
          <div className="h-16 px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                <Database className="w-4 h-4" />
              </div>
              <span className="font-semibold text-lg text-foreground">Operational</span>
            </div>
            <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-border/50">
              <Link
                href={`/catalogs/${catalogId}/designer/templates`}
                className="px-4 py-1.5 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-background/70 transition-colors"
              >
                Designer
              </Link>
              <button className="px-4 py-1.5 text-sm font-medium rounded-md bg-card text-foreground shadow-sm ring-1 ring-black/5">
                Operational
              </button>
            </div>
            <div className="w-[160px]" />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {!snapshot ? (
          <NoSchemaPublishedBanner catalogId={catalogId} />
        ) : isEntryFormOpen && activeTemplate && snapshot ? (
          <div className="h-full overflow-hidden">
            <EntryForm
              catalogId={catalogId}
              template={activeTemplate}
              snapshot={snapshot}
            />
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            {templateTabs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-16 text-center">
                <p className="text-muted-foreground text-sm">
                  No non-reference-data templates found in the published schema.
                </p>
              </div>
            ) : !activeTemplate ? null : (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">{activeTemplate.name}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {activeEntries.length} {activeEntries.length === 1 ? "entry" : "entries"}
                    </p>
                  </div>
                  <Button
                    onClick={openEntryForm}
                    data-testid="new-entry-button"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Entry
                  </Button>
                </div>

                {activeEntriesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : activeEntriesError ? (
                  <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">Could not load entries. Please try again.</p>
                  </div>
                ) : activeEntries.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
                    <p className="text-muted-foreground text-sm font-medium">No entries yet</p>
                    <p className="text-muted-foreground text-sm mt-1">
                      Click "New Entry" to create your first {activeTemplate.name.toLowerCase()} entry.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:border-primary/30 transition-colors"
                        data-testid="entry-list-item"
                      >
                        <div>
                          <p className="font-medium text-sm text-foreground">{entry.displayName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Created {new Date(entry.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
