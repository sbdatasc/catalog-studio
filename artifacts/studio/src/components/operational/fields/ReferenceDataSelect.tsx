import { useEffect, useState } from "react";
import { apiClient, type EntryListItem } from "@/lib/apiClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface Props {
  catalogId: string;
  targetTemplateId: string;
  targetTemplateName: string;
  value: string | null;
  onChange: (uuid: string | null) => void;
  disabled?: boolean;
}

export function ReferenceDataSelect({
  catalogId,
  targetTemplateId,
  targetTemplateName,
  value,
  onChange,
  disabled,
}: Props) {
  const [options, setOptions] = useState<EntryListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    apiClient.entries.list(catalogId, targetTemplateId).then(({ data }) => {
      if (mounted) {
        setOptions(data ?? []);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [catalogId, targetTemplateId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 h-10 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading options…</span>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger className="w-full opacity-60">
          <SelectValue placeholder={`No options available — populate ${targetTemplateName} first.`} />
        </SelectTrigger>
        <SelectContent />
      </Select>
    );
  }

  return (
    <Select
      value={value ?? ""}
      onValueChange={(v) => onChange(v === "" ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={`Select ${targetTemplateName}…`} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.id} value={opt.id}>
            {opt.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
