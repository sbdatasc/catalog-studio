import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { SnapshotSection } from "@/lib/apiClient";
import { AttributeField } from "./AttributeField";
import { cn } from "@/lib/utils";

interface Props {
  catalogId: string;
  section: SnapshotSection;
  formValues: Record<string, string | null>;
  formDisplayValues: Record<string, string | null>;
  formErrors: Record<string, string>;
  onFieldChange: (attributeId: string, value: string | null, displayValue?: string | null) => void;
  disabled?: boolean;
  targetTemplateNames?: Record<string, string>;
}

export function SectionAccordion({
  catalogId,
  section,
  targetTemplateNames,
  formValues,
  formDisplayValues,
  formErrors,
  onFieldChange,
  disabled,
}: Props) {
  const [isOpen, setIsOpen] = useState(true);

  const sortedAttributes = section.attributes
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const hasRequiredFieldsEmpty =
    !isOpen &&
    sortedAttributes.some(
      (attr) => attr.required && !formValues[attr.id],
    );

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left",
        )}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
          <span className="font-medium text-sm text-foreground truncate">{section.name}</span>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full flex-shrink-0">
            {sortedAttributes.length}
          </span>
          {hasRequiredFieldsEmpty && (
            <span
              className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"
              title="This section has required fields that are empty"
              aria-label="Required fields missing"
            />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="px-4 py-4 space-y-5">
          {sortedAttributes.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No attributes in this section.</p>
          ) : (
            sortedAttributes.map((attr) => (
              <AttributeField
                key={attr.id}
                catalogId={catalogId}
                attribute={attr}
                value={formValues[attr.id] ?? null}
                displayValue={formDisplayValues[attr.id] ?? null}
                error={formErrors[attr.id] ?? null}
                onChange={onFieldChange}
                disabled={disabled}
                targetTemplateName={targetTemplateNames?.[attr.id]}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
