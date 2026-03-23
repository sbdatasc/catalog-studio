import { request, type APIRequestContext } from "@playwright/test";

const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://localhost:18425";

export async function createApiContext(): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "Content-Type": "application/json" },
  });
}

export async function apiCreateCatalog(api: APIRequestContext, name: string, description?: string) {
  const response = await api.post("/api/catalogs", {
    data: { name, description: description ?? null },
  });
  if (!response.ok()) throw new Error(`Failed to create catalog: ${response.status()} ${await response.text()}`);
  return response.json() as Promise<{ id: string; name: string; status: string }>;
}

export async function apiCreateTemplate(
  api: APIRequestContext,
  catalogId: string,
  name: string,
  isReferenceData = false,
) {
  const response = await api.post("/api/schema/templates", {
    data: { catalogId, name, isReferenceData },
  });
  if (!response.ok()) throw new Error(`Failed to create template: ${response.status()} ${await response.text()}`);
  return response.json() as Promise<{ id: string; name: string }>;
}

export async function apiCreateSection(api: APIRequestContext, templateId: string, name: string) {
  const response = await api.post(`/api/schema/templates/${templateId}/sections`, {
    data: { name },
  });
  if (!response.ok()) throw new Error(`Failed to create section: ${response.status()} ${await response.text()}`);
  return response.json() as Promise<{ id: string; name: string }>;
}

export async function apiCreateAttribute(
  api: APIRequestContext,
  sectionId: string,
  name: string,
  attributeType: string,
  required = false,
) {
  const response = await api.post(`/api/schema/sections/${sectionId}/attributes`, {
    data: { name, attributeType, required },
  });
  if (!response.ok()) throw new Error(`Failed to create attribute: ${response.status()} ${await response.text()}`);
  return response.json() as Promise<{ id: string; name: string; attributeType: string }>;
}

export async function apiPublishSchema(api: APIRequestContext, catalogId: string) {
  const response = await api.post("/api/schema/publish", {
    data: { catalogId },
  });
  if (!response.ok()) throw new Error(`Failed to publish schema: ${response.status()} ${await response.text()}`);
  return response.json();
}

export async function apiCreateEntry(
  api: APIRequestContext,
  catalogId: string,
  templateId: string,
  fieldValues: Record<string, unknown>,
) {
  const response = await api.post("/api/entries", {
    data: { catalogId, templateId, fieldValues },
  });
  if (!response.ok()) throw new Error(`Failed to create entry: ${response.status()} ${await response.text()}`);
  return response.json() as Promise<{ id: string; catalogId: string; templateId: string }>;
}

export async function apiDeleteCatalog(api: APIRequestContext, catalogId: string) {
  await api.delete(`/api/catalogs/${catalogId}`).catch(() => {});
}
