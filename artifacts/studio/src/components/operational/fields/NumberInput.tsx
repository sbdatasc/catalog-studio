import { Input } from "@/components/ui/input";

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function NumberInput({ value, onChange, placeholder, disabled }: Props) {
  return (
    <Input
      type="number"
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : v);
      }}
      placeholder={placeholder ?? "Enter a number"}
      disabled={disabled}
      className="w-full"
      step="any"
    />
  );
}
