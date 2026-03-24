interface GraphQLPageTabsProps {
  activeTab: "explorer" | "graphiql";
  onTabChange: (tab: "explorer" | "graphiql") => void;
}

export function GraphQLPageTabs({ activeTab, onTabChange }: GraphQLPageTabsProps) {
  const tabs = [
    { id: "explorer" as const, label: "Explorer" },
    { id: "graphiql" as const, label: "GraphiQL" },
  ];

  return (
    <div className="flex items-center gap-1 px-4 border-b border-border bg-background shrink-0">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={[
            "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
            activeTab === tab.id
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          ].join(" ")}
          data-testid={`gql-tab-${tab.id}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
