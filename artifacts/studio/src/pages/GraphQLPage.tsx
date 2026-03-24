import { useEffect, useMemo, useState } from "react";
import { GraphiQL } from "graphiql";
import "graphiql/style.css";
import { useSchemaStore } from "@/stores/schemaStore";
import { useCatalogStore } from "@/stores/catalogStore";
import { useQueryBuilderStore } from "@/stores/queryBuilderStore";
import { createCatalogFetcher } from "@/graphql/catalogFetcher";
import { GraphQLNav } from "@/components/graphql/GraphQLNav";
import { GraphQLPageHeader } from "@/components/graphql/GraphQLPageHeader";
import { GraphQLPageTabs } from "@/components/graphql/GraphQLPageTabs";
import { ExplorerTab } from "@/components/graphql/ExplorerTab";
import { NoSchemaPublishedBanner } from "@/components/operational/NoSchemaPublishedBanner";

interface Props {
  catalogId: string;
}

export function GraphQLPage({ catalogId }: Props) {
  const [editorKey, setEditorKey] = useState(0);

  const catalogs = useCatalogStore((s) => s.catalogs);
  const fetchCatalogs = useCatalogStore((s) => s.fetchCatalogs);

  const publishedSchemasByCatalog = useSchemaStore((s) => s.publishedSchemasByCatalog);
  const publishedSchemaLoading = useSchemaStore((s) => s.publishedSchemaLoading);
  const fetchPublishedSchema = useSchemaStore((s) => s.fetchPublishedSchema);

  const activeTab = useQueryBuilderStore((s) => s.activeTab);
  const graphiqlQuery = useQueryBuilderStore((s) => s.graphiqlQuery);
  const setActiveTab = useQueryBuilderStore((s) => s.setActiveTab);

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

  // When "Open in GraphiQL" is clicked from Explorer, remount GraphiQL with the new query
  const prevGraphiqlQuery = useMemo(() => graphiqlQuery, [graphiqlQuery]);
  useEffect(() => {
    if (activeTab === "graphiql" && graphiqlQuery) {
      setEditorKey((k) => k + 1);
    }
  }, [graphiqlQuery, activeTab]);

  function handleTabChange(tab: "explorer" | "graphiql") {
    setActiveTab(tab);
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <GraphQLNav catalogId={catalogId} catalogName={catalogName} />

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <GraphQLPageHeader catalogName={catalogName} />

          {/* Tab bar */}
          <GraphQLPageTabs activeTab={activeTab} onTabChange={handleTabChange} />

          {/* Tab content */}
          {activeTab === "explorer" ? (
            <ExplorerTab catalogId={catalogId} snapshot={snapshot ?? null} />
          ) : (
            <>
              {!snapshot ? (
                <NoSchemaPublishedBanner catalogId={catalogId} />
              ) : (
                <div className="flex-1 min-h-0" data-testid="graphiql-container">
                  <GraphiQL
                    key={editorKey}
                    fetcher={fetcher}
                    initialQuery={graphiqlQuery || undefined}
                    defaultEditorToolsVisibility="variables"
                    isHeadersEditorEnabled={false}
                    plugins={[]}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
