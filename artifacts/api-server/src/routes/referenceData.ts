import { Router, type IRouter } from "express";
import { z } from "zod";
import * as referenceDataService from "../services/referenceDataService";
import { ServiceError } from "../lib/errors";
import { sendSuccess, sendError } from "../lib/response";

const router: IRouter = Router();

function handleError(res: Parameters<typeof sendError>[0], err: unknown): void {
  if (err instanceof ServiceError) {
    const statusMap: Record<string, number> = {
      NOT_FOUND: 404,
      CONFLICT: 409,
      VALIDATION_ERROR: 422,
      REFERENCE_DATA_IN_USE: 409,
    };
    const status = statusMap[err.code] ?? 500;
    sendError(res, status, err.code as Parameters<typeof sendError>[2], err.message);
  } else {
    sendError(res, 500, "INTERNAL_ERROR", "An unexpected error occurred");
  }
}

// ---------------------------------------------------------------------------
// Dataset routes
// ---------------------------------------------------------------------------

router.get("/", async (_req, res): Promise<void> => {
  try {
    sendSuccess(res, await referenceDataService.listDatasets());
  } catch (err) {
    handleError(res, err);
  }
});

const CreateDatasetBody = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).nullish(),
});

router.post("/", async (req, res): Promise<void> => {
  const parsed = CreateDatasetBody.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 422, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Validation failed");
    return;
  }
  try {
    const dataset = await referenceDataService.createDataset({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    });
    sendSuccess(res, dataset, { status: 201 });
  } catch (err) {
    handleError(res, err);
  }
});

router.get("/:id", async (req, res): Promise<void> => {
  try {
    sendSuccess(res, await referenceDataService.getDataset(req.params.id));
  } catch (err) {
    handleError(res, err);
  }
});

const UpdateDatasetBody = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullish().optional(),
});

router.patch("/:id", async (req, res): Promise<void> => {
  const parsed = UpdateDatasetBody.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 422, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Validation failed");
    return;
  }
  try {
    sendSuccess(res, await referenceDataService.updateDataset(req.params.id, parsed.data));
  } catch (err) {
    handleError(res, err);
  }
});

router.delete("/:id", async (req, res): Promise<void> => {
  try {
    await referenceDataService.deleteDataset(req.params.id);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Value routes — order matters: reorder must come before /:id/values/:valueId
// ---------------------------------------------------------------------------

router.get("/:id/values", async (req, res): Promise<void> => {
  try {
    sendSuccess(res, await referenceDataService.listValues(req.params.id));
  } catch (err) {
    handleError(res, err);
  }
});

router.post("/:id/values/reorder", async (req, res): Promise<void> => {
  const body = z.object({ orderedIds: z.array(z.string().uuid()) }).safeParse(req.body);
  if (!body.success) {
    sendError(res, 422, "VALIDATION_ERROR", "orderedIds must be an array of UUIDs");
    return;
  }
  try {
    await referenceDataService.reorderValues(req.params.id, body.data.orderedIds);
    sendSuccess(res, { reordered: true });
  } catch (err) {
    handleError(res, err);
  }
});

const CreateValueBody = z.object({
  label: z.string().min(1, "Label is required").max(200),
  value: z.string().max(200).optional(),
  displayOrder: z.number().int().min(0).optional(),
});

router.post("/:id/values", async (req, res): Promise<void> => {
  const parsed = CreateValueBody.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 422, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Validation failed");
    return;
  }
  try {
    const value = await referenceDataService.createValue(req.params.id, parsed.data);
    sendSuccess(res, value, { status: 201 });
  } catch (err) {
    handleError(res, err);
  }
});

const UpdateValueBody = z.object({
  label: z.string().min(1).max(200).optional(),
  value: z.string().max(200).optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

router.patch("/:datasetId/values/:valueId", async (req, res): Promise<void> => {
  const parsed = UpdateValueBody.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 422, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Validation failed");
    return;
  }
  try {
    sendSuccess(res, await referenceDataService.updateValue(req.params.valueId, parsed.data));
  } catch (err) {
    handleError(res, err);
  }
});

router.delete("/:datasetId/values/:valueId", async (req, res): Promise<void> => {
  try {
    await referenceDataService.deleteValue(req.params.valueId);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
