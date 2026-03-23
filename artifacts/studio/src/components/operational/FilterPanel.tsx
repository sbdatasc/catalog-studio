import { useEffect, useRef, useState, useMemo } from "react";
import { X, Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  SnapshotTemplate,
  SnapshotAttribute,
  AttributeType,
  EntryFilter,
  FilterOperator,
  EnumConfig,
} from "@/lib/apiClient";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Operator config per attribute type
// ---------------------------------------------------------------------------

const TYPE_OPERATORS: Record<AttributeType, FilterOperator[]> = {
  string: ["contains", "eq", "startsWith", "endsWith", "isEmpty", "isNotEmpty"],
  text: ["contains", "eq", "isEmpty", "isNotEmpty"],
  number: ["eq", "gt", "gte", "lt", "lte", "isEmpty", "isNotEmpty"],
  boolean: ["eq", "isEmpty", "isNotEmpty"],
  date: ["eq", "before", "after", "isEmpty", "isNotEmpty"],
  enum: ["eq", "in", "isEmpty", "isNotEmpty"],
  reference: ["eq", "isEmpty", "isNotEmpty"],
  reference_data: ["eq", "isEmpty", "isNotEmpty"],
};

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: "equals",
  contains: "contains",
  startsWith: "starts with",
  endsWith: "ends with",
  gt: "greater than",
  gte: "greater than or equal",
  lt: "less than",
  lte: "less than or equal",
  before: "before",
  after: "after",
  in: "is one of",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
};

const NO_VALUE_OPERATORS: FilterOperator[] = ["isEmpty", "isNotEmpty"];

// ---------------------------------------------------------------------------
// Value input based on attribute type + operator
// ---------------------------------------------------------------------------

interface ValueInputProps {
  attr: SnapshotAttribute;
  operator: FilterOperator;
  value: string;
  onChange: (v: string) => void;
}

