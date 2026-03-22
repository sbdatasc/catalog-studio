import { DesignerNav } from "@/components/DesignerNav";
import { EntityTypeManager } from "@/components/EntityTypeManager";

export function DesignerPage() {
  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <DesignerNav />
      <EntityTypeManager />
    </div>
  );
}
