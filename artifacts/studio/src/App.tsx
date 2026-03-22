import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DesignerPage } from "@/pages/DesignerPage";
import { ReferenceDataPage } from "@/pages/ReferenceDataPage";
import { DatasetDetailPage } from "@/pages/DatasetDetailPage";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function RootRedirect() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/designer/templates", { replace: true });
  }, [navigate]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/designer/reference-data/:id" component={DatasetDetailPage} />
      <Route path="/designer/reference-data" component={ReferenceDataPage} />
      <Route path="/designer/templates" component={DesignerPage} />
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
