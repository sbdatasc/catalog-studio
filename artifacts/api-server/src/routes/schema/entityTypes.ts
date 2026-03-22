import { Router, type IRouter } from "express";
import { z } from "zod";
import * as schemaService from "../../services/schemaService";
import { ServiceError } from "../../lib/errors";
import { sendSuccess, sendError } from "../../lib/response";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const CreateEntityTypeBody = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or fewer"),
  description: z.string().max(500, "Description must be 500 characters or fewer").nullish(),
});

const UpdateEntityTypeBody = z.object({
  name: z.string().min(1, "Name must not be empty").max(100, "Name must be 100 characters or fewer").optional(),
  description: z.string().max(500, "Description must be 500 characters or fewer").nullish().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function handleServiceError(
  res: Parameters<typeof sendError>[0],
  err: unknown,
): void {
  if (err instanceof ServiceError) {
    const statusMap: Record<string, number> = {
      NOT_FOUND: 404,
      CONFLICT: 409,
      VALIDATION_ERROR: 422,
      UNPROCESSABLE: 422,
      ENTITY_TYPE_IN_USE: 409,
      BAD_REQUEST: 400,
    };
    const status = statusMap[err.code] ?? 500;
    sendError(res, status, err.code as Parameters<typeof sendError>[2], err.message);
  } else {
    sendError(res, 500, "INTERNAL_ERROR", "An unexpected error occurred");
  }
}

// ---------------------------------------------------------------------------
// GET /api/schema/entity-types
// ---------------------------------------------------------------------------

router.get("/", async (_req, res): Promise<void> => {
  try {
    const entityTypes = await schemaService.listEntityTypes();
    sendSuccess(res, entityTypes);
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/schema/entity-types
// ---------------------------------------------------------------------------

router.post("/", async (req, res): Promise<void> => {
  const parsed = CreateEntityTypeBody.safeParse(req.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    sendError(res, 422, "VALIDATION_ERROR", firstIssue?.message ?? "Validation failed");
    return;
  }

  try {
    const entityType = await schemaService.createEntityType({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    });
    sendSuccess(res, entityType, { status: 201 });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/schema/entity-types/:id
// ---------------------------------------------------------------------------

router.patch("/:id", async (req, res): Promise<void> => {
  const { id } = req.params;

  const parsed = UpdateEntityTypeBody.safeParse(req.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    sendError(res, 422, "VALIDATION_ERROR", firstIssue?.message ?? "Validation failed");
    return;
  }

  try {
    const entityType = await schemaService.updateEntityType(id, {
      name: parsed.data.name,
      description: parsed.data.description,
    });
    sendSuccess(res, entityType);
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/schema/entity-types/:id
// ---------------------------------------------------------------------------

router.delete("/:id", async (req, res): Promise<void> => {
  const { id } = req.params;

  try {
    await schemaService.deleteEntityType(id);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    handleServiceError(res, err);
  }
});

export default router;
