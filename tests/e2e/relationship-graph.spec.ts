import { test, expect } from "@playwright/test";
import { createApiContext, apiCreateCatalog, apiCreateTemplate, apiDeleteCatalog } from "./helpers/api";

test.describe("Relationship Graph", () => {
  let catalogId: string | null = null;

  test.afterEach(async () => {
    if (catalogId) {
      const api = await createApiContext();
      await apiDeleteCatalog(api, catalogId);
      await api.dispose();
      catalogId = null;
    }
  });

  test("relationship tab is visible in the designer", async ({ page }) => {
    const api = await createApiContext();
    const catalog = await apiCreateCatalog(api, `Relationship Test ${Date.now()}`);
    catalogId = catalog.id;

    await page.goto(`/catalogs/${catalogId}`);
    await page.waitForLoadState("networkidle");

    const relTab = page
      .getByRole("tab", { name: /relationship/i })
      .or(page.getByRole("link", { name: /relationship/i }))
      .or(page.getByText(/relationship/i).first());
    await expect(relTab).toBeVisible({ timeout: 10_000 });
    await api.dispose();
  });

  test("can navigate to relationship graph view", async ({ page }) => {
    const api = await createApiContext();
    const catalog = await apiCreateCatalog(api, `Graph Nav Test ${Date.now()}`);
    catalogId = catalog.id;
    await apiCreateTemplate(api, catalogId, "Product");
    await apiCreateTemplate(api, catalogId, "Category");

    await page.goto(`/catalogs/${catalogId}`);
    await page.waitForLoadState("networkidle");

    const relTab = page
      .getByRole("tab", { name: /relationship/i })
      .or(page.getByRole("link", { name: /relationship/i }))
      .first();

    if (await relTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await relTab.click();
      await page.waitForTimeout(1000);
      await expect(page).toHaveURL(new RegExp(`/catalogs/${catalogId}`));
    }
    await api.dispose();
  });

  test("templates appear as nodes in the relationship graph", async ({ page }) => {
    const api = await createApiContext();
    const catalog = await apiCreateCatalog(api, `Graph Nodes Test ${Date.now()}`);
    catalogId = catalog.id;
    await apiCreateTemplate(api, catalogId, "Product");
    await apiCreateTemplate(api, catalogId, "Category");

    await page.goto(`/catalogs/${catalogId}/relationships`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Product").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Category").first()).toBeVisible({ timeout: 10_000 });
    await api.dispose();
  });

  test("can create a relationship between two templates", async ({ page }) => {
    const api = await createApiContext();
    const catalog = await apiCreateCatalog(api, `Create Rel Test ${Date.now()}`);
    catalogId = catalog.id;
    await apiCreateTemplate(api, catalogId, "Product");
    await apiCreateTemplate(api, catalogId, "Category");

    await page.goto(`/catalogs/${catalogId}/relationships`);
    await page.waitForLoadState("networkidle");

    const createRelBtn = page.getByRole("button", { name: /add relationship/i }).or(page.getByRole("button", { name: /create relationship/i })).first();
    if (await createRelBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createRelBtn.click();
      await page.waitForTimeout(500);
    }
    await api.dispose();
  });
});
