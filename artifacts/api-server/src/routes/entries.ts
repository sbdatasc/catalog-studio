import { Router, type IRouter } from "express";
import { z } from "zod";
import * as entryService from "../services/entryService";
import { ServiceError } from "../lib/errors";
import { sendSuccess, sendError } from "../lib/response";

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
});

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
// GET /api/entries/search — must be before /:id to avoid conflicts
// ---------------------------------------------------------------------------

router.get("/search", async (req, res) => {
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
});

// ---------------------------------------------------------------------------
// GET /api/entries
// ---------------------------------------------------------------------------

router.get("/", async (req, res) => {
  const parsed = ListEntriesQuery.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, "BAD_REQUEST" as never, parsed.error.errors[0]?.message ?? "Invalid query");
  }

  try {
    const { catalogId, templateId, page, limit } = parsed.data;
    const result = await entryService.listEntries(catalogId, templateId, page, limit);
    sendSuccess(res, result);
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/entries
// ---------------------------------------------------------------------------

router.post("/", async (req, res) => {
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
});

// ---------------------------------------------------------------------------
// GET /api/entries/:id
// ---------------------------------------------------------------------------

router.get("/:id", async (req, res) => {
  try {
    const entry = await entryService.getEntry(req.params.id);
    sendSuccess(res, entry);
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/entries/:id
// ---------------------------------------------------------------------------

router.patch("/:id", async (req, res) => {
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
});

// ---------------------------------------------------------------------------
// DELETE /api/entries/:id
// ---------------------------------------------------------------------------

router.delete("/:id", async (req, res) => {
  try {
    await entryService.deleteEntry(req.params.id);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    handleServiceError(res, err);
  }
});

export default router;
