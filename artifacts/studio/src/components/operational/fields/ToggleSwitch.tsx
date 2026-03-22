import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

export function ToggleSwitch({ value, onChange, disabled }: Props) {
  const checked = value === "true";

  return (
    <div className="flex items-center gap-3">
      <Switch
        checked={checked}
        onCheckedChange={(v) => onChange(v ? "true" : "false")}
        disabled={disabled}
      />
      <Label className="text-sm text-muted-foreground select-none">
        {checked ? "Yes" : "No"}
      </Label>
    </div>
  );
}
