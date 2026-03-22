import { useState, useMemo } from "react";
import { Loader2, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { SnapshotTemplate, SchemaSnapshot } from "@/lib/apiClient";
import { apiClient } from "@/lib/apiClient";
import { useEntryStore } from "@/stores/entryStore";
import { useUiStore } from "@/stores/uiStore";
import { SectionAccordion } from "./SectionAccordion";
import { UnsavedEntryGuard } from "./UnsavedEntryGuard";

interface Props {
  catalogId: string;
  template: SnapshotTemplate;
  snapshot: SchemaSnapshot;
}

export function EntryForm({ catalogId, template, snapshot }: Props) {
  const { toast } = useToast();
  const addEntry = useEntryStore((s) => s.addEntry);
  const closeEntryForm = useUiStore((s) => s.closeEntryForm);

  const sortedSections = useMemo(
    () => template.sections.slice().sort((a, b) => a.displayOrder - b.displayOrder),
    [template.sections],
  );

  const allAttributes = useMemo(
    () => sortedSections.flatMap((s) =>
      s.attributes.slice().sort((a, b) => a.displayOrder - b.displayOrder),
    ),
    [sortedSections],
  );

  const targetTemplateNames = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const attr of allAttributes) {
      if (attr.attributeType === "reference" || attr.attributeType === "reference_data") {
        const cfg = attr.config as { targetTemplateId?: string } | null;
        const targetId = cfg?.targetTemplateId;
        if (targetId) {
          const found = snapshot.templates.find((t) => t.id === targetId);
          if (found) map[attr.id] = found.name;
        }
      }
    }
    return map;
  }, [allAttributes, snapshot.templates]);

  const [formValues, setFormValues] = useState<Record<string, string | null>>(() => {
    const init: Record<string, string | null> = {};
    for (const attr of allAttributes) {
      init[attr.id] = null;
    }
    return init;
  });

  const [formDisplayValues, setFormDisplayValues] = useState<Record<string, string | null>>(() => {
    const init: Record<string, string | null> = {};
    for (const attr of allAttributes) {
      init[attr.id] = null;
    }
    return init;
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [guardOpen, setGuardOpen] = useState(false);

  const isDirty = useMemo(
    () => Object.values(formValues).some((v) => v !== null && v !== ""),
    [formValues],
  );

  function handleFieldChange(
    attributeId: string,
    value: string | null,
    displayValue?: string | null,
  ) {
    setFormValues((prev) => ({ ...prev, [attributeId]: value }));
    if (displayValue !== undefined) {
      setFormDisplayValues((prev) => ({ ...prev, [attributeId]: displayValue }));
    }
    if (formErrors[attributeId]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[attributeId];
        return next;
      });
    }
    if (saveError) setSaveError(null);
  }

  function validateClient(): boolean {
    const errors: Record<string, string> = {};
    for (const attr of allAttributes) {
      if (attr.required && !formValues[attr.id]) {
        errors[attr.id] = "This field is required.";
      }
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return false;
    }
    return true;
  }

  async function handleSave() {
    if (!validateClient()) return;

    setSaving(true);
    setSaveError(null);

    const fieldValues = allAttributes.map((attr) => ({
      attributeId: attr.id,
      value: formValues[attr.id] ?? null,
    }));

    const { data, error } = await apiClient.entries.create({
      catalogId,
      templateId: template.id,
      fieldValues,
    });

    setSaving(false);

    if (error) {
      const code = error.details?.code ?? error.code;
      if (code === "REQUIRED_FIELD_MISSING") {
        const targetAttr = allAttributes.find(
          (a) => a.required && !formValues[a.id],
        );
        if (targetAttr) {
          setFormErrors((prev) => ({
            ...prev,
            [targetAttr.id]: "This field is required.",
          }));
        } else {
          setSaveError(error.message);
        }
        return;
      }
      if (code === "VALIDATION_ERROR" || code === "REFERENCE_NOT_FOUND") {
        setSaveError(error.message);
        return;
      }
      setSaveError("Could not save entry. Please try again.");
      return;
    }

    if (data) {
      addEntry(template.id, data);
      toast({ title: "Entry created", description: `"${data.displayName}" was saved.` });
      closeEntryForm();
    }
  }

  function handleCancel() {
    if (isDirty) {
      setGuardOpen(true);
    } else {
      closeEntryForm();
    }
  }

  function handleDiscard() {
    setGuardOpen(false);
    closeEntryForm();
  }

  return (
    <>
      <UnsavedEntryGuard
        open={guardOpen}
        onKeepEditing={() => setGuardOpen(false)}
        onDiscard={handleDiscard}
      />

      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              New {template.name}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Fill in the fields below and save to create this entry.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            disabled={saving}
            aria-label="Cancel"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {saveError && (
            <div className="flex items-start gap-3 p-4 mb-5 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{saveError}</p>
            </div>
          )}

          {sortedSections.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">This template has no sections defined.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedSections.map((section) => (
                <SectionAccordion
                  key={section.id}
                  catalogId={catalogId}
                  section={section}
                  formValues={formValues}
                  formDisplayValues={formDisplayValues}
                  formErrors={formErrors}
                  onFieldChange={handleFieldChange}
                  disabled={saving}
                  targetTemplateNames={targetTemplateNames}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-card flex-shrink-0">
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              "Save Entry"
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
