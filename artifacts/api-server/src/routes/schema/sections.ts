import { Router, type IRouter } from "express";
import { z } from "zod";
import * as templateService from "../../services/templateService";
import { ServiceError } from "../../lib/errors";
import { sendSuccess, sendError } from "../../lib/response";

const router: IRouter = Router();

function handleError(res: Parameters<typeof sendError>[0], err: unknown): void {
  if (err instanceof ServiceError) {
    const statusMap: Record<string, number> = {
      NOT_FOUND: 404,
      CONFLICT: 409,
      VALIDATION_ERROR: 422,
      SECTION_IN_USE: 409,
      CATALOG_LOCKED: 423,
    };
    const status = statusMap[err.code] ?? 500;
    sendError(res, status, err.code as Parameters<typeof sendError>[2], err.message);
  } else {
    sendError(res, 500, "INTERNAL_ERROR", "An unexpected error occurred");
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/schema/sections/:id
// ---------------------------------------------------------------------------

const UpdateSectionBody = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullish().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

router.patch("/:id", async (req, res): Promise<void> => {
  const parsed = UpdateSectionBody.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 422, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Validation failed");
    return;
  }
  try {
    const section = await templateService.updateSection(req.params.id, parsed.data);
    sendSuccess(res, section);
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/schema/sections/:id
// ---------------------------------------------------------------------------

router.delete("/:id", async (req, res): Promise<void> => {
  try {
    await templateService.deleteSection(req.params.id);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/schema/sections/:id/attributes
// ---------------------------------------------------------------------------

router.get("/:id/attributes", async (req, res): Promise<void> => {
  try {
    const attributes = await templateService.listAttributes(req.params.id);
    sendSuccess(res, attributes);
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/schema/sections/:id/attributes
// ---------------------------------------------------------------------------

const CreateAttributeBody = z.object({
  name: z.string().min(1, "Name is required").max(100),
  attributeType: z.string().min(1, "Attribute type is required"),
  description: z.string().max(500).nullish(),
  required: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
  config: z.record(z.unknown()).nullish(),
});

router.post("/:id/attributes", async (req, res): Promise<void> => {
  const parsed = CreateAttributeBody.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 422, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Validation failed");
    return;
  }
  try {
    const attribute = await templateService.createAttribute(req.params.id, {
      name: parsed.data.name,
      attributeType: parsed.data.attributeType as any,
      description: parsed.data.description ?? null,
      required: parsed.data.required,
      displayOrder: parsed.data.displayOrder,
      config: parsed.data.config as any,
    });
    sendSuccess(res, attribute, { status: 201 });
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/schema/sections/:id/attributes/reorder
// ---------------------------------------------------------------------------

router.post("/:id/attributes/reorder", async (req, res): Promise<void> => {
  const body = z.object({ orderedIds: z.array(z.string().uuid()) }).safeParse(req.body);
  if (!body.success) {
    sendError(res, 422, "VALIDATION_ERROR", "orderedIds must be an array of UUIDs");
    return;
  }
  try {
    await templateService.reorderAttributes(req.params.id, body.data.orderedIds);
    sendSuccess(res, { reordered: true });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
