import { Textarea } from "@/components/ui/textarea";

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TextareaInput({ value, onChange, placeholder, disabled }: Props) {
  return (
    <Textarea
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full min-h-[100px] resize-y"
      rows={4}
    />
  );
}
