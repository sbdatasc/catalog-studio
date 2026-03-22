import { Router, type IRouter } from "express";
import { z } from "zod";
import * as templateService from "../../services/templateService";
import { ServiceError } from "../../lib/errors";
import { sendSuccess, sendError } from "../../lib/response";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const CreateTemplateBody = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or fewer"),
  description: z.string().max(500, "Description must be 500 characters or fewer").nullish(),
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
      BAD_REQUEST: 400,
    };
    const status = statusMap[err.code] ?? 500;
    sendError(res, status, err.code as Parameters<typeof sendError>[2], err.message);
  } else {
    sendError(res, 500, "INTERNAL_ERROR", "An unexpected error occurred");
  }
}

// ---------------------------------------------------------------------------
// GET /api/schema/templates
// ---------------------------------------------------------------------------

router.get("/", async (_req, res): Promise<void> => {
  try {
    const templates = await templateService.listTemplates();
    sendSuccess(res, templates);
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/schema/templates
// ---------------------------------------------------------------------------

router.post("/", async (req, res): Promise<void> => {
  const parsed = CreateTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 422, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Validation failed");
    return;
  }
  try {
    const template = await templateService.createTemplate({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    });
    sendSuccess(res, template, { status: 201 });
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/schema/templates/:id
// ---------------------------------------------------------------------------

router.patch("/:id", async (req, res): Promise<void> => {
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
});

// ---------------------------------------------------------------------------
// DELETE /api/schema/templates/:id
// ---------------------------------------------------------------------------

router.delete("/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  try {
    await templateService.deleteTemplate(id);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/schema/templates/:id/sections
// ---------------------------------------------------------------------------

router.get("/:id/sections", async (req, res): Promise<void> => {
  try {
    const sections = await templateService.listSections(req.params.id);
    sendSuccess(res, sections);
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/schema/templates/:id/sections
// ---------------------------------------------------------------------------

const CreateSectionBody = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).nullish(),
  displayOrder: z.number().int().min(0).optional(),
});

router.post("/:id/sections", async (req, res): Promise<void> => {
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
});

// ---------------------------------------------------------------------------
// PUT /api/schema/templates/:id/sections/reorder
// ---------------------------------------------------------------------------

router.put("/:id/sections/reorder", async (req, res): Promise<void> => {
  const body = z.object({ ids: z.array(z.string().uuid()) }).safeParse(req.body);
  if (!body.success) {
    sendError(res, 422, "VALIDATION_ERROR", "ids must be an array of UUIDs");
    return;
  }
  try {
    await templateService.reorderSections(req.params.id, body.data.ids);
    sendSuccess(res, { reordered: true });
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/schema/publish  (mounted on the router as /publish)
// ---------------------------------------------------------------------------

router.post("/publish", async (_req, res): Promise<void> => {
  try {
    const version = await templateService.publishSchema();
    sendSuccess(res, version, { status: 201 });
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/schema/current-version
// ---------------------------------------------------------------------------

router.get("/current-version", async (_req, res): Promise<void> => {
  try {
    const version = await templateService.getCurrentPublishedSchema();
    if (!version) {
      sendError(res, 404, "NOT_FOUND", "No published schema version found");
      return;
    }
    sendSuccess(res, version);
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Relationship routes
// ---------------------------------------------------------------------------

const CreateRelationshipBody = z.object({
  fromTemplateId: z.string().uuid("fromTemplateId must be a UUID"),
  toTemplateId: z.string().uuid("toTemplateId must be a UUID"),
  label: z.string().min(1, "Label is required").max(100),
  cardinality: z.enum(["1:1", "1:N", "M:N"], {
    errorMap: () => ({ message: "cardinality must be 1:1, 1:N, or M:N" }),
  }),
  direction: z.enum(["from", "to", "both"]).optional(),
});

router.get("/relationships", async (_req, res): Promise<void> => {
  try {
    sendSuccess(res, await templateService.listRelationships());
  } catch (err) {
    handleError(res, err);
  }
});

router.get("/:id/relationships", async (req, res): Promise<void> => {
  try {
    sendSuccess(res, await templateService.listRelationships(req.params.id));
  } catch (err) {
    handleError(res, err);
  }
});

router.post("/relationships", async (req, res): Promise<void> => {
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
});

router.delete("/relationships/:id", async (req, res): Promise<void> => {
  try {
    await templateService.deleteRelationship(req.params.id);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
