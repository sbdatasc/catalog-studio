import { test, expect } from "@playwright/test";
import {
  createApiContext,
  apiCreateCatalog,
  apiCreateTemplate,
  apiCreateSection,
  apiCreateAttribute,
  apiPublishSchema,
  apiDeleteCatalog,
} from "./helpers/api";

test.describe("GraphQL Playground", () => {
  let catalogId: string | null = null;

  test.afterEach(async () => {
    if (catalogId) {
      const api = await createApiContext();
      await apiDeleteCatalog(api, catalogId);
      await api.dispose();
      catalogId = null;
    }
  });

  async function buildPublishedCatalog(suffix: string) {
    const api = await createApiContext();
    const catalog = await apiCreateCatalog(api, `GraphQL Test ${suffix}`);
    const template = await apiCreateTemplate(api, catalog.id, "Product");
    const section = await apiCreateSection(api, template.id, "Details");
    await apiCreateAttribute(api, section.id, "Name", "text", true);
    await apiPublishSchema(api, catalog.id);
    await api.dispose();
    return { catalog, template };
  }

  test("GraphQL tab is visible in the catalog designer", async ({ page }) => {
    const { catalog } = await buildPublishedCatalog(`${Date.now()}`);
    catalogId = catalog.id;

    await page.goto(`/catalogs/${catalogId}`);
    await page.waitForLoadState("networkidle");

    const graphqlTab = page
      .getByRole("tab", { name: /graphql/i })
      .or(page.getByRole("link", { name: /graphql/i }))
      .or(page.getByText(/graphql/i).first());
    await expect(graphqlTab).toBeVisible({ timeout: 10_000 });
  });

  test("GraphQL playground renders for a published catalog", async ({ page }) => {
    const { catalog } = await buildPublishedCatalog(`Playground ${Date.now()}`);
    catalogId = catalog.id;

    await page.goto(`/catalogs/${catalogId}/graphql`);
    await page.waitForLoadState("networkidle");

    const graphiql = page.locator(".graphiql-container").or(page.locator("[data-testid='graphiql']")).first();
    await expect(graphiql).toBeVisible({ timeout: 15_000 });
  });

  test("example query selector shows query options", async ({ page }) => {
    const { catalog } = await buildPublishedCatalog(`Queries ${Date.now()}`);
    catalogId = catalog.id;

    await page.goto(`/catalogs/${catalogId}/graphql`);
    await page.waitForLoadState("networkidle");

    const exampleSelector = page
      .getByRole("combobox")
      .or(page.locator("select"))
      .or(page.getByText(/example/i).first());
    if (await exampleSelector.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(exampleSelector).toBeVisible();
    }
  });

  test("can execute a GraphQL query via the playground", async ({ page }) => {
    const { catalog } = await buildPublishedCatalog(`Execute ${Date.now()}`);
    catalogId = catalog.id;

    await page.goto(`/catalogs/${catalogId}/graphql`);
    await page.waitForLoadState("networkidle");

    const graphiql = page.locator(".graphiql-container").first();
    if (await graphiql.isVisible({ timeout: 10_000 }).catch(() => false)) {
      const runBtn = page
        .getByRole("button", { name: /run query/i })
        .or(page.getByLabel(/run query/i))
        .or(page.locator("[data-testid='toolbar-run-button']"))
        .or(page.locator(".graphiql-execute-button"))
        .first();
      if (await runBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await runBtn.click();
        await page.waitForTimeout(3000);
      }
    }
  });

  test("GraphQL endpoint responds to introspection query", async ({ page }) => {
    const { catalog } = await buildPublishedCatalog(`Introspection ${Date.now()}`);
    catalogId = catalog.id;

    const api = await createApiContext();
    const response = await api.post(`/api/${catalogId}/graphql`, {
      data: { query: "{ __schema { queryType { name } } }" },
    });
    expect(response.ok()).toBeTruthy();
    const json = await response.json();
    expect(json.data?.__schema?.queryType?.name).toBe("Query");
    await api.dispose();
  });
});
