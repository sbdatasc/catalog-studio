import { useRef, useEffect, useState } from "react";
import { Search, X, LayoutGrid, Table, Columns3, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUiStore } from "@/stores/uiStore";
import type { SnapshotTemplate } from "@/lib/apiClient";
import { ColumnPickerPanel, loadColumnPrefs, saveColumnPrefs } from "./ColumnPickerPanel";
import { cn } from "@/lib/utils";

interface Props {
  catalogId: string;
  template: SnapshotTemplate;
  entryCount: number;
  searchQuery: string;
  isSearching: boolean;
  onSearchChange: (q: string) => void;
  onClearSearch: () => void;
  onNewEntry: () => void;
  selectedColumns: string[];
  onColumnsChange: (ids: string[]) => void;
}

export function ContentHeader({
  catalogId,
  template,
  entryCount,
  searchQuery,
  isSearching,
  onSearchChange,
  onClearSearch,
  onNewEntry,
  selectedColumns,
  onColumnsChange,
}: Props) {
  const viewMode = useUiStore((s) => s.entryListViewMode);
  const setViewMode = useUiStore((s) => s.setEntryListViewMode);
  const isColumnPickerOpen = useUiStore((s) => s.isColumnPickerOpen);
  const toggleColumnPicker = useUiStore((s) => s.toggleColumnPicker);
  const closeColumnPicker = useUiStore((s) => s.closeColumnPicker);

  const searchRef = useRef<HTMLInputElement>(null);
  const columnsButtonRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-background">
      {/* Left: Template name + count */}
      <div className="flex items-baseline gap-2 shrink-0">
        <h2 className="text-lg font-semibold text-foreground">{template.name}</h2>
        <span className="text-sm text-muted-foreground bg-muted rounded-full px-2 py-0.5 font-medium">
          {entryCount}
        </span>
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-sm relative mx-4">
        <div className="relative flex items-center">
          {isSearching ? (
            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          )}
          <Input
            ref={searchRef}
            type="text"
            placeholder={`Search ${template.name} entries…`}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-8 h-9 text-sm"
            data-testid="search-input"
          />
          {searchQuery && (
            <button
              onClick={onClearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Right: View toggle + Columns + New Entry */}
      <div className="flex items-center gap-2 ml-auto shrink-0">
        <div className="flex items-center bg-muted p-0.5 rounded-lg border border-border">
          <button
            onClick={() => setViewMode("card")}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              viewMode === "card"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-label="Card view"
            title="Card grid view"
            data-testid="view-mode-card"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              viewMode === "table"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-label="Table view"
            title="Table view"
            data-testid="view-mode-table"
          >
            <Table className="w-4 h-4" />
          </button>
        </div>

        {viewMode === "table" && (
          <div ref={columnsButtonRef} className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleColumnPicker}
              className="h-9 gap-1.5"
              data-testid="columns-button"
            >
              <Columns3 className="w-4 h-4" />
              Columns
            </Button>
            {isColumnPickerOpen && (
              <ColumnPickerPanel
                template={template}
                catalogId={catalogId}
                selectedAttributeIds={selectedColumns}
                onChange={onColumnsChange}
                onClose={closeColumnPicker}
              />
            )}
          </div>
        )}

        <Button onClick={onNewEntry} size="sm" className="h-9" data-testid="new-entry-button">
          <Plus className="w-4 h-4 mr-1.5" />
          New Entry
        </Button>
      </div>
    </div>
  );
}
