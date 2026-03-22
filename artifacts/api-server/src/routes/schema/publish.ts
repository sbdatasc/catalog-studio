import { Router } from "express";
import { z } from "zod";
import {
  getPublishChecklist,
  publishSchema,
  getCurrentPublishedSchema,
  getVersionHistory,
  getVersionDiff,
} from "../../services/templateService";
import { ServiceError } from "../../lib/errors";
import { logger } from "../../lib/logger";

const router = Router();

// GET /api/schema/publish/checklist?catalogId=<uuid>
router.get("/checklist", async (req, res, next) => {
  try {
    const catalogId = req.query["catalogId"] as string | undefined;
    if (!catalogId) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "catalogId query param required" } });
    }
    const result = await getPublishChecklist(catalogId);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/schema/publish/current?catalogId=<uuid>
router.get("/current", async (req, res, next) => {
  try {
    const catalogId = req.query["catalogId"] as string | undefined;
    if (!catalogId) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "catalogId query param required" } });
    }
    const version = await getCurrentPublishedSchema(catalogId);
    res.json({ data: version });
  } catch (err) {
    next(err);
  }
});

// GET /api/schema/publish/history?catalogId=<uuid>
router.get("/history", async (req, res, next) => {
  try {
    const catalogId = req.query["catalogId"] as string | undefined;
    if (!catalogId) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "catalogId query param required" } });
    }
    const versions = await getVersionHistory(catalogId);
    res.json({ data: versions });
  } catch (err) {
    next(err);
  }
});

// GET /api/schema/publish/diff/:versionId
router.get("/diff/:versionId", async (req, res, next) => {
  try {
    const { versionId } = req.params;
    const diff = await getVersionDiff(versionId);
    res.json({ data: diff });
  } catch (err) {
    next(err);
  }
});

// POST /api/schema/publish
const PublishBodySchema = z.object({
  catalogId: z.string().uuid(),
});

router.post("/", async (req, res, next) => {
  try {
    const body = PublishBodySchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "catalogId (UUID) is required" },
      });
    }
    const version = await publishSchema(body.data.catalogId);
    logger.info({ versionId: version.id, catalogId: body.data.catalogId, versionNumber: version.versionNumber }, "Schema published");
    res.status(201).json({ data: version });
  } catch (err) {
    if (err instanceof ServiceError && err.code === "SCHEMA_INVALID") {
      return res.status(422).json({ error: { code: err.code, message: err.message } });
    }
    next(err);
  }
});

export default router;
