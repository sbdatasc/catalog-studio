import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCatalogFetcher } from "./catalogFetcher";

const TEST_CATALOG_ID = "4b81fccf-8cc6-465b-970d-29a155aaf9bc";

function makeFetchResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(body),
  } as Response);
}

describe("createCatalogFetcher", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      makeFetchResponse({ ok: true, data: { products: [] } }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("injects catalogId into the variables", async () => {
    const fetcher = createCatalogFetcher(TEST_CATALOG_ID);
    await fetcher({ query: "{ products { id } }", variables: { limit: 10 } });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.variables.catalogId).toBe(TEST_CATALOG_ID);
    expect(body.variables.limit).toBe(10);
  });

  it("does not allow external callers to override catalogId via variables", async () => {
    const fetcher = createCatalogFetcher(TEST_CATALOG_ID);
    await fetcher({
      query: "{ products { id } }",
      variables: { catalogId: "evil-override", limit: 5 },
    });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.variables.catalogId).toBe(TEST_CATALOG_ID);
  });

  it("returns the data from the envelope on success", async () => {
    const payload = { products: [{ id: "1", display_name: "Widget" }] };
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({ ok: true, data: payload }),
    );

    const fetcher = createCatalogFetcher(TEST_CATALOG_ID);
    const result = await fetcher({ query: "{ products { id } }" });
    expect(result).toEqual(payload);
  });

  it("returns an errors array when envelope.ok is false", async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({
        ok: false,
        error: { message: "Schema not ready" },
      }),
    );

    const fetcher = createCatalogFetcher(TEST_CATALOG_ID);
    const result = await fetcher({ query: "{ products { id } }" }) as { errors: { message: string }[] };
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toBe("Schema not ready");
  });

  it("falls back to 'Request failed' when error has no message", async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({ ok: false, error: null }),
    );

    const fetcher = createCatalogFetcher(TEST_CATALOG_ID);
    const result = await fetcher({ query: "{ products { id } }" }) as { errors: { message: string }[] };
    expect(result.errors[0]!.message).toBe("Request failed");
  });

  it("sends operationName when provided", async () => {
    const fetcher = createCatalogFetcher(TEST_CATALOG_ID);
    await fetcher({
      query: "query GetProducts { products { id } }",
      operationName: "GetProducts",
    });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.operationName).toBe("GetProducts");
  });

  it("sends requests to /api/graphql", async () => {
    const fetcher = createCatalogFetcher(TEST_CATALOG_ID);
    await fetcher({ query: "{ products { id } }" });

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/graphql");
  });
});
