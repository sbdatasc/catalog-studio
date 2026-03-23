import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, AlertCircle, Database } from "lucide-react";
import { useUiStore } from "@/stores/uiStore";
import { useSchemaStore } from "@/stores/schemaStore";
import { useEntryStore } from "@/stores/entryStore";
import { OperationalNav } from "@/components/operational/OperationalNav";
import { NoSchemaPublishedBanner } from "@/components/operational/NoSchemaPublishedBanner";
import { EntryForm } from "@/components/operational/EntryForm";
import { ContentHeader } from "@/components/operational/ContentHeader";
import { EntryCardGrid } from "@/components/operational/EntryCardGrid";
import { EntryTableView } from "@/components/operational/EntryTableView";
import { SearchResultsBanner } from "@/components/operational/SearchResultsBanner";
import { loadColumnPrefs, saveColumnPrefs } from "@/components/operational/ColumnPickerPanel";
import { apiClient } from "@/lib/apiClient";
import type { SnapshotTemplate, EntryListItem } from "@/lib/apiClient";
import { TABLE_PAGE_SIZE } from "@/stores/entryStore";

interface Props {
  catalogId: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export function OperationalPage({ catalogId }: Props) {
  const [, navigate] = useLocation();

  const setActiveCatalog = useUiStore((s) => s.setActiveCatalog);
  const activeTemplateTabId = useUiStore((s) => s.activeTemplateTabId);
  const setActiveTemplateTab = useUiStore((s) => s.setActiveTemplateTab);
  const isEntryFormOpen = useUiStore((s) => s.isEntryFormOpen);
  const openEntryForm = useUiStore((s) => s.openEntryForm);
  const closeEntryForm = useUiStore((s) => s.closeEntryForm);
  const viewMode = useUiStore((s) => s.entryListViewMode);

  const publishedSchemasByCatalog = useSchemaStore((s) => s.publishedSchemasByCatalog);
  const publishedSchemaLoading = useSchemaStore((s) => s.publishedSchemaLoading);
  const publishedSchemaError = useSchemaStore((s) => s.publishedSchemaError);
  const fetchPublishedSchema = useSchemaStore((s) => s.fetchPublishedSchema);

  const entriesByTemplate = useEntryStore((s) => s.entriesByTemplate);
  const entriesLoading = useEntryStore((s) => s.entriesLoading);
  const paginationByTemplate = useEntryStore((s) => s.paginationByTemplate);
  const fetchEntries = useEntryStore((s) => s.fetchEntries);
  const loadMoreEntries = useEntryStore((s) => s.loadMoreEntries);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<EntryListItem[] | null>(null);
  const [tablePage, setTablePage] = useState(1);

  const debouncedSearch = useDebounce(searchQuery, 300);

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
      setSearchQuery("");
      setSearchResults(null);
      setTablePage(1);
    }
  }, [activeTemplateTabId, catalogId, fetchEntries]);

  // Debounced search
  useEffect(() => {
    if (!debouncedSearch || !activeTemplateTabId) {
      setSearchResults(null);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    apiClient.entries
      .search(catalogId, activeTemplateTabId, debouncedSearch, 50)
      .then(({ data }) => {
        if (!cancelled) {
          setSearchResults(data ?? []);
          setIsSearching(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, catalogId, activeTemplateTabId]);

  const activeTemplate = useMemo(
    () => templateTabs.find((t) => t.id === activeTemplateTabId) ?? null,
    [templateTabs, activeTemplateTabId],
  );

  const allEntries = activeTemplateTabId ? (entriesByTemplate[activeTemplateTabId] ?? []) : [];
  const activeEntriesLoading = activeTemplateTabId ? (entriesLoading[activeTemplateTabId] ?? false) : false;
  const pagination = activeTemplateTabId ? paginationByTemplate[activeTemplateTabId] : null;

  const displayedEntries = searchResults ?? allEntries;

  // Column prefs
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  useEffect(() => {
    if (!activeTemplate) return;
    const prefs = loadColumnPrefs(catalogId, activeTemplate);
    setSelectedColumns(prefs);
  }, [activeTemplate, catalogId]);

  function handleColumnsChange(ids: string[]) {
    setSelectedColumns(ids);
    if (activeTemplate) saveColumnPrefs(catalogId, activeTemplate.id, ids);
  }

  function handleEdit(entryId: string) {
    if (!activeTemplate) return;
    navigate(`/catalogs/${catalogId}/operational/${activeTemplate.id}/entries/${entryId}`);
  }

  // Table page navigation (loads fresh pages from API)
  async function handleTableNextPage() {
    if (!activeTemplateTabId || !pagination?.hasMore) return;
    const nextPage = tablePage + 1;
    setTablePage(nextPage);
    // Temporarily fetch table page from API (50 rows) — simplified: use entryStore
    await loadMoreEntries(catalogId, activeTemplateTabId);
  }

  async function handleTablePrevPage() {
    if (tablePage <= 1) return;
    setTablePage((p) => Math.max(1, p - 1));
  }

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

      <div className="flex-1 overflow-hidden flex flex-col">
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
        ) : templateTabs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-16 text-center">
            <p className="text-muted-foreground text-sm">
              No non-reference-data templates found in the published schema.
            </p>
          </div>
        ) : !activeTemplate ? null : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <ContentHeader
              catalogId={catalogId}
              template={activeTemplate}
              entryCount={pagination?.total ?? allEntries.length}
              searchQuery={searchQuery}
              isSearching={isSearching}
              onSearchChange={setSearchQuery}
              onClearSearch={() => {
                setSearchQuery("");
                setSearchResults(null);
              }}
              onNewEntry={openEntryForm}
              selectedColumns={selectedColumns}
              onColumnsChange={handleColumnsChange}
            />

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {searchResults !== null && searchQuery && (
                <SearchResultsBanner
                  query={searchQuery}
                  count={searchResults.length}
                  onClear={() => {
                    setSearchQuery("");
                    setSearchResults(null);
                  }}
                />
              )}

              {activeEntriesLoading && allEntries.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : displayedEntries.length === 0 ? (
                searchResults !== null ? (
                  <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
                    <p className="text-muted-foreground text-sm font-medium">
                      No entries matching "{searchQuery}"
                    </p>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSearchResults(null);
                      }}
                      className="text-sm text-primary hover:underline mt-2"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
                    <p className="text-muted-foreground text-sm font-medium">No entries yet</p>
                    <p className="text-muted-foreground text-sm mt-1">
                      Click "New Entry" to add the first one.
                    </p>
                  </div>
                )
              ) : viewMode === "card" ? (
                <EntryCardGrid
                  entries={displayedEntries}
                  template={activeTemplate}
                  catalogId={catalogId}
                  hasMore={searchResults === null && (pagination?.hasMore ?? false)}
                  loadingMore={activeEntriesLoading}
                  onLoadMore={() => loadMoreEntries(catalogId, activeTemplateTabId!)}
                  onEdit={handleEdit}
                />
              ) : (
                <EntryTableView
                  entries={displayedEntries}
                  template={activeTemplate}
                  catalogId={catalogId}
                  selectedColumns={selectedColumns}
                  total={pagination?.total ?? displayedEntries.length}
                  page={tablePage}
                  limit={TABLE_PAGE_SIZE}
                  onNextPage={handleTableNextPage}
                  onPrevPage={handleTablePrevPage}
                  onEdit={handleEdit}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
