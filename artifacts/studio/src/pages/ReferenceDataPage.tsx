import { DesignerNav } from "@/components/DesignerNav";
import { ReferenceDataManager } from "@/components/ReferenceDataManager";

export function ReferenceDataPage() {
  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <DesignerNav />
      <ReferenceDataManager />
    </div>
  );
}
