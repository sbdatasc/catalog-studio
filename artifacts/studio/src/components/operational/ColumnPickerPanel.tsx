import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import type { SnapshotTemplate } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

interface Props {
  template: SnapshotTemplate;
  catalogId: string;
  selectedAttributeIds: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
}

const MAX_ADDITIONAL_COLUMNS = 7;

function getColumnsKey(catalogId: string, templateId: string): string {
  return `entry-columns-${catalogId}-${templateId}`;
}

export function getDefaultColumns(template: SnapshotTemplate): string[] {
  const allAttrs = template.sections
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .flatMap((s) =>
      s.attributes.slice().sort((a, b) => a.displayOrder - b.displayOrder),
    );
  return allAttrs.slice(0, 4).map((a) => a.id);
}

export function loadColumnPrefs(catalogId: string, template: SnapshotTemplate): string[] {
  try {
    const key = getColumnsKey(catalogId, template.id);
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved) as string[];
      const allIds = new Set(
        template.sections.flatMap((s) => s.attributes.map((a) => a.id)),
      );
      const valid = parsed.filter((id) => allIds.has(id));
      if (valid.length > 0) return valid;
    }
  } catch {
    // ignore
  }
  return getDefaultColumns(template);
}

export function saveColumnPrefs(catalogId: string, templateId: string, ids: string[]): void {
  try {
    localStorage.setItem(getColumnsKey(catalogId, templateId), JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function ColumnPickerPanel({ template, catalogId, selectedAttributeIds, onChange, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [onClose]);

  const allAttrs = template.sections
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .flatMap((s) =>
      s.attributes.slice().sort((a, b) => a.displayOrder - b.displayOrder),
    );

  const selected = new Set(selectedAttributeIds);
  const atLimit = selected.size >= MAX_ADDITIONAL_COLUMNS;

  function toggle(attrId: string) {
    const next = new Set(selected);
    if (next.has(attrId)) {
      next.delete(attrId);
    } else {
      if (atLimit) return;
      next.add(attrId);
    }
    const ordered = allAttrs.filter((a) => next.has(a.id)).map((a) => a.id);
    saveColumnPrefs(catalogId, template.id, ordered);
    onChange(ordered);
  }

  return (
    <div
      ref={panelRef}
      className="absolute top-full right-0 mt-1 z-50 w-72 bg-popover border border-border rounded-xl shadow-lg py-2"
      data-testid="column-picker-panel"
    >
      <div className="px-3 pb-2 border-b border-border mb-1">
        <p className="text-xs font-semibold text-foreground">Column Visibility</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select up to {MAX_ADDITIONAL_COLUMNS} attribute columns
        </p>
      </div>

      <div className="px-2">
        {/* Fixed: display_name */}
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md opacity-50">
          <div className="w-4 h-4 rounded-sm border border-primary bg-primary flex items-center justify-center">
            <Check className="w-3 h-3 text-primary-foreground" />
          </div>
          <span className="text-sm text-foreground">Display Name</span>
          <span className="ml-auto text-xs text-muted-foreground">Always on</span>
        </div>

        {allAttrs.map((attr) => {
          const isSelected = selected.has(attr.id);
          const disabled = !isSelected && atLimit;
          return (
            <button
              key={attr.id}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors",
                disabled
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-muted cursor-pointer",
              )}
              onClick={() => !disabled && toggle(attr.id)}
              disabled={disabled}
              title={disabled ? "Remove a column to add another" : undefined}
            >
              <div
                className={cn(
                  "w-4 h-4 rounded-sm border flex items-center justify-center flex-shrink-0 transition-colors",
                  isSelected
                    ? "bg-primary border-primary"
                    : "bg-background border-border",
                )}
              >
                {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
              </div>
              <span className="text-sm text-foreground truncate">{attr.name}</span>
              <span className="ml-auto text-xs text-muted-foreground capitalize shrink-0">
                {attr.attributeType}
              </span>
            </button>
          );
        })}

        {/* Fixed: Updated */}
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md opacity-50 mt-1">
          <div className="w-4 h-4 rounded-sm border border-primary bg-primary flex items-center justify-center">
            <Check className="w-3 h-3 text-primary-foreground" />
          </div>
          <span className="text-sm text-foreground">Updated</span>
          <span className="ml-auto text-xs text-muted-foreground">Always on</span>
        </div>
      </div>
    </div>
  );
}
