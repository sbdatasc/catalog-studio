import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { type CatalogTemplate, apiClient } from "@/lib/apiClient";
import { useUiStore } from "@/stores/uiStore";
import { useSchemaStore } from "@/stores/schemaStore";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle } from "lucide-react";
import { DrawerShell } from "./DrawerShell";

export function EntityTypeDrawer() {
  const { drawerMode, drawerTemplateId, setDrawerIsDirty, requestCloseDrawer } = useUiStore();
  const { templates, addTemplate, updateTemplate, fetchTemplates } = useSchemaStore();
  const { toast } = useToast();

  const isOpen = drawerMode !== "closed";
  const template: CatalogTemplate | null =
    drawerMode === "edit" ? (templates.find((t) => t.id === drawerTemplateId) ?? null) : null;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(template?.name ?? "");
      setDescription(template?.description ?? "");
      setInlineError(null);
      setBannerError(null);
      setDrawerIsDirty(false);
    }
  }, [isOpen, template, setDrawerIsDirty]);

  useEffect(() => {
    if (!isOpen) return;
    const initialName = template?.name ?? "";
    const initialDesc = template?.description ?? "";
    const isDirty = name !== initialName || description !== initialDesc;
    setDrawerIsDirty(isDirty);
  }, [name, description, template, isOpen, setDrawerIsDirty]);

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
      const { data, error } = await apiClient.schema.createTemplate({
        name: trimmedName,
        description: description.trim() || null,
      });

      setIsSubmitting(false);

      if (error) {
        if (error.code === "CONFLICT") setInlineError("A template with this name already exists.");
        else if (error.code === "VALIDATION_ERROR") setInlineError("Name is required.");
        else setBannerError("Something went wrong. Please try again.");
        return;
      }

      if (data) {
        addTemplate(data);
        useUiStore.getState().closeDrawer();
        toast({ title: "Success", description: "Template created" });
      }
    } else if (drawerMode === "edit" && template) {
      const { data, error } = await apiClient.schema.updateTemplate(template.id, {
        name: trimmedName,
        description: description.trim() || null,
      });

      setIsSubmitting(false);

      if (error) {
        if (error.code === "CONFLICT") setInlineError("A template with this name already exists.");
        else if (error.code === "NOT_FOUND")
          setBannerError("This template no longer exists. It may have been deleted.");
        else setBannerError("Something went wrong. Please try again.");
        return;
      }

      if (data) {
        updateTemplate(data);
        useUiStore.getState().closeDrawer();
        toast({ title: "Success", description: "Template saved" });
      }
    }
  };

  const isSeedNameReadonly = drawerMode === "edit" && template?.isSystemSeed;

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
        data-testid="button-save-template"
      >
        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {drawerMode === "create" ? "Create Template" : "Save Changes"}
      </Button>
    </>
  );

  return (
    <DrawerShell
      isOpen={isOpen}
      title={drawerMode === "create" ? "New Template" : "Edit Template"}
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
                    fetchTemplates();
                  }}
                >
                  Close & Refresh
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="name">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Data Contract"
            maxLength={100}
            readOnly={isSeedNameReadonly}
            className={inlineError ? "border-destructive focus-visible:ring-destructive/20" : ""}
            autoFocus={drawerMode === "create"}
            data-testid="input-template-name"
          />
          {inlineError && (
            <p className="text-sm text-destructive font-medium mt-1">{inlineError}</p>
          )}
          {isSeedNameReadonly && (
            <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 text-xs rounded-md border border-amber-200/50 dark:border-amber-900/50">
              System template names cannot be changed.
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
            data-testid="textarea-template-description"
          />
          <p className="text-xs text-muted-foreground text-right">{description.length} / 500</p>
        </div>
      </div>
    </DrawerShell>
  );
}
