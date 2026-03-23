import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onCancel: () => void;
}

export function LinkModeOverlay({ onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/20 z-20 pointer-events-none">
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="flex items-center gap-3 bg-card border border-border shadow-lg rounded-full px-5 py-2.5">
          <span className="text-sm font-medium text-foreground">
            Drag to a compatible entry to link
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 rounded-full"
            onClick={onCancel}
          >
            <X className="w-4 h-4" />
            <span className="ml-1 text-xs">Cancel (ESC)</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
