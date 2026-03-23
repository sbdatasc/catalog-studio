import type { Request, Response, NextFunction } from "express";
import * as catalogRoleService from "../services/catalogRoleService";
import { ServiceError } from "../lib/errors";
import { sendError } from "../lib/response";

export type CatalogRoleLevel = "viewer" | "steward" | "designer" | "catalog_admin";

const ROLE_ORDER: CatalogRoleLevel[] = ["viewer", "steward", "designer", "catalog_admin"];

type CatalogIdExtractor = (req: Request) => string | Promise<string>;

export function requireCatalogRole(
  minRole: CatalogRoleLevel,
  getCatalogId: CatalogIdExtractor,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.user!.systemRole === "platform_admin") {
      next();
      return;
    }

    let catalogId: string;
    try {
      catalogId = await getCatalogId(req);
    } catch (err) {
      if (err instanceof ServiceError && err.code === "NOT_FOUND") {
        sendError(res, 404, "NOT_FOUND" as never, err.message);
      } else {
        sendError(res, 500, "INTERNAL_ERROR" as never, "An unexpected error occurred");
      }
      return;
    }

    const userRole = await catalogRoleService.getUserCatalogRole(catalogId, req.user!.id);

    if (!userRole) {
      sendError(res, 403, "FORBIDDEN" as never, "You do not have access to this catalog.");
      return;
    }

    if (userRole === "api_consumer") {
      sendError(res, 403, "FORBIDDEN" as never, "This operation requires a higher role.");
      return;
    }

    const userLevel = ROLE_ORDER.indexOf(userRole as CatalogRoleLevel);
    const minLevel = ROLE_ORDER.indexOf(minRole);

    if (userLevel < minLevel) {
      sendError(res, 403, "FORBIDDEN" as never, "You do not have permission for this operation.");
      return;
    }

    next();
  };
}
