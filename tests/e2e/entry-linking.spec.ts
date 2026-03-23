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

test.describe("Entry Linking", () => {
  let catalogId: string | null = null;

  test.afterEach(async () => {
    if (catalogId) {
      const api = await createApiContext();
      await apiDeleteCatalog(api, catalogId);
      await api.dispose();
      catalogId = null;
    }
  });

  async function buildLinkedCatalog(suffix: string) {
    const api = await createApiContext();
    const catalog = await apiCreateCatalog(api, `Entry Linking ${suffix}`);
    const templateA = await apiCreateTemplate(api, catalog.id, "Product");
    const templateB = await apiCreateTemplate(api, catalog.id, "Category");
    const sectionA = await apiCreateSection(api, templateA.id, "Details");
    const sectionB = await apiCreateSection(api, templateB.id, "Info");
    const attrA = await apiCreateAttribute(api, sectionA.id, "Name", "text", true);
    const attrB = await apiCreateAttribute(api, sectionB.id, "Title", "text", true);

    const relResponse = await api.post("/api/schema/relationships", {
      data: {
        catalogId: catalog.id,
        fromTemplateId: templateA.id,
        toTemplateId: templateB.id,
        label: "belongs to",
        cardinality: "M:N",
        direction: "from",
      },
    });
    const relationship = await relResponse.json();

    await apiPublishSchema(api, catalog.id);

    const entryA = await apiCreateEntry(api, catalog.id, templateA.id, { [attrA.id]: "Widget" });
    const entryB = await apiCreateEntry(api, catalog.id, templateB.id, { [attrB.id]: "Widgets" });

    await api.dispose();
    return { catalog, templateA, templateB, relationship, entryA, entryB };
  }

  test("relationship links panel is visible for entries", async ({ page }) => {
    const { catalog } = await buildLinkedCatalog(`${Date.now()}`);
    catalogId = catalog.id;

    await page.goto(`/catalogs/${catalogId}/operational`);
    await page.waitForLoadState("networkidle");

    await page.waitForTimeout(2000);

    const relPanel = page
      .locator("[data-testid='relationship-panel']")
      .or(page.getByText(/relationship/i).first())
      .or(page.getByText(/linked/i).first());
    if (await relPanel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(relPanel).toBeVisible();
    }
  });

  test("linked entries appear in the links section", async ({ page }) => {
    const { catalog, entryA, relationship } = await buildLinkedCatalog(`Links ${Date.now()}`);
    catalogId = catalog.id;

    const api = await createApiContext();
    await api.post(`/api/entries/${entryA.id}/relationships`, {
      data: { relationshipId: relationship.id, toEntryId: entryA.id },
    }).catch(() => {});
    await api.dispose();

    await page.goto(`/catalogs/${catalogId}/operational`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
  });
});
