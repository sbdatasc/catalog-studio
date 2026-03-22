import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Plus, ChevronRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionList } from "./SectionList";
import { SectionDrawer } from "./SectionDrawer";
import { DeleteSectionModal } from "./DeleteSectionModal";
import { DeleteAttributeModal } from "./DeleteAttributeModal";
import { DesignerNav } from "@/components/DesignerNav";
import { TemplateRelationshipsTab } from "@/components/designer/relationships/TemplateRelationshipsTab";
import { RelationshipDrawer } from "@/components/designer/relationships/RelationshipDrawer";
import { DeleteRelationshipModal } from "@/components/designer/relationships/DeleteRelationshipModal";
import { useSchemaStore } from "@/stores/schemaStore";
import { useUiStore } from "@/stores/uiStore";
import { apiClient, type CatalogTemplate, type Section, type AttributeDefinition } from "@/lib/apiClient";

interface Props {
  catalogId: string;
  templateId: string;
  /** "templates" or "reference-data" — determines breadcrumb + nav tab */
  tabContext: "templates" | "reference-data";
}

type PageTab = "sections" | "relationships";

export function TemplateDetailPage({ catalogId, templateId, tabContext }: Props) {
  const {
    sectionsByTemplate,
    sectionsLoading,
    fetchSections,
    templates,
    referenceDataTemplates,
    fetchTemplates,
    fetchReferenceDataTemplates,
  } = useSchemaStore();

  const {
    activeCatalogStatus,
    setActiveCatalog,
    clearActiveCatalog,
    openCreateSectionDrawer,
    openEditSectionDrawer,
  } = useUiStore();

  const [template, setTemplate] = useState<CatalogTemplate | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PageTab>("sections");

  // Section/attribute delete modal state (local — not in uiStore)
  const [deleteSectionTarget, setDeleteSectionTarget] = useState<Section | null>(null);
  const [deleteAttrTarget, setDeleteAttrTarget] = useState<AttributeDefinition | null>(null);

  const isCatalogLocked = activeCatalogStatus !== null && activeCatalogStatus !== "draft";

  // -------------------------------------------------------------------------
  // Load catalog + template + sections on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: catalogData } = await apiClient.catalogs.get(catalogId);
      if (catalogData && !cancelled) {
        setActiveCatalog(catalogData.id, catalogData.status);
      }

      const { data: tplData, error: tplError } = await apiClient.schema.getTemplate(templateId);
      if (cancelled) return;
      if (tplError || !tplData) {
        setLoadError("Could not load this template. Please try again.");
        return;
      }
      setTemplate(tplData);

      await fetchSections(templateId);

      if (catalogData) {
        fetchTemplates(catalogId);
        fetchReferenceDataTemplates(catalogId);
      }
    }

    load();
    return () => {
      cancelled = true;
      clearActiveCatalog();
    };
  }, [catalogId, templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sections = sectionsByTemplate[templateId] ?? [];
  const sectionsAreLoading = sectionsLoading[templateId] ?? false;

  const breadcrumbTabLabel = tabContext === "templates" ? "Templates" : "Reference Data";
  const breadcrumbTabHref = `/catalogs/${catalogId}/designer/${tabContext}`;

  const availableRefTargets = templates.filter((t) => t.id !== templateId);
  const availableRefDataTargets = referenceDataTemplates;

  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <DesignerNav catalogId={catalogId} tab={tabContext} />

      <div className="flex-1 overflow-auto">
        <div className="max-w-[900px] mx-auto p-6 md:p-8 lg:p-10 space-y-6">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>Designer</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link
              href={breadcrumbTabHref}
              className="hover:text-foreground transition-colors"
              data-testid="breadcrumb-back-templates"
            >
              {breadcrumbTabLabel}
            </Link>
            {template && (
              <>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="text-foreground font-medium">{template.name}</span>
              </>
            )}
          </nav>

          {/* Catalog lock banner */}
          {isCatalogLocked && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800/50 dark:text-amber-300">
              <Lock className="w-4 h-4 shrink-0" />
              <div className="flex-1 text-sm">
                <span className="font-medium">This catalog is locked.</span>{" "}
                Schema editing is disabled. Duplicate the catalog to make changes.
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-700"
                onClick={async () => {
                  const { data } = await apiClient.catalogs.duplicate(catalogId);
                  if (data) {
                    window.location.href = `/catalogs/${data.id}/designer/${tabContext}/${templateId}`;
                  }
                }}
              >
                Duplicate Catalog
              </Button>
            </div>
          )}

          {/* Error state */}
          {loadError && (
            <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <span>{loadError}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setLoadError(null); fetchSections(templateId); }}
              >
                Retry
              </Button>
            </div>
          )}

          {/* Page header */}
          {template && (
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">
                    {template.name}
                  </h1>
                  {template.isReferenceData && (
                    <Badge
                      variant="secondary"
                      className="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 pointer-events-none"
                    >
                      Reference Data
                    </Badge>
                  )}
                  {template.isSystemSeed && (
                    <Badge
                      variant="secondary"
                      className="bg-muted text-muted-foreground pointer-events-none"
                    >
                      System
                    </Badge>
                  )}
                </div>
                {template.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
                )}
              </div>

              {/* Tab-aware action button */}
              {!isCatalogLocked && activeTab === "sections" && (
                <Button
                  onClick={() => openCreateSectionDrawer(templateId)}
                  className="shrink-0"
                  data-testid="button-add-section"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Section
                </Button>
              )}
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-6 border-b border-border">
            {(["sections", "relationships"] as PageTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={[
                  "h-10 flex items-center border-b-2 text-sm font-medium px-1 transition-colors capitalize -mb-px",
                  activeTab === tab
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                ].join(" ")}
                data-testid={`tab-${tab}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "sections" && (
            <>
              {sectionsAreLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted/40 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : sections.length === 0 && !loadError ? (
                <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-xl">
                  <p className="text-muted-foreground text-sm mb-4">
                    No sections yet. Create your first section to start defining attributes.
                  </p>
                  {!isCatalogLocked && (
                    <Button
                      variant="outline"
                      onClick={() => openCreateSectionDrawer(templateId)}
                      data-testid="button-add-section-empty"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Section
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <SectionList
                    sections={sections}
                    templateId={templateId}
                    isReferenceDataTemplate={template?.isReferenceData ?? false}
                    isCatalogLocked={isCatalogLocked}
                    onEditSection={(s) => openEditSectionDrawer(templateId, s.id)}
                    onDeleteSection={(s) => setDeleteSectionTarget(s)}
                    onDeleteAttribute={(attr) => setDeleteAttrTarget(attr)}
                    allTemplates={availableRefTargets}
                    allRefDataTemplates={availableRefDataTargets}
                  />

                  {!isCatalogLocked && (
                    <div className="flex justify-center pt-2">
                      <Button
                        variant="outline"
                        onClick={() => openCreateSectionDrawer(templateId)}
                        className="text-muted-foreground"
                        data-testid="button-add-section-footer"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Section
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === "relationships" && (
            <TemplateRelationshipsTab
              catalogId={catalogId}
              templateId={templateId}
              isLocked={isCatalogLocked}
            />
          )}
        </div>
      </div>

      {/* Section drawer */}
      <SectionDrawer />

      {/* Relationship drawer & delete */}
      <RelationshipDrawer catalogId={catalogId} isLocked={isCatalogLocked} />
      <DeleteRelationshipModal catalogId={catalogId} />

      {/* Section/Attribute delete modals */}
      <DeleteSectionModal
        section={deleteSectionTarget}
        templateId={templateId}
        onClose={() => setDeleteSectionTarget(null)}
      />
      <DeleteAttributeModal
        attribute={deleteAttrTarget}
        onClose={() => setDeleteAttrTarget(null)}
      />
    </div>
  );
}
