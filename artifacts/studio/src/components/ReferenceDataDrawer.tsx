import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DrawerShell } from "./DrawerShell";
import { type ReferenceDataset, apiClient } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle } from "lucide-react";
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

interface Props {
  mode: "closed" | "create" | "edit";
  dataset: ReferenceDataset | null;
  onClose: () => void;
  onSuccess: (dataset: ReferenceDataset) => void;
}

export function ReferenceDataDrawer({ mode, dataset, onClose, onSuccess }: Props) {
  const { toast } = useToast();
  const isOpen = mode !== "closed";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [showDiscardGuard, setShowDiscardGuard] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(dataset?.name ?? "");
      setDescription(dataset?.description ?? "");
      setIsDirty(false);
      setInlineError(null);
      setBannerError(null);
      setShowDiscardGuard(false);
    }
  }, [isOpen, dataset]);

  useEffect(() => {
    if (!isOpen) return;
    const initialName = dataset?.name ?? "";
    const initialDesc = dataset?.description ?? "";
    setIsDirty(name !== initialName || description !== initialDesc);
  }, [name, description, dataset, isOpen]);

  const handleRequestClose = () => {
    if (isDirty) {
      setShowDiscardGuard(true);
    } else {
      onClose();
    }
  };

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
      const { data, error } = await apiClient.referenceData.createDataset({
        name: trimmedName,
        description: description.trim() || null,
      });
      setIsSubmitting(false);
      if (error) {
        if (error.code === "CONFLICT") setInlineError("A dataset with this name already exists.");
        else setBannerError("Something went wrong. Please try again.");
        return;
      }
      if (data) {
        toast({ title: "Success", description: "Reference dataset created." });
        onSuccess(data);
      }
    } else if (mode === "edit" && dataset) {
      const { data, error } = await apiClient.referenceData.updateDataset(dataset.id, {
        name: trimmedName,
        description: description.trim() || null,
      });
      setIsSubmitting(false);
      if (error) {
        if (error.code === "CONFLICT") setInlineError("A dataset with this name already exists.");
        else if (error.code === "NOT_FOUND") setBannerError("This dataset no longer exists.");
        else setBannerError("Something went wrong. Please try again.");
        return;
      }
      if (data) {
        toast({ title: "Success", description: "Reference dataset saved." });
        onSuccess(data);
      }
    }
  };

  const footer = (
    <>
      <Button
        variant="outline"
        onClick={handleRequestClose}
        disabled={isSubmitting}
        data-testid="button-cancel-dataset-drawer"
      >
        Cancel
      </Button>
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting}
        data-testid="button-save-dataset"
      >
        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {mode === "create" ? "Create Dataset" : "Save Changes"}
      </Button>
    </>
  );

  return (
    <>
      <DrawerShell
        isOpen={isOpen}
        title={mode === "create" ? "New Reference Dataset" : "Edit Reference Dataset"}
        footer={footer}
        onRequestClose={handleRequestClose}
      >
        <div className="space-y-6">
          {bannerError && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg flex items-start gap-2 border border-destructive/20">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{bannerError}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="dataset-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dataset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Data Domains"
              maxLength={100}
              className={inlineError ? "border-destructive focus-visible:ring-destructive/20" : ""}
              autoFocus={mode === "create"}
              data-testid="input-dataset-name"
            />
            {inlineError && (
              <p className="text-sm text-destructive font-medium">{inlineError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataset-description">Description</Label>
            <Textarea
              id="dataset-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              maxLength={500}
              className="min-h-[120px] resize-none"
              data-testid="textarea-dataset-description"
            />
            <p className="text-xs text-muted-foreground text-right">{description.length} / 500</p>
          </div>
        </div>
      </DrawerShell>

      <AlertDialog open={showDiscardGuard} onOpenChange={(open) => !open && setShowDiscardGuard(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDiscardGuard(false)}>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDiscardGuard(false);
                onClose();
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
