import { test, expect } from "@playwright/test";
import { createApiContext, apiCreateCatalog, apiDeleteCatalog } from "./helpers/api";

test.describe("Catalog Lifecycle", () => {
  let createdCatalogId: string | null = null;

  test.afterEach(async () => {
    if (createdCatalogId) {
      const api = await createApiContext();
      await apiDeleteCatalog(api, createdCatalogId);
      await api.dispose();
      createdCatalogId = null;
    }
  });

  test("can create a new catalog from the home screen", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const createBtn = page.getByRole("button", { name: /new catalog/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    const nameInput = page.getByPlaceholder(/catalog name/i).or(page.getByLabel(/name/i)).first();
    await nameInput.fill("E2E Test Catalog");

    const submitBtn = page.getByRole("button", { name: /create/i }).last();
    await submitBtn.click();

    await expect(page.getByText("E2E Test Catalog")).toBeVisible({ timeout: 10_000 });

    const api = await createApiContext();
    const catalogs = await api.get("/api/catalogs");
    const data = await catalogs.json();
    const found = data.find((c: { name: string; id: string }) => c.name === "E2E Test Catalog");
    expect(found).toBeTruthy();
    createdCatalogId = found?.id ?? null;
    await api.dispose();
  });

  test("catalog appears in the catalog list", async ({ page }) => {
    const api = await createApiContext();
    const catalog = await apiCreateCatalog(api, `E2E List Test ${Date.now()}`);
    createdCatalogId = catalog.id;

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(catalog.name)).toBeVisible({ timeout: 10_000 });
    await api.dispose();
  });

  test("catalog card shows status badge", async ({ page }) => {
    const api = await createApiContext();
    const catalog = await apiCreateCatalog(api, `E2E Status Test ${Date.now()}`);
    createdCatalogId = catalog.id;

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const card = page.locator(`[data-testid="catalog-card"]`).filter({ hasText: catalog.name }).first();
    if (await card.count() > 0) {
      await expect(card.getByText(/draft/i)).toBeVisible();
    } else {
      await expect(page.getByText(/draft/i).first()).toBeVisible();
    }
    await api.dispose();
  });

  test("clicking a catalog navigates to its designer page", async ({ page }) => {
    const api = await createApiContext();
    const catalog = await apiCreateCatalog(api, `E2E Nav Test ${Date.now()}`);
    createdCatalogId = catalog.id;

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.getByText(catalog.name).first().click();
    await expect(page).toHaveURL(new RegExp(`/catalogs/${catalog.id}`), { timeout: 10_000 });
    await api.dispose();
  });
});
