import { Code2 } from "lucide-react";

interface Props {
  catalogName: string;
}

export function GraphQLPageHeader({ catalogName }: Props) {
  return (
    <div className="h-16 px-6 flex items-center justify-between border-b border-border bg-card shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white shadow-sm">
          <Code2 className="w-4 h-4" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-foreground leading-tight">
            {catalogName} — GraphQL API
          </h1>
          <p className="text-xs text-muted-foreground">
            Endpoint: POST /api/graphql · Read-only · catalogId auto-injected
          </p>
        </div>
      </div>
    </div>
  );
}
