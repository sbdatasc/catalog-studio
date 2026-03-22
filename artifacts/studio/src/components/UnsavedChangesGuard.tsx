import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/uiStore";

export function UnsavedChangesGuard() {
  const { guardAction, confirmDiscard, cancelDiscard } = useUiStore();
  const isOpen = guardAction !== null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && cancelDiscard()}>
      <DialogContent className="sm:max-w-[400px] z-[100]">
        <DialogHeader>
          <DialogTitle>Discard unsaved changes?</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <p className="text-muted-foreground text-sm">
            Your changes will be lost.
          </p>
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            className="text-destructive hover:text-destructive hover:bg-destructive/5" 
            onClick={confirmDiscard}
            data-testid="button-discard-changes"
          >
            Discard
          </Button>
          <Button 
            onClick={cancelDiscard}
            data-testid="button-keep-editing"
          >
            Keep Editing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
