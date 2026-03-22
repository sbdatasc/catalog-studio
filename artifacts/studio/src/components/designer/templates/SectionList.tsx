import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SectionPanel } from "./SectionPanel";
import { useSchemaStore } from "@/stores/schemaStore";
import { useToast } from "@/hooks/use-toast";
import { apiClient, type Section, type AttributeDefinition, type CatalogTemplate } from "@/lib/apiClient";

interface Props {
  sections: Section[];
  templateId: string;
  isReferenceDataTemplate: boolean;
  isCatalogLocked: boolean;
  onEditSection: (section: Section) => void;
  onDeleteSection: (section: Section) => void;
  onDeleteAttribute: (attr: AttributeDefinition) => void;
  allTemplates: CatalogTemplate[];
  allRefDataTemplates: CatalogTemplate[];
}

export function SectionList({
  sections,
  templateId,
  isReferenceDataTemplate,
  isCatalogLocked,
  onEditSection,
  onDeleteSection,
  onDeleteAttribute,
  allTemplates,
  allRefDataTemplates,
}: Props) {
  const { reorderSectionsLocal } = useSchemaStore();
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Build new ordered list
    const newOrder = [...sections];
    const [moved] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, moved);
    const orderedIds = newOrder.map((s) => s.id);

    // Snapshot for revert
    const snapshot = sections.map((s) => s.id);

    // Optimistic update
    reorderSectionsLocal(templateId, orderedIds);

    const { error } = await apiClient.schema.reorderSections(templateId, orderedIds);
    if (error) {
      reorderSectionsLocal(templateId, snapshot);
      toast({ title: "Could not save new order. Reverting.", variant: "destructive" });
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {sections.map((section) => (
            <SectionPanel
              key={section.id}
              section={section}
              templateId={templateId}
              isReferenceDataTemplate={isReferenceDataTemplate}
              isCatalogLocked={isCatalogLocked}
              onEditSection={onEditSection}
              onDeleteSection={onDeleteSection}
              onDeleteAttribute={onDeleteAttribute}
              allTemplates={allTemplates}
              allRefDataTemplates={allRefDataTemplates}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
