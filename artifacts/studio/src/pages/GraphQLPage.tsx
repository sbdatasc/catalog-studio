import { useEffect, useMemo, useState } from "react";
import { GraphiQL } from "graphiql";
import "graphiql/style.css";
import { useSchemaStore } from "@/stores/schemaStore";
import { useCatalogStore } from "@/stores/catalogStore";
import { createCatalogFetcher } from "@/graphql/catalogFetcher";
import { GraphQLNav } from "@/components/graphql/GraphQLNav";
import { GraphQLPageHeader } from "@/components/graphql/GraphQLPageHeader";
import { ExampleQueriesPanel } from "@/components/graphql/ExampleQueriesPanel";
import { NoSchemaPublishedBanner } from "@/components/operational/NoSchemaPublishedBanner";

interface Props {
  catalogId: string;
}

export function GraphQLPage({ catalogId }: Props) {
  const [initialQuery, setInitialQuery] = useState<string | undefined>(undefined);
  const [editorKey, setEditorKey] = useState(0);

  const catalogs = useCatalogStore((s) => s.catalogs);
  const fetchCatalogs = useCatalogStore((s) => s.fetchCatalogs);

  const publishedSchemasByCatalog = useSchemaStore((s) => s.publishedSchemasByCatalog);
  const publishedSchemaLoading = useSchemaStore((s) => s.publishedSchemaLoading);
  const fetchPublishedSchema = useSchemaStore((s) => s.fetchPublishedSchema);

  useEffect(() => {
    if (!catalogs.length) fetchCatalogs();
  }, [catalogs.length, fetchCatalogs]);

  useEffect(() => {
    fetchPublishedSchema(catalogId);
  }, [catalogId, fetchPublishedSchema]);

  const catalog = catalogs.find((c) => c.id === catalogId);
  const snapshot = publishedSchemasByCatalog[catalogId];
  const isLoading = publishedSchemaLoading[catalogId] ?? true;

  const fetcher = useMemo(() => createCatalogFetcher(catalogId), [catalogId]);

  const catalogName = catalog?.name ?? "Catalog";

  function handleSelectExample(query: string) {
    setInitialQuery(query);
    setEditorKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <GraphQLNav catalogId={catalogId} catalogName={catalogName} />

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !snapshot ? (
        <NoSchemaPublishedBanner catalogId={catalogId} />
      ) : (
        <>
          <GraphQLPageHeader catalogName={catalogName} />
          <ExampleQueriesPanel schema={snapshot} onSelect={handleSelectExample} />
          <div className="flex-1 min-h-0" data-testid="graphiql-container">
            <GraphiQL
              key={editorKey}
              fetcher={fetcher}
              initialQuery={initialQuery}
              defaultEditorToolsVisibility="variables"
              isHeadersEditorEnabled={false}
              plugins={[]}
            />
          </div>
        </>
      )}
    </div>
  );
}
