import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient, type AttributeDefinition, type AttributeType, type CatalogTemplate } from "@/lib/apiClient";
import { useSchemaStore } from "@/stores/schemaStore";
import { useToast } from "@/hooks/use-toast";

const ALL_TYPES: { value: AttributeType; label: string }[] = [
  { value: "string", label: "String" },
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "date", label: "Date" },
  { value: "enum", label: "Enum" },
  { value: "reference", label: "Reference" },
  { value: "reference_data", label: "Reference Data" },
];

export const TYPE_BADGE_COLORS: Record<AttributeType, string> = {
  string: "bg-muted text-muted-foreground",
  text: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
  number: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  boolean: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  date: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  enum: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  reference: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  reference_data: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

interface Props {
  sectionId: string;
  templateId: string;
  isReferenceDataTemplate: boolean;
  /** If provided, the form is in edit mode for this attribute */
  editAttribute?: AttributeDefinition;
  onCancel: () => void;
  onSuccess: () => void;
  /** Available templates for reference/reference_data type selection */
  allTemplates: CatalogTemplate[];
  allRefDataTemplates: CatalogTemplate[];
}

export function AttributeInlineForm({
  sectionId,
  isReferenceDataTemplate,
  editAttribute,
  onCancel,
  onSuccess,
  allTemplates,
  allRefDataTemplates,
}: Props) {
  const { addAttribute, updateAttribute } = useSchemaStore();
  const { toast } = useToast();

  const isEdit = !!editAttribute;

  const [name, setName] = useState(editAttribute?.name ?? "");
  const [description, setDescription] = useState(editAttribute?.description ?? "");
  const [attributeType, setAttributeType] = useState<AttributeType>(editAttribute?.attributeType ?? "string");
  const [required, setRequired] = useState(editAttribute?.required ?? false);
  const [enumOptions, setEnumOptions] = useState<string[]>(() => {
    if (editAttribute?.config && "options" in editAttribute.config) {
      return editAttribute.config.options;
    }
    return [""];
  });
  const [targetTemplateId, setTargetTemplateId] = useState<string>(() => {
    if (
      editAttribute?.config &&
      "targetTemplateId" in editAttribute.config &&
      editAttribute.config.targetTemplateId
    ) {
      return editAttribute.config.targetTemplateId;
    }
    return "";
  });

  const [nameError, setNameError] = useState<string | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset when switching between add/edit
  useEffect(() => {
    setName(editAttribute?.name ?? "");
    setDescription(editAttribute?.description ?? "");
    setAttributeType(editAttribute?.attributeType ?? "string");
    setRequired(editAttribute?.required ?? false);
    if (editAttribute?.config && "options" in editAttribute.config) {
      setEnumOptions(editAttribute.config.options);
    } else {
      setEnumOptions([""]);
    }
    if (editAttribute?.config && "targetTemplateId" in editAttribute.config) {
      setTargetTemplateId(editAttribute.config.targetTemplateId ?? "");
    } else {
      setTargetTemplateId("");
    }
    setNameError(null);
    setTypeError(null);
    setConfigError(null);
  }, [editAttribute?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const availableTypes = isReferenceDataTemplate
    ? ALL_TYPES.filter((t) => t.value !== "reference" && t.value !== "reference_data")
    : ALL_TYPES;

  function buildConfig() {
    if (attributeType === "enum") {
      return { options: enumOptions.filter((o) => o.trim()) };
    }
    if (attributeType === "reference" || attributeType === "reference_data") {
      return { targetTemplateId };
    }
    return null;
  }

  function validate(): boolean {
    let valid = true;
    if (!name.trim()) {
      setNameError("Attribute name is required.");
      valid = false;
    } else {
      setNameError(null);
    }
    if (!attributeType) {
      setTypeError("Attribute type is required.");
      valid = false;
    } else {
      setTypeError(null);
    }
    if (attributeType === "enum") {
      const opts = enumOptions.filter((o) => o.trim());
      if (opts.length === 0) {
        setConfigError("At least one option is required for enum attributes.");
        valid = false;
      } else {
        setConfigError(null);
      }
    } else if (attributeType === "reference" || attributeType === "reference_data") {
      if (!targetTemplateId) {
        setConfigError("Please select a valid target template.");
        valid = false;
      } else {
        setConfigError(null);
      }
    } else {
      setConfigError(null);
    }
    return valid;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);

    if (isEdit && editAttribute) {
      const { data, error } = await apiClient.schema.updateAttribute(editAttribute.id, {
        name: name.trim(),
        description: description.trim() || null,
        required,
        config: buildConfig(),
      });
      if (error) {
        toast({ title: "Failed to update attribute", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      if (data) {
        updateAttribute(data);
        toast({ title: "Attribute updated." });
        onSuccess();
      }
    } else {
      const { data, error } = await apiClient.schema.createAttribute(sectionId, {
        name: name.trim(),
        attributeType,
        description: description.trim() || null,
        required,
        config: buildConfig(),
      });
      if (error) {
        if (error.code === "VALIDATION_ERROR") {
          setNameError(error.message);
        } else {
          toast({ title: "Failed to add attribute", description: error.message, variant: "destructive" });
        }
        setSaving(false);
        return;
      }
      if (data) {
        addAttribute(sectionId, data);
        toast({ title: "Attribute added." });
        onSuccess();
      }
    }
    setSaving(false);
  }

  // -------------------------------------------------------------------------
  // Enum multi-input
  // -------------------------------------------------------------------------
  function addEnumOption() {
    setEnumOptions((prev) => [...prev, ""]);
  }
  function removeEnumOption(i: number) {
    setEnumOptions((prev) => prev.filter((_, idx) => idx !== i));
  }
  function setEnumOption(i: number, v: string) {
    setEnumOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)));
    if (configError) setConfigError(null);
  }

  return (
    <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/20">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor={`attr-name-${sectionId}`} className="text-xs">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`attr-name-${sectionId}`}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError(null);
            }}
            placeholder="e.g. Data Owner"
            maxLength={100}
            className="text-sm"
            data-testid="input-attribute-name"
          />
          {nameError && <p className="text-xs text-destructive">{nameError}</p>}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">
            Type{" "}
            {isEdit ? (
              <span className="text-muted-foreground font-normal">(read-only)</span>
            ) : (
              <span className="text-destructive">*</span>
            )}
          </Label>
          {isEdit ? (
            <div className="flex items-center h-9">
              <Badge
                className={`text-xs font-medium pointer-events-none ${TYPE_BADGE_COLORS[attributeType]}`}
                variant="secondary"
              >
                {attributeType}
              </Badge>
              <span className="ml-2 text-xs text-muted-foreground">Cannot change type after creation</span>
            </div>
          ) : (
            <>
              <Select
                value={attributeType}
                onValueChange={(v) => {
                  setAttributeType(v as AttributeType);
                  setTargetTemplateId("");
                  setEnumOptions([""]);
                  if (typeError) setTypeError(null);
                  if (configError) setConfigError(null);
                }}
              >
                <SelectTrigger className="text-sm" data-testid="select-attribute-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {availableTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-sm">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {typeError && <p className="text-xs text-destructive">{typeError}</p>}
            </>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`attr-desc-${sectionId}`} className="text-xs">Description</Label>
        <Textarea
          id={`attr-desc-${sectionId}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          rows={2}
          maxLength={500}
          className="text-sm resize-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id={`attr-required-${sectionId}`}
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
          className="w-4 h-4 rounded"
          data-testid="checkbox-attribute-required"
        />
        <Label htmlFor={`attr-required-${sectionId}`} className="text-xs cursor-pointer">
          Required field
        </Label>
      </div>

      {/* Type-conditional config */}
      {attributeType === "enum" && (
        <div className="space-y-2">
          <Label className="text-xs">Options <span className="text-destructive">*</span></Label>
          <div className="space-y-1.5">
            {enumOptions.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={opt}
                  onChange={(e) => setEnumOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className="text-sm"
                />
                {enumOptions.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEnumOption(i)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    ✕
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addEnumOption} className="text-xs">
            + Add option
          </Button>
          {configError && <p className="text-xs text-destructive">{configError}</p>}
        </div>
      )}

      {attributeType === "reference" && (
        <div className="space-y-1">
          <Label className="text-xs">Target Template <span className="text-destructive">*</span></Label>
          <Select
            value={targetTemplateId}
            onValueChange={(v) => {
              setTargetTemplateId(v);
              if (configError) setConfigError(null);
            }}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Select template" />
            </SelectTrigger>
            <SelectContent>
              {allTemplates.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">No templates available</div>
              ) : (
                allTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-sm">
                    {t.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {configError && <p className="text-xs text-destructive">{configError}</p>}
        </div>
      )}

      {attributeType === "reference_data" && (
        <div className="space-y-1">
          <Label className="text-xs">Reference Data Template <span className="text-destructive">*</span></Label>
          <Select
            value={targetTemplateId}
            onValueChange={(v) => {
              setTargetTemplateId(v);
              if (configError) setConfigError(null);
            }}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Select reference data template" />
            </SelectTrigger>
            <SelectContent>
              {allRefDataTemplates.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">No reference data templates available</div>
              ) : (
                allRefDataTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-sm">
                    {t.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {configError && <p className="text-xs text-destructive">{configError}</p>}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving} data-testid="button-save-attribute">
          {saving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Saving…
            </>
          ) : isEdit ? "Save Changes" : "Add Attribute"}
        </Button>
      </div>
    </div>
  );
}
