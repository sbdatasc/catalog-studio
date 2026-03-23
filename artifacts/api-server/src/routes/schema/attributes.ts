import { Router, type IRouter } from "express";
import { z } from "zod";
import * as templateService from "../../services/templateService";
import { ServiceError } from "../../lib/errors";
import { sendSuccess, sendError } from "../../lib/response";
import { requireCatalogRole } from "../../middleware/requireCatalogRole";

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
// PATCH /api/schema/attributes/:id — designer
// ---------------------------------------------------------------------------

const UpdateAttributeBody = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullish().optional(),
  required: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
  config: z.record(z.unknown()).nullish(),
});

router.patch(
  "/:id",
  requireCatalogRole("designer", (req) => templateService.getCatalogIdForAttribute(req.params.id)),
  async (req, res): Promise<void> => {
    const parsed = UpdateAttributeBody.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 422, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Validation failed");
      return;
    }
    try {
      const attribute = await templateService.updateAttribute(req.params.id, parsed.data as any);
      sendSuccess(res, attribute);
    } catch (err) {
      handleError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/schema/attributes/:id — designer
// ---------------------------------------------------------------------------

router.delete(
  "/:id",
  requireCatalogRole("designer", (req) => templateService.getCatalogIdForAttribute(req.params.id)),
  async (req, res): Promise<void> => {
    try {
      await templateService.deleteAttribute(req.params.id);
      sendSuccess(res, { deleted: true });
    } catch (err) {
      handleError(res, err);
    }
  },
);

export default router;
