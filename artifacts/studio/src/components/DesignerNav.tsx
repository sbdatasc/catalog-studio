import { Link, useLocation } from "wouter";
import { Database } from "lucide-react";

export function DesignerNav() {
  const [location] = useLocation();

  const isTemplatesActive =
    location === "/" || location.startsWith("/designer/templates");
  const isReferenceDataActive = location.startsWith("/designer/reference-data");

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
          <button
            disabled
            className="px-4 py-1.5 text-sm font-medium rounded-md text-muted-foreground opacity-50 cursor-not-allowed"
          >
            Operational
          </button>
        </div>

        <div className="w-[160px]" />
      </div>

      <div className="px-6 flex items-center gap-6">
        <Link
          href="/designer/templates"
          className={[
            "h-12 flex items-center border-b-2 text-sm font-medium px-1 transition-colors",
            isTemplatesActive
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
          ].join(" ")}
          data-testid="nav-tab-templates"
        >
          Templates
        </Link>

        <Link
          href="/designer/reference-data"
          className={[
            "h-12 flex items-center border-b-2 text-sm font-medium px-1 transition-colors",
            isReferenceDataActive
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
          ].join(" ")}
          data-testid="nav-tab-reference-data"
        >
          Reference Data
        </Link>

        <div
          className="h-12 flex items-center border-b-2 border-transparent text-sm font-medium text-muted-foreground px-1 opacity-50 cursor-not-allowed"
          data-testid="nav-tab-publish"
        >
          Publish
        </div>
      </div>
    </div>
  );
}
