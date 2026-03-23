import { Router, type IRouter } from "express";
import { z } from "zod";
import * as catalogService from "../services/catalogService";
import { ServiceError } from "../lib/errors";
import { sendSuccess, sendError } from "../lib/response";
import { requireCatalogRole } from "../middleware/requireCatalogRole";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const CreateCatalogBody = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or fewer"),
  description: z.string().max(500, "Description must be 500 characters or fewer").nullish(),
});

const UpdateCatalogBody = z.object({
  name: z.string().min(1, "Name must not be empty").max(100).optional(),
  description: z.string().max(500).nullish().optional(),
});

const TransitionStatusBody = z.object({
  status: z.enum(["pilot", "published", "discontinued"], {
    errorMap: () => ({ message: "status must be one of: pilot, published, discontinued" }),
  }),
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
// GET /api/catalogs — filtered to user's accessible catalogs
// ---------------------------------------------------------------------------

router.get("/", async (req, res): Promise<void> => {
  try {
    const catalogs = await catalogService.listCatalogs(req.user!.id);
    sendSuccess(res, catalogs);
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/catalogs — any authenticated user can create; creator becomes catalog_admin
// ---------------------------------------------------------------------------

router.post("/", async (req, res): Promise<void> => {
  const parsed = CreateCatalogBody.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 422, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Validation failed");
    return;
  }
  try {
    const catalog = await catalogService.createCatalog({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      creatorUserId: req.user!.id,
    });
    sendSuccess(res, catalog, { status: 201 });
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/catalogs/:id — viewer
// ---------------------------------------------------------------------------

router.get(
  "/:id",
  requireCatalogRole("viewer", (req) => req.params.id),
  async (req, res): Promise<void> => {
    try {
      const catalog = await catalogService.getCatalog(req.params.id);
      sendSuccess(res, catalog);
    } catch (err) {
      handleError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/catalogs/:id — catalog_admin
// ---------------------------------------------------------------------------

router.patch(
  "/:id",
  requireCatalogRole("catalog_admin", (req) => req.params.id),
  async (req, res): Promise<void> => {
    const parsed = UpdateCatalogBody.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 422, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Validation failed");
      return;
    }
    try {
      const catalog = await catalogService.updateCatalog(req.params.id, parsed.data);
      sendSuccess(res, catalog);
    } catch (err) {
      handleError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/catalogs/:id/transition — catalog_admin
// ---------------------------------------------------------------------------

router.post(
  "/:id/transition",
  requireCatalogRole("catalog_admin", (req) => req.params.id),
  async (req, res): Promise<void> => {
    const parsed = TransitionStatusBody.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 422, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Validation failed");
      return;
    }
    try {
      const catalog = await catalogService.transitionStatus(req.params.id, parsed.data.status);
      sendSuccess(res, catalog);
    } catch (err) {
      handleError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/catalogs/:id/duplicate — catalog_admin; current user becomes creator
// ---------------------------------------------------------------------------

router.post(
  "/:id/duplicate",
  requireCatalogRole("catalog_admin", (req) => req.params.id),
  async (req, res): Promise<void> => {
    try {
      const catalog = await catalogService.duplicateCatalog(req.params.id, req.user!.id);
      sendSuccess(res, catalog, { status: 201 });
    } catch (err) {
      handleError(res, err);
    }
  },
);

export default router;
