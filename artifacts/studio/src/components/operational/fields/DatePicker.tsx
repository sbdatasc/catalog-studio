import { Input } from "@/components/ui/input";

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

export function DatePicker({ value, onChange, disabled }: Props) {
  return (
    <Input
      type="date"
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : v);
      }}
      disabled={disabled}
      className="w-full max-w-xs"
    />
  );
}
