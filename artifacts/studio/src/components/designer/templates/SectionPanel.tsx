import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SectionHeader } from "./SectionHeader";
import { AttributeList } from "./AttributeList";
import type { Section, AttributeDefinition, CatalogTemplate } from "@/lib/apiClient";

interface Props {
  section: Section;
  templateId: string;
  isReferenceDataTemplate: boolean;
  isCatalogLocked: boolean;
  onEditSection: (section: Section) => void;
  onDeleteSection: (section: Section) => void;
  onDeleteAttribute: (attr: AttributeDefinition) => void;
  allTemplates: CatalogTemplate[];
  allRefDataTemplates: CatalogTemplate[];
}

export function SectionPanel({
  section,
  templateId,
  isReferenceDataTemplate,
  isCatalogLocked,
  onEditSection,
  onDeleteSection,
  onDeleteAttribute,
  allTemplates,
  allRefDataTemplates,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(true);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    disabled: isCatalogLocked,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : undefined,
  };

  const dragHandleProps = { ...attributes, ...listeners };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-border rounded-lg bg-card overflow-hidden"
      data-testid={`section-panel-${section.id}`}
    >
      <SectionHeader
        name={section.name}
        attributeCount={section.attributeCount}
        isExpanded={isExpanded}
        isCatalogLocked={isCatalogLocked}
        dragHandleProps={dragHandleProps}
        onToggle={() => setIsExpanded((v) => !v)}
        onEdit={() => onEditSection(section)}
        onDelete={() => onDeleteSection(section)}
      />

      {isExpanded && (
        <div className="border-t border-border/50 pb-2">
          <AttributeList
            sectionId={section.id}
            templateId={templateId}
            isReferenceDataTemplate={isReferenceDataTemplate}
            isCatalogLocked={isCatalogLocked}
            onDeleteAttribute={onDeleteAttribute}
            allTemplates={allTemplates}
            allRefDataTemplates={allRefDataTemplates}
          />
        </div>
      )}
    </div>
  );
}
