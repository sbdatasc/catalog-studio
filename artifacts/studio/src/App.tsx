import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CatalogsPage } from "@/pages/CatalogsPage";
import { DesignerPage } from "@/pages/DesignerPage";
import { TemplateDetailPage } from "@/components/designer/templates/TemplateDetailPage";
import { RelationshipsPage } from "@/pages/RelationshipsPage";
import { PublishPage } from "@/pages/PublishPage";
import { OperationalPage } from "@/pages/OperationalPage";
import { EntryDetailPage } from "@/pages/EntryDetailPage";
import { GraphQLPage } from "@/pages/GraphQLPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function RootRedirect() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/catalogs", { replace: true });
  }, [navigate]);
  return null;
}

function CatalogRootRedirect({ params }: { params: { catalogId: string } }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(`/catalogs/${params.catalogId}/designer/templates`, { replace: true });
  }, [navigate, params.catalogId]);
  return null;
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />

      {/* Protected catalog routes */}
      <Route
        path="/catalogs"
        component={() => (
          <ProtectedRoute>
            <CatalogsPage />
          </ProtectedRoute>
        )}
      />

      {/* Template detail pages */}
      <Route
        path="/catalogs/:catalogId/designer/templates/:templateId"
        component={({ params }) => (
          <ProtectedRoute>
            <TemplateDetailPage
              catalogId={params.catalogId}
              templateId={params.templateId}
              tabContext="templates"
            />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/catalogs/:catalogId/designer/reference-data/:templateId"
        component={({ params }) => (
          <ProtectedRoute>
            <TemplateDetailPage
              catalogId={params.catalogId}
              templateId={params.templateId}
              tabContext="reference-data"
            />
          </ProtectedRoute>
        )}
      />

      {/* Relationships graph page */}
      <Route
        path="/catalogs/:catalogId/designer/relationships"
        component={({ params }) => (
          <ProtectedRoute>
            <RelationshipsPage catalogId={params.catalogId} />
          </ProtectedRoute>
        )}
      />

      {/* Publish page (D-04) */}
      <Route
        path="/catalogs/:catalogId/designer/publish"
        component={({ params }) => (
          <ProtectedRoute>
            <PublishPage catalogId={params.catalogId} />
          </ProtectedRoute>
        )}
      />

      {/* Designer grid pages */}
      <Route
        path="/catalogs/:catalogId/designer/templates"
        component={({ params }) => (
          <ProtectedRoute>
            <DesignerPage catalogId={params.catalogId} tab="templates" />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/catalogs/:catalogId/designer/reference-data"
        component={({ params }) => (
          <ProtectedRoute>
            <DesignerPage catalogId={params.catalogId} tab="reference-data" />
          </ProtectedRoute>
        )}
      />

      {/* Operational mode — entry detail/edit (O-02) */}
      <Route
        path="/catalogs/:catalogId/operational/:templateId/entries/:entryId"
        component={({ params }) => (
          <ProtectedRoute>
            <EntryDetailPage
              catalogId={params.catalogId}
              templateId={params.templateId}
              entryId={params.entryId}
            />
          </ProtectedRoute>
        )}
      />

      {/* Operational mode (O-01) */}
      <Route
        path="/catalogs/:catalogId/operational"
        component={({ params }) => (
          <ProtectedRoute>
            <OperationalPage catalogId={params.catalogId} />
          </ProtectedRoute>
        )}
      />

      {/* GraphQL playground (G-02) */}
      <Route
        path="/catalogs/:catalogId/graphql"
        component={({ params }) => (
          <ProtectedRoute>
            <GraphQLPage catalogId={params.catalogId} />
          </ProtectedRoute>
        )}
      />

      <Route path="/catalogs/:catalogId/designer" component={CatalogRootRedirect} />
      <Route path="/" component={RootRedirect} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
