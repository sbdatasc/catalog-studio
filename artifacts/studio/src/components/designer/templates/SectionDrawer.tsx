import { useState, useEffect } from "react";
import { DrawerShell } from "@/components/DrawerShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUiStore } from "@/stores/uiStore";
import { useSchemaStore } from "@/stores/schemaStore";
import { apiClient } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import type { Section } from "@/lib/apiClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function SectionDrawer() {
  const {
    sectionDrawerMode,
    sectionDrawerTemplateId,
    sectionDrawerSectionId,
    sectionDrawerIsDirty,
    sectionGuardAction,
    requestCloseSectionDrawer,
    closeSectionDrawer,
    setSectionDrawerDirty,
    confirmSectionDiscard,
    cancelSectionDiscard,
  } = useUiStore();

  const { sectionsByTemplate, addSection, updateSection } = useSchemaStore();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const isOpen = sectionDrawerMode !== "closed";
  const isEdit = sectionDrawerMode === "edit";
  const title = isEdit ? "Edit Section" : "New Section";

  // Find the section to edit
  const existingSection: Section | undefined = (() => {
    if (!isEdit || !sectionDrawerTemplateId || !sectionDrawerSectionId) return undefined;
    return sectionsByTemplate[sectionDrawerTemplateId]?.find(
      (s) => s.id === sectionDrawerSectionId,
    );
  })();

  // Pre-populate on edit open
  useEffect(() => {
    if (sectionDrawerMode === "edit" && existingSection) {
      setName(existingSection.name);
      setDescription(existingSection.description ?? "");
      setSectionDrawerDirty(false);
      setNameError(null);
    } else if (sectionDrawerMode === "create") {
      setName("");
      setDescription("");
      setSectionDrawerDirty(false);
      setNameError(null);
    }
  }, [sectionDrawerMode, sectionDrawerSectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNameChange(v: string) {
    setName(v);
    setSectionDrawerDirty(true);
    if (nameError) setNameError(null);
  }

  function handleDescriptionChange(v: string) {
    setDescription(v);
    setSectionDrawerDirty(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      setNameError("Section name is required.");
      return;
    }
    if (!sectionDrawerTemplateId) return;

    setSaving(true);
    setNameError(null);

    if (isEdit && sectionDrawerSectionId) {
      const { data, error } = await apiClient.schema.updateSection(sectionDrawerSectionId, {
        name: name.trim(),
        description: description.trim() || null,
      });
      if (error) {
        if (error.code === "CONFLICT") {
          setNameError("A section with this name already exists in this template.");
        } else {
          toast({ title: "Failed to update section", description: error.message, variant: "destructive" });
        }
        setSaving(false);
        return;
      }
      if (data) {
        updateSection(data);
        toast({ title: "Section updated." });
        closeSectionDrawer();
      }
    } else {
      const { data, error } = await apiClient.schema.createSection(sectionDrawerTemplateId, {
        name: name.trim(),
        description: description.trim() || null,
      });
      if (error) {
        if (error.code === "CONFLICT") {
          setNameError("A section with this name already exists in this template.");
        } else {
          toast({ title: "Failed to create section", description: error.message, variant: "destructive" });
        }
        setSaving(false);
        return;
      }
      if (data) {
        addSection(sectionDrawerTemplateId, data);
        toast({ title: "Section created." });
        closeSectionDrawer();
      }
    }

    setSaving(false);
  }

  const isDirty = sectionDrawerIsDirty;

  return (
    <>
      <DrawerShell
        title={title}
        isOpen={isOpen}
        onRequestClose={requestCloseSectionDrawer}
        footer={
          <>
            <Button variant="outline" onClick={requestCloseSectionDrawer} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Section"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="section-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="section-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Core Metadata"
              maxLength={100}
              data-testid="input-section-name"
            />
            {nameError && (
              <p className="text-xs text-destructive mt-1">{nameError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="section-description">Description</Label>
            <Textarea
              id="section-description"
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="Optional — describe what data this section captures."
              rows={3}
              maxLength={500}
            />
          </div>
        </div>
      </DrawerShell>

      {/* Unsaved changes guard for section drawer */}
      <AlertDialog open={!!sectionGuardAction && isDirty}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. They will be lost if you close this panel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelSectionDiscard}>Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSectionDiscard} className="bg-destructive hover:bg-destructive/90">
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
