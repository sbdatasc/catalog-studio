import { Router } from "express";
import { z } from "zod";
import {
  getPublishChecklist,
  publishSchema,
  getCurrentPublishedSchema,
  getVersionHistory,
  getVersionDiff,
  getCatalogIdForSchemaVersion,
} from "../../services/templateService";
import { ServiceError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { requireCatalogRole } from "../../middleware/requireCatalogRole";

const router = Router();

// GET /api/schema/publish/checklist?catalogId=<uuid> — designer
router.get(
  "/checklist",
  requireCatalogRole("designer", (req) => {
    const catalogId = req.query["catalogId"] as string | undefined;
    if (!catalogId) throw new ServiceError("NOT_FOUND", "catalogId query param required");
    return catalogId;
  }),
  async (req, res, next) => {
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
  },
);

// GET /api/schema/publish/current?catalogId=<uuid> — viewer
router.get(
  "/current",
  requireCatalogRole("viewer", (req) => {
    const catalogId = req.query["catalogId"] as string | undefined;
    if (!catalogId) throw new ServiceError("NOT_FOUND", "catalogId query param required");
    return catalogId;
  }),
  async (req, res, next) => {
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
  },
);

// GET /api/schema/publish/history?catalogId=<uuid> — viewer
router.get(
  "/history",
  requireCatalogRole("viewer", (req) => {
    const catalogId = req.query["catalogId"] as string | undefined;
    if (!catalogId) throw new ServiceError("NOT_FOUND", "catalogId query param required");
    return catalogId;
  }),
  async (req, res, next) => {
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
  },
);

// GET /api/schema/publish/diff/:versionId — viewer (resolves catalogId via versionId)
router.get(
  "/diff/:versionId",
  requireCatalogRole("viewer", (req) => getCatalogIdForSchemaVersion(req.params.versionId)),
  async (req, res, next) => {
    try {
      const { versionId } = req.params;
      const diff = await getVersionDiff(versionId);
      res.json({ data: diff });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/schema/publish — designer
const PublishBodySchema = z.object({
  catalogId: z.string().uuid(),
});

router.post(
  "/",
  requireCatalogRole("designer", (req) => {
    const body = PublishBodySchema.safeParse(req.body);
    if (!body.success) throw new ServiceError("NOT_FOUND", "catalogId (UUID) is required");
    return body.data.catalogId;
  }),
  async (req, res, next) => {
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
  },
);

export default router;
