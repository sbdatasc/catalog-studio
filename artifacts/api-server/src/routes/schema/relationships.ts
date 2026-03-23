import { Router, type IRouter } from "express";
import { z } from "zod";
import * as relationshipService from "../../services/relationshipService";
import { ServiceError } from "../../lib/errors";
import { sendSuccess, sendError } from "../../lib/response";
import { requireCatalogRole } from "../../middleware/requireCatalogRole";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

function handleError(res: Parameters<typeof sendError>[0], err: unknown): void {
  if (err instanceof ServiceError) {
    const statusMap: Record<string, number> = {
      NOT_FOUND: 404,
      CONFLICT: 409,
      VALIDATION_ERROR: 422,
      CATALOG_LOCKED: 423,
      BAD_REQUEST: 400,
    };
    const status = statusMap[err.code] ?? 500;
    sendError(res, status, err.code as Parameters<typeof sendError>[2], err.message);
  } else {
    sendError(res, 500, "INTERNAL_ERROR", "An unexpected error occurred");
  }
}

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const CreateRelationshipBody = z.object({
  catalogId: z.string().uuid("catalogId must be a UUID"),
  fromTemplateId: z.string().uuid("fromTemplateId must be a UUID"),
  toTemplateId: z.string().uuid("toTemplateId must be a UUID"),
  label: z.string().min(1, "Label is required").max(100, "Label must be 100 characters or fewer"),
  cardinality: z.enum(["1:1", "1:N", "M:N"], {
    errorMap: () => ({ message: "cardinality must be 1:1, 1:N, or M:N" }),
  }),
  direction: z.enum(["from", "to", "both"]).default("both"),
});

const UpdateRelationshipBody = z.object({
  fromTemplateId: z.undefined({
    errorMap: () => ({ message: "fromTemplateId cannot be changed. Delete and recreate the relationship." }),
  }).optional(),
  toTemplateId: z.undefined({
    errorMap: () => ({ message: "toTemplateId cannot be changed. Delete and recreate the relationship." }),
  }).optional(),
  label: z.string().min(1).max(100).optional(),
  cardinality: z.enum(["1:1", "1:N", "M:N"]).optional(),
  direction: z.enum(["from", "to", "both"]).optional(),
});

const NodePositionsBody = z.object({
  positions: z.array(
    z.object({
      templateId: z.string().uuid(),
      x: z.number(),
      y: z.number(),
    }),
  ),
});

// ---------------------------------------------------------------------------
// GET /api/schema/relationships/positions — viewer
// Must be before /:id routes so "positions" isn't treated as a UUID
// ---------------------------------------------------------------------------

router.get(
  "/positions",
  requireCatalogRole("viewer", (req) => {
    const catalogId = req.query.catalogId as string | undefined;
    if (!catalogId) throw new ServiceError("NOT_FOUND", "catalogId query parameter is required");
    return catalogId;
  }),
  async (req, res): Promise<void> => {
    const catalogId = req.query.catalogId as string | undefined;
    if (!catalogId) {
      sendError(res, 400, "BAD_REQUEST", "catalogId query parameter is required");
      return;
    }
    try {
      const positions = await relationshipService.getNodePositions(catalogId);
      sendSuccess(res, positions);
    } catch (err) {
      handleError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/schema/relationships/positions — designer
// ---------------------------------------------------------------------------

router.post(
  "/positions",
  requireCatalogRole("designer", (req) => {
    const catalogId = req.query.catalogId as string | undefined;
    if (!catalogId) throw new ServiceError("NOT_FOUND", "catalogId query parameter is required");
    return catalogId;
  }),
  async (req, res): Promise<void> => {
    const catalogId = req.query.catalogId as string | undefined;
    if (!catalogId) {
      sendError(res, 400, "BAD_REQUEST", "catalogId query parameter is required");
      return;
    }
    const parsed = NodePositionsBody.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 422, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Validation failed");
      return;
    }
    try {
      await relationshipService.saveNodePositions(catalogId, parsed.data.positions);
      sendSuccess(res, { ok: true });
    } catch (err) {
      handleError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/schema/relationships — viewer
// ---------------------------------------------------------------------------

router.get(
  "/",
  requireCatalogRole("viewer", (req) => {
    const catalogId = req.query.catalogId as string | undefined;
    if (!catalogId) throw new ServiceError("NOT_FOUND", "catalogId query parameter is required");
    return catalogId;
  }),
  async (req, res): Promise<void> => {
    const catalogId = req.query.catalogId as string | undefined;
    if (!catalogId) {
      sendError(res, 400, "BAD_REQUEST", "catalogId query parameter is required");
      return;
    }
    try {
      const relationships = await relationshipService.listRelationships(catalogId);
      sendSuccess(res, relationships);
    } catch (err) {
      handleError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/schema/relationships — designer
// ---------------------------------------------------------------------------

router.post(
  "/",
  requireCatalogRole("designer", (req) => {
    const body = CreateRelationshipBody.safeParse(req.body);
    if (!body.success) throw new ServiceError("NOT_FOUND", "catalogId is required");
    return body.data.catalogId;
  }),
  async (req, res): Promise<void> => {
    const parsed = CreateRelationshipBody.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 422, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Validation failed");
      return;
    }
    try {
      const rel = await relationshipService.createRelationship(parsed.data);
      sendSuccess(res, rel, { status: 201 });
    } catch (err) {
      handleError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/schema/relationships/:id — designer
// ---------------------------------------------------------------------------

router.patch(
  "/:id",
  requireCatalogRole("designer", (req) => relationshipService.getCatalogIdForRelationship(req.params.id)),
  async (req, res): Promise<void> => {
    if (req.body.fromTemplateId !== undefined || req.body.toTemplateId !== undefined) {
      sendError(
        res,
        422,
        "VALIDATION_ERROR",
        "fromTemplateId and toTemplateId cannot be changed. Delete and recreate the relationship.",
      );
      return;
    }

    const parsed = UpdateRelationshipBody.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 422, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Validation failed");
      return;
    }

    try {
      const rel = await relationshipService.updateRelationship(req.params.id, parsed.data);
      sendSuccess(res, rel);
    } catch (err) {
      handleError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/schema/relationships/:id — designer
// ---------------------------------------------------------------------------

router.delete(
  "/:id",
  requireCatalogRole("designer", (req) => relationshipService.getCatalogIdForRelationship(req.params.id)),
  async (req, res): Promise<void> => {
    try {
      const result = await relationshipService.deleteRelationship(req.params.id);
      sendSuccess(res, { deleted: true, entryLinkCount: result.entryLinkCount });
    } catch (err) {
      handleError(res, err);
    }
  },
);

export default router;
