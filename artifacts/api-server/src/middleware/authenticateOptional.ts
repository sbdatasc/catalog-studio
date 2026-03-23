import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { getUserById } from "../services/authService";

/**
 * Like `authenticate`, but silently skips auth rather than rejecting the request
 * when no Bearer token is provided or the token is invalid/expired.
 * Use on routes that work for both authenticated and anonymous callers,
 * but benefit from knowing who the caller is when a token is present.
 */
export async function authenticateOptional(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    const user = await getUserById(payload.sub);
    req.user = {
      id: user.id,
      email: user.email,
      systemRole: user.systemRole,
    };
  } catch {
    // Invalid or expired token — proceed without setting req.user
  }

  next();
}
