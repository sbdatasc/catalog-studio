import { Router, type IRouter } from "express";
import { z } from "zod";
import * as catalogRoleService from "../services/catalogRoleService";
import { ServiceError } from "../lib/errors";
import { sendSuccess, sendError } from "../lib/response";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const CATALOG_ROLE_VALUES = [
  "catalog_admin",
  "designer",
  "steward",
  "viewer",
  "api_consumer",
] as const;

const CatalogRoleEnum = z.enum(CATALOG_ROLE_VALUES);

const AddMemberBody = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
  catalogRole: CatalogRoleEnum,
});

const ChangeMemberRoleBody = z.object({
  catalogRole: CatalogRoleEnum,
});

const SearchUsersQuery = z.object({
  q: z.string().min(2, "q must be at least 2 characters"),
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

function handleError(res: Parameters<typeof sendError>[0], err: unknown): void {
  if (err instanceof ServiceError) {
    const statusMap: Record<string, number> = {
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      CONFLICT: 409,
      VALIDATION_ERROR: 422,
    };
    const status = statusMap[err.code] ?? 500;
    sendError(res, status, err.code as Parameters<typeof sendError>[2], err.message);
  } else {
    sendError(res, 500, "INTERNAL_ERROR", "An unexpected error occurred");
  }
}

// ---------------------------------------------------------------------------
// GET /api/catalog-roles/my-catalogs
// Must be defined BEFORE /:catalogId routes
// ---------------------------------------------------------------------------

router.get("/my-catalogs", async (req, res): Promise<void> => {
  const userId = req.user!.id;
  try {
    const result = await catalogRoleService.getMyCatalogs(userId);
    sendSuccess(res, result);
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/catalog-roles/:catalogId/members
// ---------------------------------------------------------------------------

router.get("/:catalogId/members", async (req, res): Promise<void> => {
  const userId = req.user!.id;
  try {
    const members = await catalogRoleService.listMembers(req.params.catalogId, userId);
    sendSuccess(res, members);
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/catalog-roles/:catalogId/eligible-users?q=
// Typeahead for AddMemberDrawer — search active users not already assigned
// ---------------------------------------------------------------------------

router.get("/:catalogId/eligible-users", async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const parsed = SearchUsersQuery.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, 400, "BAD_REQUEST" as never, parsed.error.errors[0]?.message ?? "Invalid query");
    return;
  }
  try {
    const users = await catalogRoleService.searchEligibleUsers(
      req.params.catalogId,
      userId,
      parsed.data.q,
    );
    sendSuccess(res, users);
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/catalog-roles/:catalogId/members
// ---------------------------------------------------------------------------

router.post("/:catalogId/members", async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const parsed = AddMemberBody.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, "BAD_REQUEST" as never, parsed.error.errors[0]?.message ?? "Validation failed");
    return;
  }
  try {
    const member = await catalogRoleService.addMember(
      req.params.catalogId,
      parsed.data.userId,
      parsed.data.catalogRole,
      userId,
    );
    sendSuccess(res, member, { status: 201 });
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/catalog-roles/:catalogId/members/:userId
// ---------------------------------------------------------------------------

router.patch("/:catalogId/members/:targetUserId", async (req, res): Promise<void> => {
  const requesterId = req.user!.id;
  const parsed = ChangeMemberRoleBody.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, "BAD_REQUEST" as never, parsed.error.errors[0]?.message ?? "Validation failed");
    return;
  }
  try {
    const member = await catalogRoleService.changeMemberRole(
      req.params.catalogId,
      req.params.targetUserId,
      parsed.data.catalogRole,
      requesterId,
    );
    sendSuccess(res, member);
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/catalog-roles/:catalogId/members/:userId
// ---------------------------------------------------------------------------

router.delete("/:catalogId/members/:targetUserId", async (req, res): Promise<void> => {
  const requesterId = req.user!.id;
  try {
    await catalogRoleService.removeMember(
      req.params.catalogId,
      req.params.targetUserId,
      requesterId,
    );
    sendSuccess(res, { deleted: true });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
