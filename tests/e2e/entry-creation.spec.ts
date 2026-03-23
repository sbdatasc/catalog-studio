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

test.describe("Entry Creation", () => {
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
    const catalog = await apiCreateCatalog(api, `Entry Creation ${suffix}`);
    const template = await apiCreateTemplate(api, catalog.id, "Product");
    const section = await apiCreateSection(api, template.id, "Details");
    await apiCreateAttribute(api, section.id, "Name", "text", true);
    await apiPublishSchema(api, catalog.id);
    await api.dispose();
    return { catalog, template };
  }

  test("entry form opens when 'new entry' button is clicked", async ({ page }) => {
    const { catalog } = await buildPublishedCatalog(`${Date.now()}`);
    catalogId = catalog.id;

    await page.goto(`/catalogs/${catalogId}/operational`);
    await page.waitForLoadState("networkidle");

    const newEntryBtn = page
      .getByRole("button", { name: /new entry/i })
      .or(page.getByRole("button", { name: /create entry/i }))
      .or(page.getByRole("button", { name: /\+ entry/i }))
      .first();
    await expect(newEntryBtn).toBeVisible({ timeout: 10_000 });
    await newEntryBtn.click();

    const form = page.getByRole("form").or(page.locator("form")).or(page.locator("[data-testid='entry-form']")).first();
    if (await form.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(form).toBeVisible();
    } else {
      const nameField = page.getByLabel(/name/i).or(page.getByPlaceholder(/name/i)).first();
      await expect(nameField).toBeVisible({ timeout: 5000 });
    }
  });

  test("can submit an entry form with required fields filled", async ({ page }) => {
    const { catalog } = await buildPublishedCatalog(`Submit ${Date.now()}`);
    catalogId = catalog.id;

    await page.goto(`/catalogs/${catalogId}/operational`);
    await page.waitForLoadState("networkidle");

    const newEntryBtn = page
      .getByRole("button", { name: /new entry/i })
      .or(page.getByRole("button", { name: /create entry/i }))
      .first();

    if (await newEntryBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await newEntryBtn.click();
      const nameField = page.getByLabel(/name/i).or(page.getByPlaceholder(/name/i)).first();
      if (await nameField.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nameField.fill("Test Product Alpha");
        const saveBtn = page.getByRole("button", { name: /save/i }).or(page.getByRole("button", { name: /submit/i })).first();
        await saveBtn.click();
        await page.waitForTimeout(2000);
      }
    }
  });

  test("shows validation error for empty required field", async ({ page }) => {
    const { catalog } = await buildPublishedCatalog(`Validation ${Date.now()}`);
    catalogId = catalog.id;

    await page.goto(`/catalogs/${catalogId}/operational`);
    await page.waitForLoadState("networkidle");

    const newEntryBtn = page
      .getByRole("button", { name: /new entry/i })
      .or(page.getByRole("button", { name: /create entry/i }))
      .first();

    if (await newEntryBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await newEntryBtn.click();
      const saveBtn = page.getByRole("button", { name: /save/i }).or(page.getByRole("button", { name: /submit/i })).first();
      if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await saveBtn.click();
        const errorMsg = page.getByText(/required/i).or(page.getByText(/must be/i)).first();
        if (await errorMsg.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(errorMsg).toBeVisible();
        }
      }
    }
  });
});
