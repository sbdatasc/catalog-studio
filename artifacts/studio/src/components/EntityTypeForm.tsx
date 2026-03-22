import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { EntityType, apiClient } from "@/lib/apiClient";
import { useUiStore } from "@/stores/uiStore";
import { useSchemaStore } from "@/stores/schemaStore";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle } from "lucide-react";
import { DrawerShell } from "./DrawerShell";

export function EntityTypeDrawer() {
  const { drawerMode, drawerEntityTypeId, setDrawerIsDirty, requestCloseDrawer } = useUiStore();
  const { entityTypes, addEntityType, updateEntityType, fetchEntityTypes } = useSchemaStore();
  const { toast } = useToast();

  const isOpen = drawerMode !== "closed";
  const entityType = drawerMode === "edit" ? entityTypes.find(e => e.id === drawerEntityTypeId) : null;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  // Initialize form
  useEffect(() => {
    if (isOpen) {
      setName(entityType?.name || "");
      setDescription(entityType?.description || "");
      setInlineError(null);
      setBannerError(null);
      setDrawerIsDirty(false);
    }
  }, [isOpen, entityType, setDrawerIsDirty]);

  // Track dirty state
  useEffect(() => {
    if (!isOpen) return;
    const initialName = entityType?.name || "";
    const initialDesc = entityType?.description || "";
    const isDirty = name !== initialName || description !== initialDesc;
    setDrawerIsDirty(isDirty);
  }, [name, description, entityType, isOpen, setDrawerIsDirty]);

  const handleSubmit = async () => {
    setInlineError(null);
    setBannerError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setInlineError("Name is required.");
      return;
    }

    setIsSubmitting(true);

    if (drawerMode === "create") {
      const { data, error } = await apiClient.schema.createEntityType({
        name: trimmedName,
        description: description.trim() || null
      });

      setIsSubmitting(false);

      if (error) {
        if (error.code === "CONFLICT") setInlineError("An entity type with this name already exists.");
        else if (error.code === "VALIDATION_ERROR") setInlineError("Name is required.");
        else setBannerError("Something went wrong. Please try again.");
        return;
      }

      if (data) {
        addEntityType(data);
        useUiStore.getState().closeDrawer();
        toast({ title: "Success", description: "Entity type created" });
      }
    } else if (drawerMode === "edit" && entityType) {
      const { data, error } = await apiClient.schema.updateEntityType(entityType.id, {
        name: trimmedName,
        description: description.trim() || null
      });

      setIsSubmitting(false);

      if (error) {
        if (error.code === "CONFLICT") setInlineError("An entity type with this name already exists.");
        else if (error.code === "NOT_FOUND") setBannerError("This entity type no longer exists. It may have been deleted.");
        else setBannerError("Something went wrong. Please try again.");
        return;
      }

      if (data) {
        updateEntityType(data);
        useUiStore.getState().closeDrawer();
        toast({ title: "Success", description: "Entity type saved" });
      }
    }
  };

  const isSeedNameReadonly = drawerMode === "edit" && entityType?.isSystemSeed;

  const footer = (
    <>
      <Button 
        variant="outline" 
        onClick={requestCloseDrawer} 
        disabled={isSubmitting}
        data-testid="button-cancel-drawer"
      >
        Cancel
      </Button>
      <Button 
        onClick={handleSubmit} 
        disabled={isSubmitting}
        data-testid="button-save-entity-type"
      >
        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {drawerMode === "create" ? "Create Entity Type" : "Save Changes"}
      </Button>
    </>
  );

  return (
    <DrawerShell 
      isOpen={isOpen} 
      title={drawerMode === "create" ? "New Entity Type" : "Edit Entity Type"}
      footer={footer}
    >
      <div className="space-y-6">
        {bannerError && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg flex items-start gap-2 border border-destructive/20">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p>{bannerError}</p>
              {bannerError.includes("no longer exists") && (
                <Button 
                  variant="link" 
                  className="h-auto p-0 text-destructive font-semibold mt-1"
                  onClick={() => {
                    useUiStore.getState().closeDrawer();
                    fetchEntityTypes();
                  }}
                >
                  Close & Refresh
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
          <Input 
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Data Contract"
            maxLength={100}
            readOnly={isSeedNameReadonly}
            className={inlineError ? "border-destructive focus-visible:ring-destructive/20" : ""}
            autoFocus={drawerMode === "create"}
            data-testid="input-entity-type-name"
          />
          {inlineError && (
            <p className="text-sm text-destructive font-medium mt-1">{inlineError}</p>
          )}
          {isSeedNameReadonly && (
            <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 text-xs rounded-md border border-amber-200/50 dark:border-amber-900/50">
              Seed entity type names cannot be changed.
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea 
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description..."
            maxLength={500}
            className="min-h-[120px] resize-none"
            data-testid="textarea-entity-type-description"
          />
          <p className="text-xs text-muted-foreground text-right">
            {description.length} / 500
          </p>
        </div>
      </div>
    </DrawerShell>
  );
}
