import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Plus, Pencil, Copy, ChevronRight, Database, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DrawerShell } from "@/components/DrawerShell";
import { useCatalogStore } from "@/stores/catalogStore";
import { apiClient, type Catalog, type CatalogStatus } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<CatalogStatus, string> = {
  draft: "Draft",
  pilot: "Pilot",
  published: "Published",
  discontinued: "Discontinued",
};

const STATUS_CLASS: Record<CatalogStatus, string> = {
  draft: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  pilot: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  published: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400",
  discontinued: "bg-muted text-muted-foreground",
};

const NEXT_STATUS: Partial<Record<CatalogStatus, { status: CatalogStatus; label: string }>> = {
  draft: { status: "pilot", label: "Move to Pilot" },
  pilot: { status: "published", label: "Publish" },
  published: { status: "discontinued", label: "Discontinue" },
};

function formatDate(d: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(d),
  );
}

// ---------------------------------------------------------------------------
// CatalogCard
// ---------------------------------------------------------------------------

interface CatalogCardProps {
  catalog: Catalog;
  onEdit: () => void;
  onTransition: () => void;
  onDuplicate: () => void;
  onOpen: () => void;
}

function CatalogCard({ catalog, onEdit, onTransition, onDuplicate, onOpen }: CatalogCardProps) {
  const next = NEXT_STATUS[catalog.status];

  return (
    <div
      className="group relative flex flex-col bg-card rounded-xl border border-border p-5 hover-elevate transition-all duration-200 cursor-pointer"
      onClick={onOpen}
      data-testid={`card-catalog-${catalog.id}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Database className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-display font-semibold text-foreground text-lg truncate">
            {catalog.name}
          </h3>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Badge
            variant="secondary"
            className={`text-xs font-medium pointer-events-none ${STATUS_CLASS[catalog.status]}`}
          >
            {STATUS_LABEL[catalog.status]}
          </Badge>
        </div>
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px] leading-relaxed">
        {catalog.description ? (
          catalog.description
        ) : (
          <span className="italic opacity-70">No description</span>
        )}
      </p>

      <div className="mt-5 pt-4 border-t border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
          <span>
            {catalog.templateCount} {catalog.templateCount === 1 ? "template" : "templates"}
          </span>
          <span>·</span>
          <span>Updated {formatDate(catalog.updatedAt)}</span>
        </div>

        <div
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {next && (
            <button
              onClick={onTransition}
              className="px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-md transition-colors"
              data-testid={`button-transition-catalog-${catalog.id}`}
            >
              {next.label}
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            data-testid={`button-edit-catalog-${catalog.id}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDuplicate}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            data-testid={`button-duplicate-catalog-${catalog.id}`}
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <ChevronRight
            className="w-4 h-4 text-muted-foreground cursor-pointer"
            onClick={onOpen}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CatalogDrawer (create / edit)
// ---------------------------------------------------------------------------

interface CatalogDrawerProps {
  mode: "closed" | "create" | "edit";
  catalog: Catalog | null;
  onClose: () => void;
  onCreated: (c: Catalog) => void;
  onUpdated: (c: Catalog) => void;
}

function CatalogDrawer({ mode, catalog, onClose, onCreated, onUpdated }: CatalogDrawerProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "closed") {
      setName(catalog?.name ?? "");
      setDescription(catalog?.description ?? "");
      setInlineError(null);
      setBannerError(null);
    }
  }, [mode, catalog]);

  const handleSubmit = async () => {
    setInlineError(null);
    setBannerError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setInlineError("Name is required.");
      return;
    }
    setIsSubmitting(true);

    if (mode === "create") {
      const { data, error } = await apiClient.catalogs.create({
        name: trimmedName,
        description: description.trim() || null,
      });
      setIsSubmitting(false);
      if (error) {
        if (error.code === "CONFLICT") setInlineError("A catalog with this name already exists.");
        else setBannerError("Something went wrong. Please try again.");
        return;
      }
      if (data) {
        onCreated(data);
        toast({ title: "Success", description: "Catalog created" });
      }
    } else if (mode === "edit" && catalog) {
      const { data, error } = await apiClient.catalogs.update(catalog.id, {
        name: trimmedName,
        description: description.trim() || null,
      });
      setIsSubmitting(false);
      if (error) {
        if (error.code === "CONFLICT") setInlineError("A catalog with this name already exists.");
        else setBannerError("Something went wrong. Please try again.");
        return;
      }
      if (data) {
        onUpdated(data);
        toast({ title: "Success", description: "Catalog updated" });
      }
    }
  };

  const footer = (
    <>
      <Button variant="outline" onClick={onClose} disabled={isSubmitting} data-testid="button-cancel-catalog-drawer">
        Cancel
      </Button>
      <Button onClick={handleSubmit} disabled={isSubmitting} data-testid="button-save-catalog">
        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {mode === "create" ? "Create Catalog" : "Save Changes"}
      </Button>
    </>
  );

  return (
    <DrawerShell
      isOpen={mode !== "closed"}
      title={mode === "create" ? "New Catalog" : "Edit Catalog"}
      footer={footer}
    >
      <div className="space-y-6">
        {bannerError && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg flex items-start gap-2 border border-destructive/20">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{bannerError}</p>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="catalog-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="catalog-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Enterprise Data Catalog"
            maxLength={100}
            className={inlineError ? "border-destructive focus-visible:ring-destructive/20" : ""}
            autoFocus={mode === "create"}
            data-testid="input-catalog-name"
          />
          {inlineError && <p className="text-sm text-destructive font-medium mt-1">{inlineError}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="catalog-description">Description</Label>
          <Textarea
            id="catalog-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the purpose of this catalog..."
            maxLength={500}
            className="min-h-[120px] resize-none"
            data-testid="textarea-catalog-description"
          />
          <p className="text-xs text-muted-foreground text-right">{description.length} / 500</p>
        </div>
      </div>
    </DrawerShell>
  );
}

// ---------------------------------------------------------------------------
// TransitionConfirmModal
// ---------------------------------------------------------------------------

interface TransitionModalProps {
  catalog: Catalog | null;
  onClose: () => void;
  onTransitioned: (c: Catalog) => void;
}

function TransitionConfirmModal({ catalog, onClose, onTransitioned }: TransitionModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = catalog ? NEXT_STATUS[catalog.status] : null;

  const handleConfirm = async () => {
    if (!catalog || !next) return;
    setIsLoading(true);
    setError(null);
    const { data, error: err } = await apiClient.catalogs.transition(catalog.id, next.status);
    setIsLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data) {
      onTransitioned(data);
      toast({ title: "Status updated", description: `Catalog moved to ${STATUS_LABEL[data.status]}` });
    }
  };

  return (
    <Dialog open={!!catalog && !!next} onOpenChange={(open) => { if (!open && !isLoading) onClose(); }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Confirm Status Change</DialogTitle>
          <DialogDescription className="sr-only">Move catalog to the next status</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-3">
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-start gap-2 border border-destructive/20">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Move <span className="font-semibold text-foreground">{catalog?.name}</span> from{" "}
            <span className="font-medium">{catalog ? STATUS_LABEL[catalog.status] : ""}</span> to{" "}
            <span className="font-medium">{next ? STATUS_LABEL[next.status] : ""}</span>?
          </p>
          {next?.status !== "draft" && (
            <p className="text-xs text-muted-foreground p-2 bg-muted rounded-md">
              Once a catalog is moved past Draft, schema edits are locked. Duplicate the catalog to make further changes.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading} data-testid="button-cancel-transition">
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading} data-testid="button-confirm-transition">
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {next?.label ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// CatalogsPage
// ---------------------------------------------------------------------------

export function CatalogsPage() {
  const [, navigate] = useLocation();
  const { catalogs, catalogsLoading, catalogsError, fetchCatalogs, addCatalog, updateCatalog } =
    useCatalogStore();
  const { toast } = useToast();

  const [drawerMode, setDrawerMode] = useState<"closed" | "create" | "edit">("closed");
  const [editingCatalog, setEditingCatalog] = useState<Catalog | null>(null);
  const [transitionTarget, setTransitionTarget] = useState<Catalog | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCatalogs();
  }, [fetchCatalogs]);

  const handleOpen = (catalog: Catalog) => {
    navigate(`/catalogs/${catalog.id}/designer/templates`);
  };

  const handleEdit = (catalog: Catalog) => {
    setEditingCatalog(catalog);
    setDrawerMode("edit");
  };

  const handleDuplicate = async (catalog: Catalog) => {
    setDuplicatingId(catalog.id);
    const { data, error } = await apiClient.catalogs.duplicate(catalog.id);
    setDuplicatingId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    if (data) {
      addCatalog(data);
      toast({ title: "Duplicated", description: `"${data.name}" created as a Draft` });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-[1400px] mx-auto px-6 md:px-8 lg:px-10 h-16 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
            <Database className="w-4 h-4" />
          </div>
          <span className="font-display font-semibold text-lg text-foreground">
            Data Catalog Studio
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto p-6 md:p-8 lg:p-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
              Catalogs
            </h1>
            <p className="mt-2 text-muted-foreground text-base">
              Manage your data catalogs and their schemas.
            </p>
          </div>
          <Button
            onClick={() => setDrawerMode("create")}
            className="shadow-md shadow-primary/10 hover:-translate-y-0.5 transition-transform"
            data-testid="button-new-catalog"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Catalog
          </Button>
        </div>

        {/* Grid */}
        {catalogsLoading && catalogs.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-5 h-[180px] flex flex-col">
                <Skeleton className="h-6 w-3/4 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6" />
                <div className="mt-auto pt-4 border-t border-border/50">
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : catalogsError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6 flex flex-col items-center justify-center text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-amber-600" />
            <p className="text-amber-800 font-medium">Could not load catalogs. Please try again.</p>
            <Button variant="outline" onClick={fetchCatalogs}>Retry</Button>
          </div>
        ) : catalogs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 flex flex-col items-center justify-center text-center bg-card/50">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
              <Database className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No catalogs yet.</h3>
            <p className="text-muted-foreground max-w-sm mb-6">
              Create your first catalog to start defining and managing your metadata schema.
            </p>
            <Button onClick={() => setDrawerMode("create")} data-testid="button-new-catalog-empty">
              New Catalog
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            {catalogs.map((catalog) => (
              <div key={catalog.id} className="relative">
                {duplicatingId === catalog.id && (
                  <div className="absolute inset-0 bg-background/60 rounded-xl flex items-center justify-center z-10">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                )}
                <CatalogCard
                  catalog={catalog}
                  onEdit={() => handleEdit(catalog)}
                  onTransition={() => setTransitionTarget(catalog)}
                  onDuplicate={() => handleDuplicate(catalog)}
                  onOpen={() => handleOpen(catalog)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Catalog Create / Edit Drawer */}
      <CatalogDrawer
        mode={drawerMode}
        catalog={editingCatalog}
        onClose={() => { setDrawerMode("closed"); setEditingCatalog(null); }}
        onCreated={(c) => { addCatalog(c); setDrawerMode("closed"); }}
        onUpdated={(c) => { updateCatalog(c); setDrawerMode("closed"); setEditingCatalog(null); }}
      />

      {/* Transition Confirm Modal */}
      <TransitionConfirmModal
        catalog={transitionTarget}
        onClose={() => setTransitionTarget(null)}
        onTransitioned={(c) => { updateCatalog(c); setTransitionTarget(null); }}
      />
    </div>
  );
}
