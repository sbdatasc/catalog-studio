import { vi } from "vitest";
import type { apiClient } from "@/lib/apiClient";

export type MockApiClient = {
  catalogs: {
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    transition: ReturnType<typeof vi.fn>;
    duplicate: ReturnType<typeof vi.fn>;
  };
  schema: {
    listTemplates: ReturnType<typeof vi.fn>;
    getTemplate: ReturnType<typeof vi.fn>;
    createTemplate: ReturnType<typeof vi.fn>;
    updateTemplate: ReturnType<typeof vi.fn>;
    deleteTemplate: ReturnType<typeof vi.fn>;
    listSections: ReturnType<typeof vi.fn>;
    createSection: ReturnType<typeof vi.fn>;
    updateSection: ReturnType<typeof vi.fn>;
    deleteSection: ReturnType<typeof vi.fn>;
    reorderSections: ReturnType<typeof vi.fn>;
    listAttributes: ReturnType<typeof vi.fn>;
    createAttribute: ReturnType<typeof vi.fn>;
    updateAttribute: ReturnType<typeof vi.fn>;
    deleteAttribute: ReturnType<typeof vi.fn>;
    reorderAttributes: ReturnType<typeof vi.fn>;
    listRelationships: ReturnType<typeof vi.fn>;
    createRelationship: ReturnType<typeof vi.fn>;
    updateRelationship: ReturnType<typeof vi.fn>;
    deleteRelationship: ReturnType<typeof vi.fn>;
    getNodePositions: ReturnType<typeof vi.fn>;
    saveNodePositions: ReturnType<typeof vi.fn>;
    getPublishChecklist: ReturnType<typeof vi.fn>;
    getCurrentVersion: ReturnType<typeof vi.fn>;
    getVersionHistory: ReturnType<typeof vi.fn>;
    getVersionDiff: ReturnType<typeof vi.fn>;
    publish: ReturnType<typeof vi.fn>;
  };
  entries: {
    list: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    getLinks: ReturnType<typeof vi.fn>;
    link: ReturnType<typeof vi.fn>;
    unlink: ReturnType<typeof vi.fn>;
  };
  graphql: ReturnType<typeof vi.fn>;
};

export type ApiClientInstance = typeof apiClient;

function successResponse<T>(data: T) {
  return Promise.resolve({ data, error: null });
}

export function createMockApiClient(): MockApiClient {
  return {
    catalogs: {
      list: vi.fn(() => successResponse([])),
      get: vi.fn(() => successResponse(null)),
      create: vi.fn(() => successResponse(null)),
      update: vi.fn(() => successResponse(null)),
      transition: vi.fn(() => successResponse(null)),
      duplicate: vi.fn(() => successResponse(null)),
    },
    schema: {
      listTemplates: vi.fn(() => successResponse([])),
      getTemplate: vi.fn(() => successResponse(null)),
      createTemplate: vi.fn(() => successResponse(null)),
      updateTemplate: vi.fn(() => successResponse(null)),
      deleteTemplate: vi.fn(() => successResponse({ deleted: true })),
      listSections: vi.fn(() => successResponse([])),
      createSection: vi.fn(() => successResponse(null)),
      updateSection: vi.fn(() => successResponse(null)),
      deleteSection: vi.fn(() => successResponse({ deleted: true })),
      reorderSections: vi.fn(() => successResponse({ reordered: true })),
      listAttributes: vi.fn(() => successResponse([])),
      createAttribute: vi.fn(() => successResponse(null)),
      updateAttribute: vi.fn(() => successResponse(null)),
      deleteAttribute: vi.fn(() => successResponse({ deleted: true })),
      reorderAttributes: vi.fn(() => successResponse({ reordered: true })),
      listRelationships: vi.fn(() => successResponse([])),
      createRelationship: vi.fn(() => successResponse(null)),
      updateRelationship: vi.fn(() => successResponse(null)),
      deleteRelationship: vi.fn(() => successResponse({ deleted: true, entryLinkCount: 0 })),
      getNodePositions: vi.fn(() => successResponse([])),
      saveNodePositions: vi.fn(() => successResponse({ ok: true })),
      getPublishChecklist: vi.fn(() => successResponse(null)),
      getCurrentVersion: vi.fn(() => successResponse(null)),
      getVersionHistory: vi.fn(() => successResponse([])),
      getVersionDiff: vi.fn(() => successResponse(null)),
      publish: vi.fn(() => successResponse(null)),
    },
    entries: {
      list: vi.fn(() => successResponse({ entries: [], total: 0, page: 1, totalPages: 0 })),
      search: vi.fn(() => successResponse([])),
      create: vi.fn(() => successResponse(null)),
      get: vi.fn(() => successResponse(null)),
      update: vi.fn(() => successResponse(null)),
      delete: vi.fn(() => successResponse({ deleted: true })),
      getLinks: vi.fn(() => successResponse([])),
      link: vi.fn(() => successResponse(null)),
      unlink: vi.fn(() => successResponse({ deleted: true })),
    },
    graphql: vi.fn(() => successResponse({})),
  };
}
