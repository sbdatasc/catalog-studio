import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CatalogsPage } from "@/pages/CatalogsPage";
import { DesignerPage } from "@/pages/DesignerPage";
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
      <Route path="/catalogs" component={CatalogsPage} />
      <Route
        path="/catalogs/:catalogId/designer/templates"
        component={({ params }) => <DesignerPage catalogId={params.catalogId} tab="templates" />}
      />
      <Route
        path="/catalogs/:catalogId/designer/reference-data"
        component={({ params }) => <DesignerPage catalogId={params.catalogId} tab="reference-data" />}
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
