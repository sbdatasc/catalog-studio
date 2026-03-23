import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronRight, Loader2, AlertCircle, ArrowLeft, Pencil, Trash2, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useEntryStore } from "@/stores/entryStore";
import { useSchemaStore } from "@/stores/schemaStore";
import { useUiStore } from "@/stores/uiStore";
import { apiClient } from "@/lib/apiClient";
import type { CatalogEntry, SnapshotTemplate } from "@/lib/apiClient";
import { SectionAccordion } from "@/components/operational/SectionAccordion";
import { AttributeDisplay } from "@/components/operational/AttributeDisplay";
import { SchemaMismatchBanner } from "@/components/operational/SchemaMismatchBanner";
import { UnsavedEntryGuard } from "@/components/operational/UnsavedEntryGuard";
import { DeleteEntryModal } from "@/components/operational/DeleteEntryModal";
import { RelatedEntriesSection } from "@/components/operational/RelatedEntriesSection";
import { RelationshipsTab } from "@/components/operational/RelationshipsTab";

interface Props {
  catalogId: string;
  templateId: string;
  entryId: string;
}

type PageMode = "loading" | "read" | "editing" | "saving" | "error" | "not-found";
type ActiveTab = "details" | "relationships";

export function EntryDetailPage({ catalogId, templateId, entryId }: Props) {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const activeEntry = useEntryStore((s) => s.activeEntry);
  const activeEntryLoading = useEntryStore((s) => s.activeEntryLoading);
  const activeEntryError = useEntryStore((s) => s.activeEntryError);
  const fetchEntry = useEntryStore((s) => s.fetchEntry);
  const updateEntryInStore = useEntryStore((s) => s.updateEntry);

  const publishedSchemasByCatalog = useSchemaStore((s) => s.publishedSchemasByCatalog);
  const publishedVersionIdByCatalog = useSchemaStore((s) => s.publishedVersionIdByCatalog);
  const fetchPublishedSchema = useSchemaStore((s) => s.fetchPublishedSchema);

  const setActiveCatalog = useUiStore((s) => s.setActiveCatalog);

  const [mode, setMode] = useState<PageMode>("loading");
  const [activeTab, setActiveTab] = useState<ActiveTab>("details");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string | null>>({});
  const [formDisplayValues, setFormDisplayValues] = useState<Record<string, string | null>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [guardOpen, setGuardOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const snapshot = publishedSchemasByCatalog[catalogId];

  useEffect(() => {
    setActiveCatalog(catalogId, "published");
    fetchPublishedSchema(catalogId);
    fetchEntry(entryId);
  }, [entryId, catalogId, setActiveCatalog, fetchPublishedSchema, fetchEntry]);

  useEffect(() => {
    if (activeEntryLoading) {
      setMode("loading");
    } else if (activeEntryError) {
      const code = activeEntryError.code;
      setMode(code === "NOT_FOUND" ? "not-found" : "error");
    } else if (activeEntry && activeEntry.id === entryId) {
      setMode("read");
    }
  }, [activeEntryLoading, activeEntryError, activeEntry, entryId]);

  const template = useMemo<SnapshotTemplate | null>(() => {
    if (!snapshot) return null;
    return snapshot.templates.find((t) => t.id === templateId) ?? null;
  }, [snapshot, templateId]);

  const sortedSections = useMemo(() => {
    if (!template) return [];
    return template.sections.slice().sort((a, b) => a.displayOrder - b.displayOrder);
  }, [template]);

  const allAttributes = useMemo(
    () =>
      sortedSections.flatMap((s) =>
        s.attributes.slice().sort((a, b) => a.displayOrder - b.displayOrder),
      ),
    [sortedSections],
  );

  const targetTemplateNames = useMemo<Record<string, string>>(() => {
    if (!snapshot || !template) return {};
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
  }, [allAttributes, snapshot, template]);

  const currentVersionId = publishedVersionIdByCatalog[catalogId] ?? null;
  const isSchemaMismatch = useMemo(() => {
    if (!activeEntry || !currentVersionId) return false;
    return activeEntry.schemaVersionId !== currentVersionId;
  }, [activeEntry, currentVersionId]);

  const relationships = template?.relationships ?? [];
  const relCount = relationships.length;
  const useTabLayout = relCount >= 3;
  const useInlineLayout = relCount >= 1 && relCount < 3;

  const catalogStatus = snapshot?.templates.length ? "published" : undefined;
  const isDiscontinued = false;

  function enterEditMode() {
    if (!activeEntry) return;
    const init: Record<string, string | null> = {};
    const displayInit: Record<string, string | null> = {};
    for (const fv of activeEntry.fieldValues) {
      init[fv.attributeId] = fv.value;
      displayInit[fv.attributeId] = fv.displayValue;
    }
    for (const attr of allAttributes) {
      if (!(attr.id in init)) {
        init[attr.id] = null;
        displayInit[attr.id] = null;
      }
    }
    setFormValues(init);
    setFormDisplayValues(displayInit);
    setFormErrors({});
    setSaveError(null);
    setMode("editing");
    setActiveTab("details");
  }

  const isDirty = useMemo(() => {
    if (!activeEntry) return false;
    for (const attr of allAttributes) {
      const original = activeEntry.fieldValues.find((fv) => fv.attributeId === attr.id)?.value ?? null;
      const current = formValues[attr.id] ?? null;
      if (original !== current) return true;
    }
    return false;
  }, [activeEntry, allAttributes, formValues]);

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

    setMode("saving");
    setSaveError(null);

    const fieldValues = allAttributes.map((attr) => ({
      attributeId: attr.id,
      value: formValues[attr.id] ?? null,
    }));

    const { data, error } = await apiClient.entries.update(entryId, { fieldValues });

    if (error) {
      setMode("editing");
      const code = (error.details as { code?: string } | null)?.code ?? error.code;
      if (code === "REQUIRED_FIELD_MISSING") {
        const missing = allAttributes.find((a) => a.required && !formValues[a.id]);
        if (missing) {
          setFormErrors({ [missing.id]: "This field is required." });
        } else {
          setSaveError(error.message);
        }
        return;
      }
      setSaveError("Could not save changes. Please try again.");
      return;
    }

    if (data) {
      updateEntryInStore(data);
      toast({ title: "Entry updated", description: `"${data.displayName}" has been saved.` });
      setMode("read");
    }
  }

  function handleCancelEdit() {
    if (isDirty) {
      setGuardOpen(true);
    } else {
      setMode("read");
    }
  }

  const listPath = `/catalogs/${catalogId}/operational`;

  if (mode === "loading") {
    return (
      <div className="flex flex-col h-screen">
        <div className="h-14 border-b border-border bg-card px-6 flex items-center gap-2">
          <div className="w-4 h-4 bg-muted rounded animate-pulse" />
          <div className="w-32 h-4 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (mode === "not-found" || !activeEntry || activeEntry.id !== entryId) {
    return (
      <div className="flex flex-col h-screen">
        <div className="h-14 border-b border-border bg-card px-6 flex items-center">
          <Link href={listPath} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            Back to entries
          </Link>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">This entry no longer exists.</p>
          <Link href={listPath} className="text-sm text-primary hover:underline">
            Back to entry list
          </Link>
        </div>
      </div>
    );
  }

  if (mode === "error") {
    return (
      <div className="flex flex-col h-screen">
        <div className="h-14 border-b border-border bg-card px-6 flex items-center">
          <Link href={listPath} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            Back to entries
          </Link>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <p className="text-sm text-muted-foreground">Could not load this entry. Please refresh.</p>
        </div>
      </div>
    );
  }

  const isEditing = mode === "editing" || mode === "saving";

  return (
    <>
      <UnsavedEntryGuard
        open={guardOpen}
        onKeepEditing={() => setGuardOpen(false)}
        onDiscard={() => {
          setGuardOpen(false);
          setMode("read");
        }}
      />

      <DeleteEntryModal
        open={deleteOpen}
        entryId={entryId}
        displayName={activeEntry.displayName}
        templateId={templateId}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => navigate(listPath)}
      />

      <div className="flex flex-col h-screen overflow-hidden">
        {/* Breadcrumb bar */}
        <div className="h-14 border-b border-border bg-card px-6 flex items-center gap-2 flex-shrink-0">
          <Link
            href={listPath}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Operational
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          <Link
            href={listPath}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors truncate max-w-[120px]"
          >
            {template?.name ?? activeEntry.templateName}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm text-foreground font-medium truncate max-w-[200px]">
            {activeEntry.displayName}
          </span>
          {isEditing && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Edit</span>
            </>
          )}
        </div>

        {/* Page header */}
        <div className="px-6 py-4 border-b border-border bg-background flex items-center justify-between gap-4 flex-shrink-0">
          <div className="min-w-0">
            <h1 className="text-2xl font-display font-bold text-foreground truncate">
              {activeEntry.displayName}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{template?.name ?? activeEntry.templateName}</p>
          </div>

          {!isEditing ? (
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={enterEditMode}>
                <Pencil className="w-4 h-4 mr-1.5" />
                Edit Entry
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive border-destructive/40 hover:border-destructive hover:bg-destructive/5"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Delete Entry
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={mode === "saving"}>
                <X className="w-4 h-4 mr-1.5" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={mode === "saving"}>
                {mode === "saving" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-1.5" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Tab bar — only when ≥3 relationship types */}
        {!isEditing && useTabLayout && (
          <div className="flex border-b border-border bg-background px-6 gap-4 flex-shrink-0">
            <button
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "details"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("details")}
            >
              Details
            </button>
            <button
              className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === "relationships"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("relationships")}
            >
              Relationships
              {relCount > 0 && (
                <span className="text-xs bg-muted rounded-full px-1.5 py-0.5">{relCount}</span>
              )}
            </button>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {isSchemaMismatch && <SchemaMismatchBanner />}

          {saveError && (
            <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{saveError}</p>
            </div>
          )}

          {/* Tab: Relationships (≥3 rel types) */}
          {!isEditing && useTabLayout && activeTab === "relationships" && (
            <RelationshipsTab
              entryId={entryId}
              entryName={activeEntry.displayName}
              templateId={templateId}
              catalogId={catalogId}
              relationships={relationships}
              isDiscontinued={isDiscontinued}
            />
          )}

          {/* Details content */}
          {(!useTabLayout || isEditing || activeTab === "details") && (
            <>
              {sortedSections.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">No sections in this template.</p>
                </div>
              ) : isEditing ? (
                sortedSections.map((section) => (
                  <SectionAccordion
                    key={section.id}
                    catalogId={catalogId}
                    section={section}
                    formValues={formValues}
                    formDisplayValues={formDisplayValues}
                    formErrors={formErrors}
                    onFieldChange={handleFieldChange}
                    disabled={mode === "saving"}
                    targetTemplateNames={targetTemplateNames}
                  />
                ))
              ) : (
                sortedSections.map((section) => (
                  <ReadOnlySection
                    key={section.id}
                    section={section}
                    entry={activeEntry}
                    catalogId={catalogId}
                  />
                ))
              )}

              {/* Inline relationship surface (1–2 rel types) */}
              {!isEditing && useInlineLayout && (
                <RelatedEntriesSection
                  entryId={entryId}
                  entryName={activeEntry.displayName}
                  templateId={templateId}
                  catalogId={catalogId}
                  relationships={relationships}
                  isDiscontinued={isDiscontinued}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function ReadOnlySection({
  section,
  entry,
  catalogId,
}: {
  section: { id: string; name: string; attributes: Array<{ id: string; name: string; required: boolean; attributeType: string; displayOrder: number; config: unknown }> };
  entry: CatalogEntry;
  catalogId: string;
}) {
  const sortedAttrs = section.attributes
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground">{section.name}</h3>
      </div>
      <div className="p-5 space-y-4">
        {sortedAttrs.map((attr) => {
          const fieldValue = entry.fieldValues.find((fv) => fv.attributeId === attr.id);
          const hasValue = fieldValue?.value != null && fieldValue.value !== "";
          const isIncomplete = attr.required && !hasValue;

          return (
            <div key={attr.id}>
              <div className="flex items-center gap-2 mb-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {attr.name}
                  {attr.required && <span className="text-destructive ml-0.5">*</span>}
                </label>
                {isIncomplete && (
                  <span className="inline-flex items-center text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                    Incomplete
                  </span>
                )}
              </div>
              {fieldValue ? (
                <AttributeDisplay
                  field={fieldValue}
                  catalogId={catalogId}
                />
              ) : (
                <span className="text-sm text-muted-foreground italic">—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
