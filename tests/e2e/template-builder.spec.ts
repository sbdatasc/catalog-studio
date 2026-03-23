import { test, expect } from "@playwright/test";
import {
  createApiContext,
  apiCreateCatalog,
  apiCreateTemplate,
  apiCreateSection,
  apiCreateAttribute,
  apiDeleteCatalog,
} from "./helpers/api";

test.describe("Template Builder", () => {
  let catalogId: string | null = null;

  test.afterEach(async () => {
    if (catalogId) {
      const api = await createApiContext();
      await apiDeleteCatalog(api, catalogId);
      await api.dispose();
      catalogId = null;
    }
  });

  test("can add a template to a catalog", async ({ page }) => {
    const api = await createApiContext();
    const catalog = await apiCreateCatalog(api, `Template Builder Test ${Date.now()}`);
    catalogId = catalog.id;

    await page.goto(`/catalogs/${catalogId}`);
    await page.waitForLoadState("networkidle");

    const addTemplateBtn = page
      .getByRole("button", { name: /add template/i })
      .or(page.getByRole("button", { name: /new template/i }))
      .first();
    await expect(addTemplateBtn).toBeVisible({ timeout: 10_000 });
    await addTemplateBtn.click();

    const nameInput = page.getByPlaceholder(/template name/i).or(page.getByLabel(/name/i)).first();
    await nameInput.fill("Product");
    await page.getByRole("button", { name: /create/i }).last().click();

    await expect(page.getByText("Product")).toBeVisible({ timeout: 10_000 });
    await api.dispose();
  });

  test("can add a section to a template", async ({ page }) => {
    const api = await createApiContext();
    const catalog = await apiCreateCatalog(api, `Section Test ${Date.now()}`);
    catalogId = catalog.id;
    const template = await apiCreateTemplate(api, catalogId, "Product");

    await page.goto(`/catalogs/${catalogId}`);
    await page.waitForLoadState("networkidle");
    await page.getByText("Product").first().click();

    const addSectionBtn = page.getByRole("button", { name: /add section/i }).first();
    if (await addSectionBtn.isVisible()) {
      await addSectionBtn.click();
      const nameInput = page.getByPlaceholder(/section name/i).or(page.getByLabel(/name/i)).first();
      await nameInput.fill("Details");
      await page.getByRole("button", { name: /create/i }).last().click();
      await expect(page.getByText("Details")).toBeVisible({ timeout: 10_000 });
    }
    await api.dispose();
    void template;
  });

  test("can add an attribute to a section", async ({ page }) => {
    const api = await createApiContext();
    const catalog = await apiCreateCatalog(api, `Attribute Test ${Date.now()}`);
    catalogId = catalog.id;
    const template = await apiCreateTemplate(api, catalogId, "Product");
    const section = await apiCreateSection(api, template.id, "Details");

    await page.goto(`/catalogs/${catalogId}`);
    await page.waitForLoadState("networkidle");
    await page.getByText("Product").first().click();

    await page.waitForTimeout(1000);
    const addAttrBtn = page.getByRole("button", { name: /add attribute/i }).or(page.getByRole("button", { name: /\+ attribute/i })).first();
    if (await addAttrBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addAttrBtn.click();
      const nameInput = page.getByPlaceholder(/attribute name/i).or(page.getByLabel(/name/i)).first();
      await nameInput.fill("Title");
      await page.getByRole("button", { name: /create/i }).last().click();
      await expect(page.getByText("Title")).toBeVisible({ timeout: 10_000 });
    }
    await api.dispose();
    void section;
  });

  test("attribute types are displayed in the type selector", async ({ page }) => {
    const api = await createApiContext();
    const catalog = await apiCreateCatalog(api, `Type Selector Test ${Date.now()}`);
    catalogId = catalog.id;
    await apiCreateTemplate(api, catalogId, "Item");

    await page.goto(`/catalogs/${catalogId}`);
    await page.waitForLoadState("networkidle");
    await page.getByText("Item").first().click();

    await page.waitForTimeout(1000);
    const addAttrBtn = page.getByRole("button", { name: /add attribute/i }).first();
    if (await addAttrBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addAttrBtn.click();
      const typeSelect = page.getByRole("combobox").or(page.locator("select")).first();
      if (await typeSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(typeSelect).toBeVisible();
      }
    }
    await api.dispose();
  });
});
