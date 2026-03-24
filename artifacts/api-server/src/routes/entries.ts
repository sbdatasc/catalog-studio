import { Router, type IRouter } from "express";
import { z } from "zod";
import * as entryService from "../services/entryService";
import type { EntryFilter } from "../services/entryService";
import { FILTER_OPERATORS } from "../services/entryService";
import { ServiceError } from "../lib/errors";
import { sendSuccess, sendError } from "../lib/response";
import { requireCatalogRole } from "../middleware/requireCatalogRole";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const FieldValueInput = z.object({
  attributeId: z.string().uuid("attributeId must be a valid UUID"),
  value: z.string().nullable(),
});

const CreateEntryBody = z.object({
  catalogId: z.string().uuid("catalogId must be a valid UUID"),
  templateId: z.string().uuid("templateId must be a valid UUID"),
  fieldValues: z.array(FieldValueInput),
});

const UpdateEntryBody = z.object({
  fieldValues: z.array(FieldValueInput),
});

const LinkEntryBody = z.object({
  relationshipId: z.string().uuid("relationshipId must be a valid UUID"),
  toEntryId: z.string().uuid("toEntryId must be a valid UUID"),
});

const ListEntriesQuery = z.object({
  catalogId: z.string().uuid("catalogId must be a valid UUID"),
  templateId: z.string().uuid("templateId must be a valid UUID"),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 24))
    .pipe(z.number().int().min(1).max(100)),
  filter: z.record(z.string(), z.record(z.string(), z.string())).optional().default({}),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseFiltersFromQuery(raw: Record<string, Record<string, string>>): EntryFilter[] {
  const filters: EntryFilter[] = [];
  for (const [attributeId, ops] of Object.entries(raw)) {
    if (!UUID_RE.test(attributeId)) continue;
    for (const [operator, value] of Object.entries(ops)) {
      if (!FILTER_OPERATORS.includes(operator as typeof FILTER_OPERATORS[number])) continue;
      filters.push({
        attributeId,
        operator: operator as EntryFilter["operator"],
        value: value === "" ? null : value,
      });
    }
  }
  return filters;
}

const SearchEntriesQuery = z.object({
  catalogId: z.string().uuid("catalogId must be a valid UUID"),
  templateId: z.string().uuid("templateId must be a valid UUID"),
  q: z.string().min(1, "q must be at least 1 character"),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 10))
    .pipe(z.number().int().min(1).max(50)),
});

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

function handleServiceError(res: Parameters<typeof sendError>[0], err: unknown): void {
  if (err instanceof ServiceError) {
    switch (err.code) {
      case "NOT_FOUND":
        sendError(res, 404, "NOT_FOUND" as never, err.message);
        return;
      case "REFERENCE_NOT_FOUND":
        sendError(res, 422, "VALIDATION_ERROR" as never, err.message, {
          details: { code: err.code },
        });
        return;
      case "REQUIRED_FIELD_MISSING":
        sendError(res, 422, "VALIDATION_ERROR" as never, err.message, {
          details: { code: "REQUIRED_FIELD_MISSING" },
        });
        return;
      case "VALIDATION_ERROR":
        sendError(res, 422, "VALIDATION_ERROR" as never, err.message);
        return;
      case "CATALOG_LOCKED":
        sendError(res, 403, "FORBIDDEN" as never, err.message, {
          details: { code: "CATALOG_LOCKED" },
        });
        return;
      case "CONFLICT":
        sendError(res, 409, "CONFLICT" as never, err.message, {
          details: { code: "CONFLICT" },
        });
        return;
      case "UNPROCESSABLE":
        sendError(res, 422, "UNPROCESSABLE" as never, err.message);
        return;
      default:
        sendError(res, 400, "BAD_REQUEST" as never, err.message);
        return;
    }
  }
  sendError(res, 500, "INTERNAL_ERROR" as never, "An unexpected error occurred");
}

// ---------------------------------------------------------------------------
// GET /api/entries/search — viewer (must be before /:id to avoid conflicts)
// ---------------------------------------------------------------------------

