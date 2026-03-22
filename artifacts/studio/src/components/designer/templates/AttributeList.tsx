import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AttributeRow } from "./AttributeRow";
import { AttributeInlineForm } from "./AttributeInlineForm";
import { useSchemaStore } from "@/stores/schemaStore";
import { useToast } from "@/hooks/use-toast";
import { apiClient, type AttributeDefinition, type CatalogTemplate } from "@/lib/apiClient";

interface Props {
  sectionId: string;
  templateId: string;
  isReferenceDataTemplate: boolean;
  isCatalogLocked: boolean;
  onDeleteAttribute: (attr: AttributeDefinition) => void;
  allTemplates: CatalogTemplate[];
  allRefDataTemplates: CatalogTemplate[];
}

type FormState = "hidden" | "add" | { editAttrId: string };

export function AttributeList({
  sectionId,
  templateId,
  isReferenceDataTemplate,
  isCatalogLocked,
  onDeleteAttribute,
  allTemplates,
  allRefDataTemplates,
}: Props) {
  const { attributesBySection, attributesLoading, fetchAttributes, reorderAttributesLocal } = useSchemaStore();
  const { toast } = useToast();

  const [formState, setFormState] = useState<FormState>("hidden");

  const attributes = attributesBySection[sectionId];
  const loading = attributesLoading[sectionId];

  // Fetch on mount if not yet loaded
  useEffect(() => {
    if (attributes === undefined && !loading) {
      fetchAttributes(sectionId);
    }
  }, [sectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const editAttrId = typeof formState === "object" ? formState.editAttrId : null;

  // -------------------------------------------------------------------------
  // Attribute reorder
  // -------------------------------------------------------------------------
  async function handleMoveUp(index: number) {
    if (!attributes || index === 0) return;
    const newOrder = [...attributes];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    const orderedIds = newOrder.map((a) => a.id);
    const snapshot = [...attributes];
    reorderAttributesLocal(sectionId, orderedIds);

    const { error } = await apiClient.schema.reorderAttributes(sectionId, orderedIds);
    if (error) {
      reorderAttributesLocal(sectionId, snapshot.map((a) => a.id));
      toast({ title: "Could not save new order. Reverting.", variant: "destructive" });
    }
  }

  async function handleMoveDown(index: number) {
    if (!attributes || index === attributes.length - 1) return;
    const newOrder = [...attributes];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    const orderedIds = newOrder.map((a) => a.id);
    const snapshot = [...attributes];
    reorderAttributesLocal(sectionId, orderedIds);

    const { error } = await apiClient.schema.reorderAttributes(sectionId, orderedIds);
    if (error) {
      reorderAttributesLocal(sectionId, snapshot.map((a) => a.id));
      toast({ title: "Could not save new order. Reverting.", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-4 space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-9 bg-muted/40 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {!attributes || attributes.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground italic">
          No attributes yet. Add the first attribute below.
        </p>
      ) : (
        <div className="space-y-0.5">
          {attributes.map((attr, i) =>
            editAttrId === attr.id ? (
              <div key={attr.id} className="px-4 py-2">
                <AttributeInlineForm
                  sectionId={sectionId}
                  templateId={templateId}
                  isReferenceDataTemplate={isReferenceDataTemplate}
                  editAttribute={attr}
                  allTemplates={allTemplates}
                  allRefDataTemplates={allRefDataTemplates}
                  onCancel={() => setFormState("hidden")}
                  onSuccess={() => setFormState("hidden")}
                />
              </div>
            ) : (
              <AttributeRow
                key={attr.id}
                attribute={attr}
                isFirst={i === 0}
                isLast={i === attributes.length - 1}
                isCatalogLocked={isCatalogLocked}
                onEdit={() => {
                  setFormState({ editAttrId: attr.id });
                }}
                onDelete={() => onDeleteAttribute(attr)}
                onMoveUp={() => handleMoveUp(i)}
                onMoveDown={() => handleMoveDown(i)}
              />
            ),
          )}
        </div>
      )}

      {/* Add Attribute inline form or button */}
      {!isCatalogLocked && (
        <div className="px-4 py-2">
          {formState === "add" ? (
            <AttributeInlineForm
              sectionId={sectionId}
              templateId={templateId}
              isReferenceDataTemplate={isReferenceDataTemplate}
              allTemplates={allTemplates}
              allRefDataTemplates={allRefDataTemplates}
              onCancel={() => setFormState("hidden")}
              onSuccess={() => setFormState("hidden")}
            />
          ) : formState === "hidden" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFormState("add")}
              className="text-muted-foreground hover:text-foreground text-xs"
              data-testid={`button-add-attribute-${sectionId}`}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Attribute
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
