import { Link2 } from "lucide-react";

interface Props {
  onDragStart: (e: React.DragEvent) => void;
}

export function CardLinkHandle({ onDragStart }: Props) {
  return (
    <div
      className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-10"
      onDragStart={onDragStart}
      draggable
    >
      <div
        className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground shadow-md cursor-grab active:cursor-grabbing border-2 border-background hover:scale-110 transition-transform"
        title="Drag to link to another entry"
      >
        <Link2 className="w-3.5 h-3.5" />
      </div>
    </div>
  );
}
