import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { Link, useParams, useLocation } from "wouter";
import { ChevronRight, GripVertical, Trash2, Pencil, Check, X, Plus, Loader2, AlertCircle } from "lucide-react";
import { DesignerNav } from "@/components/DesignerNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { type ReferenceDatasetWithValues, type ReferenceValue, apiClient } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { ReferenceDataDrawer } from "@/components/ReferenceDataDrawer";
import { type ReferenceDataset } from "@/lib/apiClient";
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

export function DatasetDetailPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const id = params.id;

  const [dataset, setDataset] = useState<ReferenceDatasetWithValues | null>(null);
  const [values, setValues] = useState<ReferenceValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [addLabel, setAddLabel] = useState("");
  const [addValue, setAddValue] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const reorderTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [editDrawerMode, setEditDrawerMode] = useState<"closed" | "edit">("closed");

  const fetchDataset = async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await apiClient.referenceData.getDataset(id);
    setLoading(false);
    if (error) {
      if (error.code === "NOT_FOUND") {
        navigate("/designer/reference-data", { replace: true });
        return;
      }
      setLoadError(error.message);
    } else if (data) {
      setDataset(data);
      setValues(data.values);
    }
  };

  useEffect(() => {
    fetchDataset();
  }, [id]);

  // ── Inline Edit ──────────────────────────────────────────────────────────────

  const startEdit = (v: ReferenceValue) => {
    setEditingId(v.id);
    setEditLabel(v.label);
    setEditValue(v.value === v.label ? "" : v.value);
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLabel("");
    setEditValue("");
    setEditError(null);
  };

  const saveEdit = async (v: ReferenceValue) => {
    const trimLabel = editLabel.trim();
    if (!trimLabel) {
      setEditError("Label is required.");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    const storedValue = editValue.trim() || trimLabel;
    const { data, error } = await apiClient.referenceData.updateValue(id, v.id, {
      label: trimLabel,
      value: storedValue,
    });
    setEditSaving(false);
    if (error) {
      if (error.code === "CONFLICT") {
        setEditError(`A value "${storedValue}" already exists in this dataset.`);
      } else {
        setEditError("Failed to save. Please try again.");
      }
      return;
    }
    if (data) {
      setValues((prev) => prev.map((r) => (r.id === v.id ? data : r)));
      setEditingId(null);
    }
  };

  const handleEditKeyDown = (e: KeyboardEvent, v: ReferenceValue) => {
    if (e.key === "Enter") saveEdit(v);
    if (e.key === "Escape") cancelEdit();
  };

  // ── Toggle Active ─────────────────────────────────────────────────────────────

  const toggleActive = async (v: ReferenceValue) => {
    setTogglingId(v.id);
    const { data, error } = await apiClient.referenceData.updateValue(id, v.id, {
      isActive: !v.isActive,
    });
    setTogglingId(null);
    if (error) {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
      return;
    }
    if (data) {
      setValues((prev) => prev.map((r) => (r.id === v.id ? data : r)));
    }
  };

  // ── Delete Value ──────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    setDeletingId(deleteConfirmId);
    setDeleteConfirmId(null);
    const { error } = await apiClient.referenceData.deleteValue(id, deleteConfirmId);
    setDeletingId(null);
    if (error) {
      toast({ title: "Error", description: "Failed to delete value.", variant: "destructive" });
      return;
    }
    setValues((prev) => prev.filter((r) => r.id !== deleteConfirmId));
    toast({ title: "Success", description: "Value deleted." });
  };

  // ── Add Value ─────────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    const trimLabel = addLabel.trim();
    if (!trimLabel) {
      setAddError("Label is required.");
      return;
    }
    setAddSaving(true);
    setAddError(null);
    const storedValue = addValue.trim() || trimLabel;
    const { data, error } = await apiClient.referenceData.createValue(id, {
      label: trimLabel,
      value: storedValue,
    });
    setAddSaving(false);
    if (error) {
      if (error.code === "CONFLICT") {
        setAddError(`A value "${storedValue}" already exists in this dataset.`);
      } else {
        setAddError("Failed to add value. Please try again.");
      }
      return;
    }
    if (data) {
      setValues((prev) => [...prev, data]);
      setAddLabel("");
      setAddValue("");
    }
  };

  const handleAddKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleAdd();
  };

  // ── Drag to Reorder ───────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, valueId: string) => {
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(valueId);
  };

  const handleDragOver = (e: React.DragEvent, valueId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(valueId);
  };

  const handleDrop = (e: React.DragEvent, dropId: string) => {
    e.preventDefault();
    if (!draggingId || draggingId === dropId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    const fromIdx = values.findIndex((v) => v.id === draggingId);
    const toIdx = values.findIndex((v) => v.id === dropId);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...values];
    const [item] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, item);
    setValues(reordered);
    setDraggingId(null);
    setDragOverId(null);

    if (reorderTimeout.current) clearTimeout(reorderTimeout.current);
    reorderTimeout.current = setTimeout(async () => {
      const { error } = await apiClient.referenceData.reorderValues(id, reordered.map((v) => v.id));
      if (error) {
        toast({ title: "Error", description: "Failed to save order.", variant: "destructive" });
        fetchDataset();
      }
    }, 500);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  // ── Dataset Edit Drawer ───────────────────────────────────────────────────────

  const handleDatasetUpdated = (updated: ReferenceDataset) => {
    if (dataset) {
      setDataset({ ...dataset, ...updated });
    }
    setEditDrawerMode("closed");
  };

  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col w-full bg-background">
        <DesignerNav />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (loadError || !dataset) {
    return (
      <div className="min-h-screen flex flex-col w-full bg-background">
        <DesignerNav />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <p className="text-muted-foreground">{loadError ?? "Dataset not found."}</p>
          <Button variant="outline" onClick={fetchDataset}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <DesignerNav />

      <div className="flex-1 overflow-auto">
        <div className="max-w-[900px] mx-auto p-6 md:p-8 lg:p-10 space-y-8">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="breadcrumb">
            <Link
              href="/designer/reference-data"
              className="hover:text-foreground transition-colors"
              data-testid="breadcrumb-reference-data"
            >
              Reference Data
            </Link>
            <ChevronRight className="w-4 h-4 opacity-50" />
            <span className="text-foreground font-medium truncate max-w-[300px]">{dataset.name}</span>
          </nav>

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground break-words">
                {dataset.name}
              </h1>
              {dataset.description ? (
                <p className="mt-2 text-muted-foreground text-base leading-relaxed">{dataset.description}</p>
              ) : (
                <p className="mt-2 text-muted-foreground text-base italic opacity-70">No description</p>
              )}
            </div>
            <Button
              variant="outline"
              onClick={() => setEditDrawerMode("edit")}
              className="shrink-0"
              data-testid="button-edit-dataset-header"
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>

          {/* Values Table */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Values</h2>

            {values.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground bg-card/50">
                No values yet. Add the first value below.
              </div>
            )}

            {values.length > 0 && (
              <div className="rounded-xl border border-border overflow-hidden bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="w-8 px-3 py-3" />
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Label</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Value</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                      <th className="w-20 px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {values.map((v) => {
                      const isEditing = editingId === v.id;
                      const isDragging = draggingId === v.id;
                      const isDragOver = dragOverId === v.id;

                      return (
                        <tr
                          key={v.id}
                          draggable={!isEditing}
                          onDragStart={(e) => handleDragStart(e, v.id)}
                          onDragOver={(e) => handleDragOver(e, v.id)}
                          onDrop={(e) => handleDrop(e, v.id)}
                          onDragEnd={handleDragEnd}
                          className={[
                            "group transition-colors",
                            isDragging ? "opacity-40" : "",
                            isDragOver ? "bg-primary/5 ring-1 ring-primary/20 ring-inset" : "hover:bg-muted/20",
                          ].join(" ")}
                          data-testid={`row-value-${v.id}`}
                        >
                          {/* Drag handle */}
                          <td className="px-3 py-3 text-muted-foreground/40 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-4 h-4" />
                          </td>

                          {/* Label */}
                          <td className="px-4 py-2">
                            {isEditing ? (
                              <div className="space-y-1">
                                <Input
                                  value={editLabel}
                                  onChange={(e) => setEditLabel(e.target.value)}
                                  onKeyDown={(e) => handleEditKeyDown(e, v)}
                                  placeholder="Label"
                                  className="h-8 text-sm"
                                  autoFocus
                                  data-testid={`input-edit-label-${v.id}`}
                                />
                                {editError && (
                                  <p className="text-xs text-destructive">{editError}</p>
                                )}
                              </div>
                            ) : (
                              <span
                                className="cursor-pointer hover:text-primary transition-colors"
                                onClick={() => startEdit(v)}
                                data-testid={`label-value-${v.id}`}
                              >
                                {v.label}
                              </span>
                            )}
                          </td>

                          {/* Value */}
                          <td className="px-4 py-2">
                            {isEditing ? (
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => handleEditKeyDown(e, v)}
                                placeholder="Same as label"
                                className="h-8 text-sm"
                                data-testid={`input-edit-value-${v.id}`}
                              />
                            ) : (
                              <span
                                className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                                onClick={() => startEdit(v)}
                                data-testid={`stored-value-${v.id}`}
                              >
                                {v.value === v.label ? (
                                  <span className="italic opacity-60">Same as label</span>
                                ) : (
                                  v.value
                                )}
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-2">
                            <button
                              onClick={() => !togglingId && toggleActive(v)}
                              disabled={!!togglingId}
                              className="focus:outline-none"
                              data-testid={`toggle-active-${v.id}`}
                            >
                              {togglingId === v.id ? (
                                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                              ) : (
                                <Badge
                                  variant={v.isActive ? "default" : "secondary"}
                                  className={[
                                    "text-xs font-normal cursor-pointer transition-opacity hover:opacity-80",
                                    v.isActive
                                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                      : "bg-muted text-muted-foreground",
                                  ].join(" ")}
                                >
                                  {v.isActive ? "Active" : "Inactive"}
                                </Badge>
                              )}
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-2">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => saveEdit(v)}
                                  disabled={editSaving}
                                  className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 rounded-md transition-colors"
                                  data-testid={`button-save-edit-${v.id}`}
                                >
                                  {editSaving ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  disabled={editSaving}
                                  className="p-1.5 text-muted-foreground hover:bg-muted rounded-md transition-colors"
                                  data-testid={`button-cancel-edit-${v.id}`}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => setDeleteConfirmId(v.id)}
                                  disabled={deletingId === v.id}
                                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                  data-testid={`button-delete-value-${v.id}`}
                                >
                                  {deletingId === v.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add Value Row */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-1">
                  <Input
                    value={addLabel}
                    onChange={(e) => setAddLabel(e.target.value)}
                    onKeyDown={handleAddKeyDown}
                    placeholder="Label (required)"
                    className={addError ? "border-destructive" : ""}
                    data-testid="input-add-label"
                  />
                  {addError && (
                    <p className="text-xs text-destructive">{addError}</p>
                  )}
                </div>
                <div className="flex-1">
                  <Input
                    value={addValue}
                    onChange={(e) => setAddValue(e.target.value)}
                    onKeyDown={handleAddKeyDown}
                    placeholder="Value (same as label if blank)"
                    data-testid="input-add-value"
                  />
                </div>
                <Button
                  onClick={handleAdd}
                  disabled={addSaving}
                  data-testid="button-add-value"
                >
                  {addSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span className="ml-1.5">Add</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Value Confirmation */}
      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this value?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing entries will retain their stored value. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dataset Edit Drawer */}
      <ReferenceDataDrawer
        mode={editDrawerMode}
        dataset={dataset}
        onClose={() => setEditDrawerMode("closed")}
        onSuccess={handleDatasetUpdated}
      />
    </div>
  );
}
