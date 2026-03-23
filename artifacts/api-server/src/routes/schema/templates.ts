import { Router, type IRouter } from "express";
import { z } from "zod";
import * as templateService from "../../services/templateService";
import { ServiceError } from "../../lib/errors";
import { sendSuccess, sendError } from "../../lib/response";
import { requireCatalogRole } from "../../middleware/requireCatalogRole";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const CreateTemplateBody = z.object({
  catalogId: z.string().uuid("catalogId must be a UUID"),
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or fewer"),
  description: z.string().max(500, "Description must be 500 characters or fewer").nullish(),
  isReferenceData: z.boolean().optional(),
});

const UpdateTemplateBody = z.object({
  name: z.string().min(1, "Name must not be empty").max(100).optional(),
  description: z.string().max(500).nullish().optional(),
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

function handleError(res: Parameters<typeof sendError>[0], err: unknown): void {
  if (err instanceof ServiceError) {
    const statusMap: Record<string, number> = {
      NOT_FOUND: 404,
      CONFLICT: 409,
      VALIDATION_ERROR: 422,
      UNPROCESSABLE: 422,
      TEMPLATE_IN_USE: 409,
      CATALOG_LOCKED: 423,
      CATALOG_INVALID_TRANSITION: 409,
      BAD_REQUEST: 400,
    };
    const status = statusMap[err.code] ?? 500;
    sendError(res, status, err.code as Parameters<typeof sendError>[2], err.message);
  } else {
    sendError(res, 500, "INTERNAL_ERROR", "An unexpected error occurred");
  }
}

// ---------------------------------------------------------------------------
// Relationship routes — must be declared before /:id routes to avoid conflicts
// ---------------------------------------------------------------------------

router.get(
  "/relationships",
  async (_req, res): Promise<void> => {
    try {
      sendSuccess(res, await templateService.listRelationships());
    } catch (err) {
      handleError(res, err);
    }
  },
);

router.post(
  "/relationships",
  requireCatalogRole("designer", (req) => req.body.fromTemplateId
    ? templateService.getCatalogIdForTemplate(req.body.fromTemplateId)
    : Promise.reject(new ServiceError("NOT_FOUND", "fromTemplateId is required"))
  ),
  async (req, res): Promise<void> => {
    const CreateRelationshipBody = z.object({
      fromTemplateId: z.string().uuid("fromTemplateId must be a UUID"),
      toTemplateId: z.string().uuid("toTemplateId must be a UUID"),
      label: z.string().min(1, "Label is required").max(100),
      cardinality: z.enum(["1:1", "1:N", "M:N"], {
        errorMap: () => ({ message: "cardinality must be 1:1, 1:N, or M:N" }),
      }),
      direction: z.enum(["from", "to", "both"]).optional(),
    });
    const parsed = CreateRelationshipBody.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 422, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Validation failed");
      return;
    }
    try {
      const rel = await templateService.createRelationship(parsed.data);
      sendSuccess(res, rel, { status: 201 });
    } catch (err) {
      handleError(res, err);
    }
  },
);

router.delete(
  "/relationships/:id",
  requireCatalogRole("designer", (req) => templateService.getCatalogIdForTemplateRelationship(req.params.id)),
  async (req, res): Promise<void> => {
    try {
      await templateService.deleteRelationship(req.params.id);
      sendSuccess(res, { deleted: true });
    } catch (err) {
      handleError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// Publish routes — must be before /:id to avoid conflicts
// ---------------------------------------------------------------------------

router.post(
  "/publish",
  requireCatalogRole("designer", (req) => {
    const body = z.object({ catalogId: z.string().uuid("catalogId must be a UUID") }).safeParse(req.body);
    if (!body.success) throw new ServiceError("NOT_FOUND", "catalogId (UUID) is required");
    return body.data.catalogId;
  }),
  async (req, res): Promise<void> => {
    const body = z.object({ catalogId: z.string().uuid("catalogId must be a UUID") }).safeParse(req.body);
    if (!body.success) {
      sendError(res, 422, "VALIDATION_ERROR", body.error.issues[0]?.message ?? "Validation failed");
      return;
    }
    try {
      const version = await templateService.publishSchema(body.data.catalogId);
      sendSuccess(res, version, { status: 201 });
    } catch (err) {
      handleError(res, err);
    }
  },
);

router.get(
  "/current-version",
  requireCatalogRole("viewer", (req) => {
    const catalogId = req.query["catalogId"] as string | undefined;
    if (!catalogId) throw new ServiceError("NOT_FOUND", "catalogId query parameter is required");
    return catalogId;
  }),
  async (req, res): Promise<void> => {
    const catalogId = req.query["catalogId"] as string | undefined;
    if (!catalogId) {
      sendError(res, 400, "BAD_REQUEST", "catalogId query parameter is required");
      return;
    }
    try {
      const version = await templateService.getCurrentPublishedSchema(catalogId);
      if (!version) {
        sendError(res, 404, "NOT_FOUND", "No published schema version found");
        return;
      }
      sendSuccess(res, version);
    } catch (err) {
      handleError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/schema/templates — viewer
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
    const isRefParam = req.query.isReferenceData as string | undefined;

    if (!catalogId) {
      sendError(res, 400, "BAD_REQUEST", "catalogId query parameter is required");
      return;
    }

    const isReferenceData =
      isRefParam === "true" ? true : isRefParam === "false" ? false : undefined;

    try {
      const templates = await templateService.listTemplates(catalogId, isReferenceData);
      sendSuccess(res, templates);
    } catch (err) {
      handleError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/schema/templates — designer
// ---------------------------------------------------------------------------

router.post(
  "/",
  requireCatalogRole("designer", (req) => {
    const body = CreateTemplateBody.safeParse(req.body);
    if (!body.success) throw new ServiceError("NOT_FOUND", "catalogId is required");
    return body.data.catalogId;
  }),
  async (req, res): Promise<void> => {
    const parsed = CreateTemplateBody.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 422, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Validation failed");
      return;
    }
    try {
      const template = await templateService.createTemplate(parsed.data.catalogId, {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        isReferenceData: parsed.data.isReferenceData ?? false,
      });
      sendSuccess(res, template, { status: 201 });
    } catch (err) {
      handleError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/schema/templates/:id — viewer
// ---------------------------------------------------------------------------

router.get(
  "/:id",
  requireCatalogRole("viewer", (req) => templateService.getCatalogIdForTemplate(req.params.id)),
  async (req, res): Promise<void> => {
    try {
      const template = await templateService.getTemplate(req.params.id);
      sendSuccess(res, template);
    } catch (err) {
      handleError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/schema/templates/:id — designer
// ---------------------------------------------------------------------------

router.patch(
  "/:id",
  requireCatalogRole("designer", (req) => templateService.getCatalogIdForTemplate(req.params.id)),
  async (req, res): Promise<void> => {
    const { id } = req.params;
    const parsed = UpdateTemplateBody.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 422, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Validation failed");
      return;
    }
    try {
      const template = await templateService.updateTemplate(id, parsed.data);
      sendSuccess(res, template);
    } catch (err) {
      handleError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/schema/templates/:id — designer
// ---------------------------------------------------------------------------

router.delete(
  "/:id",
  requireCatalogRole("designer", (req) => templateService.getCatalogIdForTemplate(req.params.id)),
  async (req, res): Promise<void> => {
    const { id } = req.params;
    try {
      await templateService.deleteTemplate(id);
      sendSuccess(res, { deleted: true });
    } catch (err) {
      handleError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/schema/templates/:id/sections — viewer
// ---------------------------------------------------------------------------

router.get(
  "/:id/sections",
  requireCatalogRole("viewer", (req) => templateService.getCatalogIdForTemplate(req.params.id)),
  async (req, res): Promise<void> => {
    try {
      const sections = await templateService.listSections(req.params.id);
      sendSuccess(res, sections);
    } catch (err) {
      handleError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/schema/templates/:id/sections — designer
// ---------------------------------------------------------------------------

const CreateSectionBody = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).nullish(),
  displayOrder: z.number().int().min(0).optional(),
});

router.post(
  "/:id/sections",
  requireCatalogRole("designer", (req) => templateService.getCatalogIdForTemplate(req.params.id)),
  async (req, res): Promise<void> => {
    const parsed = CreateSectionBody.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 422, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Validation failed");
      return;
    }
    try {
      const section = await templateService.createSection(req.params.id, {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        displayOrder: parsed.data.displayOrder,
      });
      sendSuccess(res, section, { status: 201 });
    } catch (err) {
      handleError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/schema/templates/:id/sections/reorder — designer
// ---------------------------------------------------------------------------

router.post(
  "/:id/sections/reorder",
  requireCatalogRole("designer", (req) => templateService.getCatalogIdForTemplate(req.params.id)),
  async (req, res): Promise<void> => {
    const body = z.object({ orderedIds: z.array(z.string().uuid()) }).safeParse(req.body);
    if (!body.success) {
      sendError(res, 422, "VALIDATION_ERROR", "orderedIds must be an array of UUIDs");
      return;
    }
    try {
      await templateService.reorderSections(req.params.id, body.data.orderedIds);
      sendSuccess(res, { reordered: true });
    } catch (err) {
      handleError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/schema/templates/:id/relationships — viewer
// ---------------------------------------------------------------------------

router.get(
  "/:id/relationships",
  requireCatalogRole("viewer", (req) => templateService.getCatalogIdForTemplate(req.params.id)),
  async (req, res): Promise<void> => {
    try {
      sendSuccess(res, await templateService.listRelationships(req.params.id));
    } catch (err) {
      handleError(res, err);
    }
  },
);

export default router;
