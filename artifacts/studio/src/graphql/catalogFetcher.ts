export function createCatalogFetcher(catalogId: string) {
  return async (graphQLParams: {
    query: string;
    variables?: Record<string, unknown>;
    operationName?: string;
  }) => {
    const variables = {
      ...graphQLParams.variables,
      catalogId,
    };

    const response = await fetch("/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: graphQLParams.query,
        variables,
        operationName: graphQLParams.operationName,
      }),
    });

    const envelope = await response.json();

    if (!envelope.ok) {
      return { errors: [{ message: envelope.error?.message ?? "Request failed" }] };
    }

    return envelope.data;
  };
}
