import type { SnapshotAttribute } from "@/lib/apiClient";
import { TextInput } from "./fields/TextInput";
import { TextareaInput } from "./fields/TextareaInput";
import { NumberInput } from "./fields/NumberInput";
import { ToggleSwitch } from "./fields/ToggleSwitch";
import { DatePicker } from "./fields/DatePicker";
import { SelectDropdown } from "./fields/SelectDropdown";
import { TypeaheadSearch } from "./fields/TypeaheadSearch";
import { ReferenceDataSelect } from "./fields/ReferenceDataSelect";
import { cn } from "@/lib/utils";

interface Props {
  catalogId: string;
  attribute: SnapshotAttribute;
  value: string | null;
  displayValue: string | null;
  error: string | null;
  onChange: (attributeId: string, value: string | null, displayValue?: string | null) => void;
  disabled?: boolean;
  targetTemplateName?: string;
}

export function AttributeField({
  catalogId,
  attribute,
  value,
  displayValue,
  error,
  onChange,
  disabled,
  targetTemplateName,
}: Props) {
  const { id, name, description, attributeType, required, config } = attribute;

  function renderControl() {
    switch (attributeType) {
      case "string":
        return (
          <TextInput
            value={value}
            onChange={(v) => onChange(id, v)}
            placeholder={`Enter ${name.toLowerCase()}`}
            disabled={disabled}
          />
        );

      case "text":
        return (
          <TextareaInput
            value={value}
            onChange={(v) => onChange(id, v)}
            placeholder={`Enter ${name.toLowerCase()}`}
            disabled={disabled}
          />
        );

      case "number":
        return (
          <NumberInput
            value={value}
            onChange={(v) => onChange(id, v)}
            disabled={disabled}
          />
        );

      case "boolean":
        return (
          <ToggleSwitch
            value={value}
            onChange={(v) => onChange(id, v)}
            disabled={disabled}
          />
        );

      case "date":
        return (
          <DatePicker
            value={value}
            onChange={(v) => onChange(id, v)}
            disabled={disabled}
          />
        );

      case "enum": {
        const enumConfig = config as { options: string[] } | null;
        return (
          <SelectDropdown
            value={value}
            onChange={(v) => onChange(id, v)}
            options={enumConfig?.options ?? []}
            placeholder={`Select ${name.toLowerCase()}`}
            disabled={disabled}
          />
        );
      }

      case "reference": {
        const refConfig = config as { targetTemplateId: string } | null;
        const targetTemplateId = refConfig?.targetTemplateId ?? "";
        return (
          <TypeaheadSearch
            catalogId={catalogId}
            templateId={targetTemplateId}
            templateName={targetTemplateName ?? name}
            value={value}
            displayValue={displayValue}
            onChange={(uuid, dn) => onChange(id, uuid, dn)}
            disabled={disabled}
          />
        );
      }

      case "reference_data": {
        const rdConfig = config as { targetTemplateId: string } | null;
        const targetTemplateId = rdConfig?.targetTemplateId ?? "";
        return (
          <ReferenceDataSelect
            catalogId={catalogId}
            targetTemplateId={targetTemplateId}
            targetTemplateName={targetTemplateName ?? name}
            value={value}
            onChange={(v) => onChange(id, v)}
            disabled={disabled}
          />
        );
      }

      default:
        return <TextInput value={value} onChange={(v) => onChange(id, v)} disabled={disabled} />;
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {name}
        {required && <span className="text-destructive ml-1" aria-label="required">*</span>}
      </label>

      {renderControl()}

      {attributeType === "reference" && (
        <p className="text-xs text-muted-foreground mt-0.5">
          Links to: {(config as { targetTemplateId: string } | null)?.targetTemplateId ?? ""}
        </p>
      )}

      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {error && (
        <p className="text-xs text-destructive" role="alert">{error}</p>
      )}
    </div>
  );
}
