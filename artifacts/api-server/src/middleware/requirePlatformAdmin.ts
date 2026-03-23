import type { Request, Response, NextFunction } from "express";
import { sendError } from "../lib/response";

type SendErrorCode = Parameters<typeof sendError>[2];

export function requirePlatformAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.user?.systemRole !== "platform_admin") {
    sendError(res, 403, "FORBIDDEN" as SendErrorCode, "Platform Admin access required.", {
      details: { code: "FORBIDDEN" },
    });
    return;
  }
  next();
}
