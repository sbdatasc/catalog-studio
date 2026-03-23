import { Link } from "wouter";
import { Database, ChevronLeft } from "lucide-react";
import type { SnapshotTemplate } from "@/lib/apiClient";
import { useUiStore } from "@/stores/uiStore";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/auth/UserMenu";

interface Props {
  catalogId: string;
  catalogName: string;
  tabs: SnapshotTemplate[];
}

export function OperationalNav({ catalogId, catalogName, tabs }: Props) {
  const activeTemplateTabId = useUiStore((s) => s.activeTemplateTabId);
  const setActiveTemplateTab = useUiStore((s) => s.setActiveTemplateTab);
  const isEntryFormOpen = useUiStore((s) => s.isEntryFormOpen);
  const { canViewDesigner, canViewEntries, canUseGraphQL } = usePermissions(catalogId);

  const sortedTabs = tabs.slice().sort((a, b) => a.name.localeCompare(b.name));

  function handleTabClick(templateId: string) {
    if (isEntryFormOpen && activeTemplateTabId !== templateId) {
      setActiveTemplateTab(templateId);
    } else {
      setActiveTemplateTab(templateId);
    }
  }

  return (
    <div className="flex flex-col border-b border-border bg-card">
      <div className="h-16 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/catalogs"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium mr-1"
            data-testid="nav-back-catalogs"
          >
            <ChevronLeft className="w-4 h-4" />
            Catalogs
          </Link>
          <div className="w-px h-4 bg-border" />
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm">
            <Database className="w-4 h-4" />
          </div>
          <span className="font-display font-semibold text-lg text-foreground truncate max-w-[200px]">
            {catalogName}
          </span>
        </div>

        <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-border/50">
          {canViewDesigner && (
            <Link
              href={`/catalogs/${catalogId}/designer/templates`}
              className="px-4 py-1.5 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-background/70 transition-colors"
              data-testid="nav-mode-designer"
            >
              Designer
            </Link>
          )}
          {canViewEntries && (
            <button className="px-4 py-1.5 text-sm font-medium rounded-md bg-card text-foreground shadow-sm ring-1 ring-black/5">
              Operational
            </button>
          )}
          {canUseGraphQL && (
            <Link
              href={`/catalogs/${catalogId}/graphql`}
              className="px-4 py-1.5 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-background/70 transition-colors"
              data-testid="nav-mode-api"
            >
              API
            </Link>
          )}
        </div>

        <div className="flex items-center justify-end w-[160px]">
          <UserMenu />
        </div>
      </div>

      {sortedTabs.length > 0 && (
        <div className="px-6 flex items-center gap-2 overflow-x-auto">
          {sortedTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                "h-12 flex items-center border-b-2 text-sm font-medium px-3 transition-colors whitespace-nowrap flex-shrink-0",
                tab.id === activeTemplateTabId
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              )}
              data-testid={`nav-tab-template-${tab.id}`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
