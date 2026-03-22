import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useUiStore } from "@/stores/uiStore";
import { useSchemaStore } from "@/stores/schemaStore";
import { apiClient } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";

interface Props {
  catalogId: string;
  isLocked: boolean;
}

const CARDINALITY_OPTIONS = [
  { value: "1:1", label: "One to One (1:1)" },
  { value: "1:N", label: "One to Many (1:N)" },
  { value: "M:N", label: "Many to Many (M:N)" },
];

const DIRECTION_OPTIONS = [
  { value: "both", label: "Bidirectional (↔)" },
  { value: "from", label: "From → To (→)" },
  { value: "to", label: "To → From (←)" },
];

export function RelationshipDrawer({ catalogId, isLocked }: Props) {
  const { toast } = useToast();
  const {
    relDrawerMode,
    relDrawerRelationshipId,
    relDrawerFromTemplateId,
    relDrawerIsDirty,
    closeRelDrawer,
    setRelDrawerDirty,
  } = useUiStore();

  const {
    templates,
    referenceDataTemplates,
    relationshipsByCatalog,
    addRelationship,
    updateRelationshipLocal,
  } = useSchemaStore();

  const [fromTemplateId, setFromTemplateId] = useState<string>("");
  const [toTemplateId, setToTemplateId] = useState<string>("");
  const [label, setLabel] = useState("");
  const [cardinality, setCardinality] = useState<"1:1" | "1:N" | "M:N">("1:N");
  const [direction, setDirection] = useState<"from" | "to" | "both">("both");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allTemplates = [...templates, ...referenceDataTemplates];
  const isOpen = relDrawerMode !== "closed";
  const isEdit = relDrawerMode === "edit";

  const existingRel = isEdit && relDrawerRelationshipId
    ? (relationshipsByCatalog[catalogId] ?? []).find((r) => r.id === relDrawerRelationshipId)
    : null;

  useEffect(() => {
    if (!isOpen) return;

    if (isEdit && existingRel) {
      setFromTemplateId(existingRel.fromTemplateId);
      setToTemplateId(existingRel.toTemplateId);
      setLabel(existingRel.label);
      setCardinality(existingRel.cardinality);
      setDirection(existingRel.direction);
    } else {
      setFromTemplateId(relDrawerFromTemplateId ?? "");
      setToTemplateId("");
      setLabel("");
      setCardinality("1:N");
      setDirection("both");
    }
    setError(null);
    setRelDrawerDirty(false);
    setSaving(false);
  }, [isOpen, relDrawerMode, relDrawerRelationshipId]); // eslint-disable-line react-hooks/exhaustive-deps

  function markDirty() {
    if (!relDrawerIsDirty) setRelDrawerDirty(true);
  }

  async function handleSave() {
    if (!fromTemplateId) { setError("Please select the 'From' template."); return; }
    if (!toTemplateId) { setError("Please select the 'To' template."); return; }
    if (!label.trim()) { setError("Label is required."); return; }
    if (fromTemplateId === toTemplateId) { setError("'From' and 'To' templates must be different."); return; }

    setSaving(true);
    setError(null);

    if (isEdit && relDrawerRelationshipId) {
      const { data, error: apiErr } = await apiClient.schema.updateRelationship(relDrawerRelationshipId, {
        label: label.trim(),
        cardinality,
        direction,
      });
      setSaving(false);
      if (apiErr) {
        setError(apiErr.message);
      } else if (data) {
        updateRelationshipLocal(data);
        toast({ title: "Relationship updated" });
        closeRelDrawer();
      }
    } else {
      const { data, error: apiErr } = await apiClient.schema.createRelationship({
        catalogId,
        fromTemplateId,
        toTemplateId,
        label: label.trim(),
        cardinality,
        direction,
      });
      setSaving(false);
      if (apiErr) {
        setError(apiErr.message);
      } else if (data) {
        addRelationship(catalogId, data);
        toast({ title: "Relationship created" });
        closeRelDrawer();
      }
    }
  }

  const title = isEdit ? "Edit Relationship" : "Add Relationship";

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeRelDrawer()}>
      <SheetContent
        className="w-[420px] sm:max-w-[420px] p-0 flex flex-col"
        onInteractOutside={(e) => { e.preventDefault(); closeRelDrawer(); }}
        onEscapeKeyDown={(e) => { e.preventDefault(); closeRelDrawer(); }}
      >
        <SheetHeader className="px-6 py-5 border-b border-border/50">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-6 py-6 flex-1 overflow-y-auto">
          {/* From/To template selectors */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div className="space-y-1.5">
              <Label>From Template</Label>
              <Select
                value={fromTemplateId}
                onValueChange={(v) => { setFromTemplateId(v); markDirty(); }}
                disabled={isEdit || isLocked}
              >
                <SelectTrigger data-testid="select-from-template">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {allTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.isReferenceData ? " (Ref)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-center pb-2">
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>

            <div className="space-y-1.5">
              <Label>To Template</Label>
              <Select
                value={toTemplateId}
                onValueChange={(v) => { setToTemplateId(v); markDirty(); }}
                disabled={isEdit || isLocked}
              >
                <SelectTrigger data-testid="select-to-template">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {allTemplates
                    .filter((t) => t.id !== fromTemplateId)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.isReferenceData ? " (Ref)" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Label */}
          <div className="space-y-1.5">
            <Label htmlFor="rel-label">Label</Label>
            <Input
              id="rel-label"
              placeholder="e.g. belongs to, has many, tagged with"
              value={label}
              onChange={(e) => { setLabel(e.target.value); markDirty(); }}
              disabled={isLocked}
              maxLength={100}
              data-testid="input-rel-label"
            />
            <p className="text-xs text-muted-foreground">
              Describe the nature of this relationship concisely.
            </p>
          </div>

          {/* Cardinality */}
          <div className="space-y-1.5">
            <Label>Cardinality</Label>
            <Select
              value={cardinality}
              onValueChange={(v) => { setCardinality(v as typeof cardinality); markDirty(); }}
              disabled={isLocked}
            >
              <SelectTrigger data-testid="select-cardinality">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARDINALITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Direction */}
          <div className="space-y-1.5">
            <Label>Direction</Label>
            <Select
              value={direction}
              onValueChange={(v) => { setDirection(v as typeof direction); markDirty(); }}
              disabled={isLocked}
            >
              <SelectTrigger data-testid="select-direction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIRECTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}
        </div>

        {!isLocked && (
          <div className="border-t border-border px-6 py-4 flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={closeRelDrawer} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} data-testid="btn-save-relationship">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Relationship"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