router.get(
  "/search",
  requireCatalogRole("viewer", (req) => {
    const catalogId = req.query.catalogId as string | undefined;
    if (!catalogId) throw new ServiceError("NOT_FOUND", "catalogId query parameter is required");
    return catalogId;
  }),
  async (req, res) => {
    const parsed = SearchEntriesQuery.safeParse(req.query);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST" as never, parsed.error.errors[0]?.message ?? "Invalid query");
    }

    try {
      const { catalogId, templateId, q, limit } = parsed.data;
      const entries = await entryService.searchEntries(catalogId, templateId, q, limit);
      sendSuccess(res, entries);
    } catch (err) {
      handleServiceError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/entries — viewer
// ---------------------------------------------------------------------------

router.get(
  "/",
  requireCatalogRole("viewer", (req) => {
    const catalogId = req.query.catalogId as string | undefined;
    if (!catalogId) throw new ServiceError("NOT_FOUND", "catalogId query parameter is required");
    return catalogId;
  }),
  async (req, res) => {
    const parsed = ListEntriesQuery.safeParse(req.query);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST" as never, parsed.error.errors[0]?.message ?? "Invalid query");
    }

    try {
      const { catalogId, templateId, page, limit, filter } = parsed.data;
      const filters = parseFiltersFromQuery(filter);
      const result = await entryService.listEntries(catalogId, templateId, page, limit, filters);
      sendSuccess(res, result);
    } catch (err) {
      handleServiceError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/entries — steward
// ---------------------------------------------------------------------------

router.post(
  "/",
  requireCatalogRole("steward", (req) => {
    const body = CreateEntryBody.safeParse(req.body);
    if (!body.success) throw new ServiceError("NOT_FOUND", "catalogId is required");
    return body.data.catalogId;
  }),
  async (req, res) => {
    const parsed = CreateEntryBody.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST" as never, parsed.error.errors[0]?.message ?? "Validation failed");
    }

    try {
      const entry = await entryService.createEntry(parsed.data);
      sendSuccess(res, entry, { status: 201 });
    } catch (err) {
      handleServiceError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/entries/bulk-link — steward (O-05)
// ---------------------------------------------------------------------------

const BulkLinkBody = z.object({
  catalogId: z.string().uuid("catalogId must be a valid UUID"),
  fromEntryIds: z
    .array(z.string().uuid("each fromEntryId must be a valid UUID"))
    .min(1, "fromEntryIds must not be empty"),
  toEntryId: z.string().uuid("toEntryId must be a valid UUID"),
  relationshipId: z.string().uuid("relationshipId must be a valid UUID"),
});

router.post(
  "/bulk-link",
  requireCatalogRole("steward", (req) => {
    const catalogId = req.body?.catalogId;
    if (!catalogId || typeof catalogId !== "string") {
      throw new ServiceError("NOT_FOUND", "catalogId is required");
    }
    return catalogId;
  }),
  async (req, res) => {
    const parsed = BulkLinkBody.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        res,
        422,
        "VALIDATION_ERROR" as never,
        parsed.error.errors[0]?.message ?? "Validation failed",
      );
    }

    try {
      const result = await entryService.bulkLinkEntries({
        fromEntryIds: parsed.data.fromEntryIds,
        toEntryId: parsed.data.toEntryId,
        relationshipId: parsed.data.relationshipId,
      });
      sendSuccess(res, result);
    } catch (err) {
      handleServiceError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/entries/:id — viewer
// ---------------------------------------------------------------------------

router.get(
  "/:id",
  requireCatalogRole("viewer", (req) => entryService.getCatalogIdForEntry(req.params.id)),
  async (req, res) => {
    try {
      const entry = await entryService.getEntry(req.params.id);
      sendSuccess(res, entry);
    } catch (err) {
      handleServiceError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/entries/:id — steward
// ---------------------------------------------------------------------------

router.patch(
  "/:id",
  requireCatalogRole("steward", (req) => entryService.getCatalogIdForEntry(req.params.id)),
  async (req, res) => {
    const parsed = UpdateEntryBody.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST" as never, parsed.error.errors[0]?.message ?? "Validation failed");
    }

    try {
      const entry = await entryService.updateEntry(req.params.id, parsed.data);
      sendSuccess(res, entry);
    } catch (err) {
      handleServiceError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/entries/:id — steward
// ---------------------------------------------------------------------------

router.delete(
  "/:id",
  requireCatalogRole("steward", (req) => entryService.getCatalogIdForEntry(req.params.id)),
  async (req, res) => {
    try {
      await entryService.deleteEntry(req.params.id);
      sendSuccess(res, { deleted: true });
    } catch (err) {
      handleServiceError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/entries/:id/relationships — viewer (O-03)
// ---------------------------------------------------------------------------

router.get(
  "/:id/relationships",
  requireCatalogRole("viewer", (req) => entryService.getCatalogIdForEntry(req.params.id)),
  async (req, res) => {
    try {
      const links = await entryService.getLinkedEntries(req.params.id);
      sendSuccess(res, links);
    } catch (err) {
      handleServiceError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/entries/:id/relationships — steward (O-03)
// ---------------------------------------------------------------------------

router.post(
  "/:id/relationships",
  requireCatalogRole("steward", (req) => entryService.getCatalogIdForEntry(req.params.id)),
  async (req, res) => {
    const parsed = LinkEntryBody.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST" as never, parsed.error.errors[0]?.message ?? "Validation failed");
    }

    try {
      const link = await entryService.linkEntries({
        fromEntryId: req.params.id,
        toEntryId: parsed.data.toEntryId,
        relationshipId: parsed.data.relationshipId,
      });
      sendSuccess(res, link, { status: 201 });
    } catch (err) {
      handleServiceError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/entries/:id/relationships/:linkId — steward (O-03)
// ---------------------------------------------------------------------------

router.delete(
  "/:id/relationships/:linkId",
  requireCatalogRole("steward", (req) => entryService.getCatalogIdForEntry(req.params.id)),
  async (req, res) => {
    try {
      await entryService.unlinkEntries(req.params.linkId);
      sendSuccess(res, { deleted: true });
    } catch (err) {
      handleServiceError(res, err);
    }
  },
);

export default router;
