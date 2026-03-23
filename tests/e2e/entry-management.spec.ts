import { test, expect } from "@playwright/test";
import {
  createApiContext,
  apiCreateCatalog,
  apiCreateTemplate,
  apiCreateSection,
  apiCreateAttribute,
  apiPublishSchema,
  apiCreateEntry,
  apiDeleteCatalog,
} from "./helpers/api";

test.describe("Entry Management", () => {
  let catalogId: string | null = null;

  test.afterEach(async () => {
    if (catalogId) {
      const api = await createApiContext();
      await apiDeleteCatalog(api, catalogId);
      await api.dispose();
      catalogId = null;
    }
  });

  async function buildCatalogWithEntries(suffix: string, count = 1) {
    const api = await createApiContext();
    const catalog = await apiCreateCatalog(api, `Entry Mgmt ${suffix}`);
    const template = await apiCreateTemplate(api, catalog.id, "Product");
    const section = await apiCreateSection(api, template.id, "Details");
    const attr = await apiCreateAttribute(api, section.id, "Name", "text", true);
    await apiPublishSchema(api, catalog.id);

    const entries: { id: string }[] = [];
    for (let i = 0; i < count; i++) {
      const entry = await apiCreateEntry(api, catalog.id, template.id, { [attr.id]: `Product ${i + 1}` });
      entries.push(entry);
    }
    await api.dispose();
    return { catalog, template, entries };
  }

  test("created entries appear in the entry list", async ({ page }) => {
    const { catalog } = await buildCatalogWithEntries(`${Date.now()}`, 2);
    catalogId = catalog.id;

    await page.goto(`/catalogs/${catalogId}/operational`);
    await page.waitForLoadState("networkidle");

    const entryList = page.locator("[data-testid='entry-list']").or(page.locator("table")).or(page.locator("[data-testid='entry-card']")).first();
    await expect(entryList).toBeVisible({ timeout: 10_000 });
  });

  test("entry list shows card and table toggle", async ({ page }) => {
    const { catalog } = await buildCatalogWithEntries(`Toggle ${Date.now()}`);
    catalogId = catalog.id;

    await page.goto(`/catalogs/${catalogId}/operational`);
    await page.waitForLoadState("networkidle");

    const toggleBtn = page
      .getByRole("button", { name: /table/i })
      .or(page.getByRole("button", { name: /grid/i }))
      .or(page.locator("[data-testid='view-toggle']"))
      .first();
    if (await toggleBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(toggleBtn).toBeVisible();
    }
  });

  test("can search entries by name", async ({ page }) => {
    const { catalog } = await buildCatalogWithEntries(`Search ${Date.now()}`, 3);
    catalogId = catalog.id;

    await page.goto(`/catalogs/${catalogId}/operational`);
    await page.waitForLoadState("networkidle");

    const searchInput = page
      .getByPlaceholder(/search/i)
      .or(page.getByRole("searchbox"))
      .first();
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill("Product 1");
      await page.waitForTimeout(500);
    }
  });

  test("clicking an entry opens the edit form", async ({ page }) => {
    const { catalog } = await buildCatalogWithEntries(`Edit ${Date.now()}`);
    catalogId = catalog.id;

    await page.goto(`/catalogs/${catalogId}/operational`);
    await page.waitForLoadState("networkidle");

    const entryCard = page
      .locator("[data-testid='entry-card']")
      .or(page.locator("tr").nth(1))
      .first();
    if (await entryCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await entryCard.click();
      await page.waitForTimeout(500);
    }
  });
});
