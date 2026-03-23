import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { ServiceError } from "../lib/errors";
import { sendError } from "../lib/response";
import { getUserById } from "../services/authService";

type SendErrorCode = Parameters<typeof sendError>[2];

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    sendError(res, 401, "UNAUTHORIZED" as SendErrorCode, "Authentication required", {
      details: { code: "AUTH_TOKEN_INVALID" },
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);

    // Check is_active from DB to ensure deactivated users are immediately blocked
    const user = await getUserById(payload.sub);

    req.user = {
      id: user.id,
      email: user.email,
      systemRole: user.systemRole,
    };

    next();
  } catch (err) {
    if (err instanceof ServiceError) {
      if (err.code === "AUTH_ACCOUNT_INACTIVE") {
        sendError(res, 403, "FORBIDDEN" as SendErrorCode, err.message, {
          details: { code: "AUTH_ACCOUNT_INACTIVE" },
        });
        return;
      }
      if (err.code === "NOT_FOUND") {
        sendError(res, 401, "UNAUTHORIZED" as SendErrorCode, "User not found", {
          details: { code: "AUTH_TOKEN_INVALID" },
        });
        return;
      }
    }

    const msg = err instanceof Error ? err.message : "Token invalid";
    if (msg.includes("expired")) {
      sendError(res, 401, "UNAUTHORIZED" as SendErrorCode, "Access token expired", {
        details: { code: "AUTH_TOKEN_EXPIRED" },
      });
    } else {
      sendError(res, 401, "UNAUTHORIZED" as SendErrorCode, "Invalid access token", {
        details: { code: "AUTH_TOKEN_INVALID" },
      });
    }
  }
}
