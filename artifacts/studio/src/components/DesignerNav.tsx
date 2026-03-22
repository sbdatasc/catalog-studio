import { Database } from "lucide-react";

export function DesignerNav() {
  return (
    <div className="flex flex-col border-b border-border bg-card">
      <div className="h-16 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
            <Database className="w-4 h-4" />
          </div>
          <span className="font-display font-semibold text-lg text-foreground">
            Data Catalog Studio
          </span>
        </div>

        <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-border/50">
          <button className="px-4 py-1.5 text-sm font-medium rounded-md bg-card text-foreground shadow-sm ring-1 ring-black/5 hover-elevate">
            Designer
          </button>
          <button disabled className="px-4 py-1.5 text-sm font-medium rounded-md text-muted-foreground opacity-50 cursor-not-allowed">
            Operational
          </button>
        </div>
        
        <div className="w-[160px]" /> {/* Spacer for flex balance */}
      </div>

      <div className="px-6 flex items-center gap-6">
        <div className="h-12 flex items-center border-b-2 border-primary text-sm font-medium text-foreground px-1">
          Entity Types
        </div>
        <div className="h-12 flex items-center border-b-2 border-transparent text-sm font-medium text-muted-foreground px-1 opacity-50 cursor-not-allowed">
          Publish
        </div>
      </div>
    </div>
  );
}
