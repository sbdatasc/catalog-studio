import { Input } from "@/components/ui/input";

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TextInput({ value, onChange, placeholder, disabled }: Props) {
  return (
    <Input
      type="text"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full"
    />
  );
}
