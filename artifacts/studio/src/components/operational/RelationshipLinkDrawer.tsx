import { useState, useEffect } from "react";
import { Loader2, AlertTriangle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { apiClient } from "@/lib/apiClient";
import type { EntryLinkInstance, SnapshotRelationship, EntryListItem } from "@/lib/apiClient";
import { useEntryStore } from "@/stores/entryStore";
import { useToast } from "@/hooks/use-toast";

interface Props {
  relationship: SnapshotRelationship;
  currentEntryId: string;
  currentTemplateId: string;
  currentEntryName: string;
  catalogId: string;
  existingLinks: EntryLinkInstance[];
  onClose: () => void;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export function RelationshipLinkDrawer({
  relationship,
  currentEntryId,
  currentTemplateId,
  currentEntryName,
  catalogId,
  existingLinks,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntryListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<EntryListItem | null>(null);
  const [linking, setLinking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const addLink = useEntryStore((s) => s.addLink);
  const { toast } = useToast();

  const debouncedQuery = useDebounce(query, 300);

  const isFromSide = currentTemplateId === relationship.fromTemplateId;
  const searchTemplateId = isFromSide ? relationship.toTemplateId : relationship.fromTemplateId;

  const hasFromSideLink =
    isFromSide &&
    (relationship.cardinality === "1:1" || relationship.cardinality === "1:N") &&
    existingLinks.some(
      (l) => l.relationshipId === relationship.id && l.fromEntryId === currentEntryId,
    );

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    apiClient.entries
      .search(catalogId, searchTemplateId, debouncedQuery, 10)
      .then(({ data }) => {
        if (!cancelled) {
          setResults((data ?? []).filter((e) => e.id !== currentEntryId));
          setSearching(false);
        }
      })
      .catch(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, catalogId, searchTemplateId, currentEntryId]);

  async function handleConfirm() {
    if (!selected) return;
    setLinking(true);
    setErrorMsg(null);

    let result;
    if (isFromSide) {
      result = await apiClient.entries.link(currentEntryId, {
        relationshipId: relationship.id,
        toEntryId: selected.id,
      });
    } else {
      result = await apiClient.entries.link(selected.id, {
        relationshipId: relationship.id,
        toEntryId: currentEntryId,
      });
    }

    const { data, error } = result;
    setLinking(false);

    if (error) {
      if (error.details?.code === "CONFLICT" || error.code === "CONFLICT") {
        setErrorMsg(
          error.message ?? "This relationship only allows one link. Remove the existing link first.",
        );
      } else {
        setErrorMsg("Could not create link. Please try again.");
      }
      return;
    }
    if (data) {
      addLink(currentEntryId, data);
      toast({ title: `${selected.displayName} linked.` });
    }
    onClose();
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        className="w-[420px] sm:max-w-[420px] p-0 flex flex-col border-l border-border bg-card"
        onInteractOutside={(e) => {
          e.preventDefault();
          onClose();
        }}
      >
        <SheetHeader className="px-6 py-4 border-b border-border/50">
          <SheetTitle className="text-lg font-semibold">
            Link via {relationship.label}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4 p-6">
            <div className="text-sm text-muted-foreground">
              Linking from:{" "}
              <span className="font-medium text-foreground">{currentEntryName}</span>
            </div>

            {hasFromSideLink && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-700">
                  This entry already has a {relationship.label} link. Confirming may be blocked
                  unless you remove the existing link first.
                </p>
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search entries… (min 2 chars)"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(null);
                  setErrorMsg(null);
                }}
              />
            </div>

            <div className="min-h-[100px] max-h-[280px] overflow-y-auto rounded-md border border-border">
              {searching ? (
                <div className="flex items-center justify-center h-20">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : query.length < 2 ? (
                <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
                  Type at least 2 characters to search
                </div>
              ) : results.length === 0 ? (
                <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
                  No entries found
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {results.map((entry) => (
                    <li key={entry.id}>
                      <button
                        className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                          selected?.id === entry.id
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => setSelected(entry)}
                      >
                        {entry.displayName}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {errorMsg && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {errorMsg}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border px-6 py-4 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={linking}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selected || linking}>
            {linking && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Link Entry
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
