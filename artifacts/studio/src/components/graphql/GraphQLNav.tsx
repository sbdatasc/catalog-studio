import { Link } from "wouter";
import { Database, ChevronLeft } from "lucide-react";
import { UserMenu } from "@/components/auth/UserMenu";

interface Props {
  catalogId: string;
  catalogName: string;
}

export function GraphQLNav({ catalogId, catalogName }: Props) {
  return (
    <div className="h-16 px-6 flex items-center justify-between border-b border-border bg-card shrink-0">
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
        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white shadow-sm">
          <Database className="w-4 h-4" />
        </div>
        <span className="font-display font-semibold text-lg text-foreground truncate max-w-[200px]">
          {catalogName}
        </span>
      </div>

      <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-border/50">
        <Link
          href={`/catalogs/${catalogId}/designer/templates`}
          className="px-4 py-1.5 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-background/70 transition-colors"
          data-testid="nav-mode-designer"
        >
          Designer
        </Link>
        <Link
          href={`/catalogs/${catalogId}/operational`}
          className="px-4 py-1.5 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-background/70 transition-colors"
          data-testid="nav-mode-operational"
        >
          Operational
        </Link>
        <button className="px-4 py-1.5 text-sm font-medium rounded-md bg-card text-foreground shadow-sm ring-1 ring-black/5">
          API
        </button>
      </div>

      <div className="flex items-center justify-end w-[160px]">
        <UserMenu />
      </div>
    </div>
  );
}
