import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
}

export function SelectDropdown({ value, onChange, options, placeholder, disabled }: Props) {
  return (
    <Select
      value={value ?? ""}
      onValueChange={(v) => onChange(v === "" ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder ?? "Select an option"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
