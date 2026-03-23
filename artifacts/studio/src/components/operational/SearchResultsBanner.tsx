import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  query: string;
  count: number;
  onClear: () => void;
}

export function SearchResultsBanner({ query, count, onClear }: Props) {
  return (
    <div className="flex items-center justify-between py-2 px-1">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{count}</span>{" "}
        {count === 1 ? "result" : "results"} for{" "}
        <span className="font-medium text-foreground">"{query}"</span>
      </p>
      <Button variant="ghost" size="sm" onClick={onClear} className="h-7 px-2 text-xs">
        <X className="w-3.5 h-3.5 mr-1" />
        Clear search
      </Button>
    </div>
  );
}
