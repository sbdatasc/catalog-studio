import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import * as adminService from "../../services/adminService";
import { ServiceError } from "../../lib/errors";
import { sendSuccess, sendError } from "../../lib/response";

const router: IRouter = Router();

type SendErrorCode = Parameters<typeof sendError>[2];

function handleAdminError(res: Response, err: unknown): void {
  if (err instanceof ServiceError) {
    switch (err.code) {
      case "FORBIDDEN":
        sendError(res, 403, "FORBIDDEN" as SendErrorCode, err.message);
        return;
      case "NOT_FOUND":
        sendError(res, 404, "NOT_FOUND" as SendErrorCode, err.message);
        return;
      case "VALIDATION_ERROR":
        sendError(res, 422, "VALIDATION_ERROR" as SendErrorCode, err.message);
        return;
      default:
        sendError(res, 500, "INTERNAL_ERROR" as SendErrorCode, err.message);
        return;
    }
  }
  sendError(res, 500, "INTERNAL_ERROR" as SendErrorCode, "An unexpected error occurred");
}

// ---------------------------------------------------------------------------
// GET /api/admin/users
// ---------------------------------------------------------------------------

const ListUsersQuery = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

router.get("/", async (req: Request, res: Response) => {
  const parsed = ListUsersQuery.safeParse(req.query);
  if (!parsed.success) {
    return sendError(
      res,
      422,
      "VALIDATION_ERROR" as SendErrorCode,
      parsed.error.errors[0]?.message ?? "Invalid query parameters",
    );
  }

  try {
    const result = await adminService.listUsers(parsed.data, req.user!.id);
    sendSuccess(res, result);
  } catch (err) {
    handleAdminError(res, err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:id/status
// ---------------------------------------------------------------------------

const SetStatusBody = z.object({
  isActive: z.boolean(),
});

router.patch("/:id/status", async (req: Request, res: Response) => {
  const parsed = SetStatusBody.safeParse(req.body);
  if (!parsed.success) {
    return sendError(
      res,
      422,
      "VALIDATION_ERROR" as SendErrorCode,
      parsed.error.errors[0]?.message ?? "isActive (boolean) is required",
    );
  }

  try {
    const user = await adminService.setUserStatus(
      req.params["id"]!,
      parsed.data.isActive,
      req.user!.id,
    );
    sendSuccess(res, user);
  } catch (err) {
    handleAdminError(res, err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:id/role
// ---------------------------------------------------------------------------

const SetRoleBody = z.object({
  systemRole: z.enum(["user", "platform_admin"]),
});

router.patch("/:id/role", async (req: Request, res: Response) => {
  const parsed = SetRoleBody.safeParse(req.body);
  if (!parsed.success) {
    return sendError(
      res,
      422,
      "VALIDATION_ERROR" as SendErrorCode,
      parsed.error.errors[0]?.message ?? "systemRole must be 'user' or 'platform_admin'",
    );
  }

  try {
    const user = await adminService.setUserRole(
      req.params["id"]!,
      parsed.data.systemRole,
      req.user!.id,
    );
    sendSuccess(res, user);
  } catch (err) {
    handleAdminError(res, err);
  }
});

export default router;