function ValueInput({ attr, operator, value, onChange }: ValueInputProps) {
  if (NO_VALUE_OPERATORS.includes(operator)) return null;

  if (attr.attributeType === "boolean" && operator === "eq") {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">True</SelectItem>
          <SelectItem value="false">False</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (attr.attributeType === "enum" && operator === "eq" && attr.config) {
    const opts = (attr.config as EnumConfig).options ?? [];
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Select value…" />
        </SelectTrigger>
        <SelectContent>
          {opts.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (attr.attributeType === "date") {
    return (
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-xs"
      />
    );
  }

  if (attr.attributeType === "number") {
    return (
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter number…"
        className="h-8 text-xs"
      />
    );
  }

  const placeholder =
    operator === "in"
      ? "Comma-separated values…"
      : attr.attributeType === "reference" || attr.attributeType === "reference_data"
        ? "Entry ID…"
        : "Enter value…";

  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-8 text-xs"
    />
  );
}

// ---------------------------------------------------------------------------
// Single filter row
// ---------------------------------------------------------------------------

interface FilterRowProps {
  attr: SnapshotAttribute;
  operator: FilterOperator;
  value: string;
  onOperatorChange: (op: FilterOperator) => void;
  onValueChange: (v: string) => void;
  onRemove: () => void;
}

function FilterRow({ attr, operator, value, onOperatorChange, onValueChange, onRemove }: FilterRowProps) {
  const operators = TYPE_OPERATORS[attr.attributeType] ?? ["eq", "isEmpty", "isNotEmpty"];

  return (
    <div className="group flex flex-col gap-1.5 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground truncate">{attr.name}</span>
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
          aria-label={`Remove filter for ${attr.name}`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <Select value={operator} onValueChange={(v) => onOperatorChange(v as FilterOperator)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operators.map((op) => (
            <SelectItem key={op} value={op} className="text-xs">
              {OPERATOR_LABELS[op]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ValueInput attr={attr} operator={operator} value={value} onChange={onValueChange} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add attribute picker row
// ---------------------------------------------------------------------------

interface AddFilterRowProps {
  attributes: SnapshotAttribute[];
  usedIds: Set<string>;
  onAdd: (attr: SnapshotAttribute) => void;
}

function AddFilterRow({ attributes, usedIds, onAdd }: AddFilterRowProps) {
  const available = attributes.filter((a) => !usedIds.has(a.id));
  if (available.length === 0) return null;

  return (
    <div className="mt-1">
      <Select
        value=""
        onValueChange={(id) => {
          const attr = available.find((a) => a.id === id);
          if (attr) onAdd(attr);
        }}
      >
        <SelectTrigger
          className={cn(
            "h-8 text-xs border-dashed text-muted-foreground gap-1.5",
            "hover:text-foreground hover:border-border transition-colors",
          )}
          data-testid="add-filter-trigger"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          <span>Add filter…</span>
        </SelectTrigger>
        <SelectContent>
          {available.map((a) => (
            <SelectItem key={a.id} value={a.id} className="text-xs">
              {a.name}
              <span className="ml-1.5 text-muted-foreground text-[10px]">{a.attributeType}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main FilterPanel
// ---------------------------------------------------------------------------

interface FilterPanelProps {
  template: SnapshotTemplate;
  filters: EntryFilter[];
  onFiltersChange: (filters: EntryFilter[]) => void;
  onClose: () => void;
}

interface LocalFilterRow {
  attributeId: string;
  operator: FilterOperator;
  value: string;
}

function filtersToLocal(filters: EntryFilter[]): LocalFilterRow[] {
  return filters.map((f) => ({
    attributeId: f.attributeId,
    operator: f.operator,
    value: f.value ?? "",
  }));
}

function localToFilters(rows: LocalFilterRow[]): EntryFilter[] {
  return rows
    .filter((r) => {
      if (NO_VALUE_OPERATORS.includes(r.operator)) return true;
      return r.value.trim() !== "";
    })
    .map((r) => ({
      attributeId: r.attributeId,
      operator: r.operator,
      value: NO_VALUE_OPERATORS.includes(r.operator) ? null : r.value.trim(),
    }));
}

export function FilterPanel({ template, filters, onFiltersChange, onClose }: FilterPanelProps) {
  const [rows, setRows] = useState<LocalFilterRow[]>(() => filtersToLocal(filters));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevFiltersKey = useRef<string>("");

  const allAttributes = useMemo(
    () => template.sections.flatMap((s) => s.attributes).sort((a, b) => a.name.localeCompare(b.name)),
    [template],
  );

  const attrById = useMemo(() => new Map(allAttributes.map((a) => [a.id, a])), [allAttributes]);

  // Sync when parent filters change externally (e.g., URL navigation)
  useEffect(() => {
    const incoming = filters
      .map((f) => `${f.attributeId}:${f.operator}:${f.value}`)
      .sort()
      .join("|");
    if (incoming !== prevFiltersKey.current) {
      prevFiltersKey.current = incoming;
      setRows(filtersToLocal(filters));
    }
  }, [filters]);

  function pushUpdate(newRows: LocalFilterRow[]) {
    setRows(newRows);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFiltersChange(localToFilters(newRows));
    }, 400);
  }

  function handleAdd(attr: SnapshotAttribute) {
    const defaultOp = TYPE_OPERATORS[attr.attributeType]?.[0] ?? "eq";
    pushUpdate([...rows, { attributeId: attr.id, operator: defaultOp, value: "" }]);
  }

  function handleRemove(idx: number) {
    const next = rows.filter((_, i) => i !== idx);
    setRows(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onFiltersChange(localToFilters(next));
  }

  function handleOperatorChange(idx: number, op: FilterOperator) {
    const next = rows.map((r, i) => (i === idx ? { ...r, operator: op, value: "" } : r));
    pushUpdate(next);
  }

  function handleValueChange(idx: number, value: string) {
    const next = rows.map((r, i) => (i === idx ? { ...r, value } : r));
    pushUpdate(next);
  }

  function handleClearAll() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setRows([]);
    onFiltersChange([]);
  }

  const usedIds = new Set(rows.map((r) => r.attributeId));

  return (
    <div className="flex flex-col h-full bg-background border-l border-border w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Filters</span>
          {rows.length > 0 && (
            <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-medium leading-none">
              {rows.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {rows.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-7 text-xs text-muted-foreground hover:text-destructive px-2"
              data-testid="clear-all-filters"
            >
              Clear all
            </Button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close filter panel"
            data-testid="close-filter-panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter rows */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {rows.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-xs">
            No filters applied. Add one below to narrow down entries.
          </div>
        )}

        {rows.map((row, idx) => {
          const attr = attrById.get(row.attributeId);
          if (!attr) return null;
          return (
            <FilterRow
              key={`${row.attributeId}-${idx}`}
              attr={attr}
              operator={row.operator}
              value={row.value}
              onOperatorChange={(op) => handleOperatorChange(idx, op)}
              onValueChange={(v) => handleValueChange(idx, v)}
              onRemove={() => handleRemove(idx)}
            />
          );
        })}

        <AddFilterRow attributes={allAttributes} usedIds={usedIds} onAdd={handleAdd} />
      </div>
    </div>
  );
}
