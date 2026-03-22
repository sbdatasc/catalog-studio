import { ReactNode } from "react";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
} from "@/components/ui/sheet";
import { useUiStore } from "@/stores/uiStore";

interface DrawerShellProps {
  title: string;
  isOpen: boolean;
  children: ReactNode;
  footer: ReactNode;
}

export function DrawerShell({ title, isOpen, children, footer }: DrawerShellProps) {
  const { requestCloseDrawer } = useUiStore();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && requestCloseDrawer()}>
      <SheetContent 
        className="w-[400px] sm:max-w-[400px] p-0 flex flex-col border-l border-border bg-card"
        onInteractOutside={(e) => {
          e.preventDefault();
          requestCloseDrawer();
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          requestCloseDrawer();
        }}
      >
        <SheetHeader className="px-6 py-4 border-b border-border/50">
          <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>

        <div className="px-6 py-4 border-t border-border/50 bg-muted/20 flex justify-end gap-3">
          {footer}
        </div>
      </SheetContent>
    </Sheet>
  );
}
