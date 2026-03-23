import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import * as authService from "../services/authService";
import { ServiceError } from "../lib/errors";
import { sendSuccess, sendError } from "../lib/response";
import { verifyAccessToken } from "../utils/jwt";

const router: IRouter = Router();

const REFRESH_COOKIE_NAME = "refresh_token";
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "strict",
    maxAge: REFRESH_COOKIE_MAX_AGE,
    path: "/",
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "strict",
    path: "/",
  });
}

type SendErrorCode = Parameters<typeof sendError>[2];

function handleAuthError(res: Response, err: unknown): void {
  if (err instanceof ServiceError) {
    switch (err.code) {
      case "CONFLICT":
        sendError(res, 409, "CONFLICT" as SendErrorCode, err.message);
        return;
      case "AUTH_INVALID_CREDENTIALS":
        sendError(res, 401, "UNAUTHORIZED" as SendErrorCode, err.message, {
          details: { code: "AUTH_INVALID_CREDENTIALS" },
        });
        return;
      case "AUTH_RATE_LIMITED":
        sendError(res, 429, "UNAUTHORIZED" as SendErrorCode, err.message, {
          details: { code: "AUTH_RATE_LIMITED" },
        });
        return;
      case "AUTH_REFRESH_INVALID":
        sendError(res, 401, "UNAUTHORIZED" as SendErrorCode, err.message, {
          details: { code: "AUTH_REFRESH_INVALID" },
        });
        return;
      case "AUTH_ACCOUNT_INACTIVE":
        sendError(res, 403, "FORBIDDEN" as SendErrorCode, err.message, {
          details: { code: "AUTH_ACCOUNT_INACTIVE" },
        });
        return;
      case "VALIDATION_ERROR":
        sendError(res, 422, "VALIDATION_ERROR" as SendErrorCode, err.message);
        return;
      case "NOT_FOUND":
        sendError(res, 404, "NOT_FOUND" as SendErrorCode, err.message);
        return;
      default:
        sendError(res, 400, "BAD_REQUEST" as SendErrorCode, err.message);
        return;
    }
  }
  sendError(res, 500, "INTERNAL_ERROR" as SendErrorCode, "An unexpected error occurred");
}

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

const RegisterBody = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
});

router.post("/register", async (req: Request, res: Response) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    return sendError(
      res,
      422,
      "VALIDATION_ERROR" as SendErrorCode,
      parsed.error.errors[0]?.message ?? "Validation failed",
    );
  }

  try {
    const { email, password, confirmPassword } = parsed.data;
    const result = await authService.register(email, password, confirmPassword);
    setRefreshCookie(res, result.rawRefreshToken);
    sendSuccess(res, { user: result.user, accessToken: result.accessToken }, { status: 201 });
  } catch (err) {
    handleAuthError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

const LoginBody = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

router.post("/login", async (req: Request, res: Response) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    return sendError(
      res,
      422,
      "VALIDATION_ERROR" as SendErrorCode,
      parsed.error.errors[0]?.message ?? "Validation failed",
    );
  }

  try {
    const { email, password } = parsed.data;
    const result = await authService.login(email, password);
    setRefreshCookie(res, result.rawRefreshToken);
    sendSuccess(res, { user: result.user, accessToken: result.accessToken });
  } catch (err) {
    handleAuthError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/refresh
// ---------------------------------------------------------------------------

router.post("/refresh", async (req: Request, res: Response) => {
  const rawToken: string | undefined = req.cookies?.[REFRESH_COOKIE_NAME];

  if (!rawToken) {
    return sendError(res, 401, "UNAUTHORIZED" as SendErrorCode, "No refresh token provided", {
      details: { code: "AUTH_REFRESH_INVALID" },
    });
  }

  try {
    const result = await authService.refresh(rawToken);
    setRefreshCookie(res, result.rawRefreshToken);
    sendSuccess(res, { user: result.user, accessToken: result.accessToken });
  } catch (err) {
    clearRefreshCookie(res);
    handleAuthError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------

router.post("/logout", async (req: Request, res: Response) => {
  const rawToken: string | undefined = req.cookies?.[REFRESH_COOKIE_NAME];

  if (rawToken) {
    try {
      await authService.logout(rawToken);
    } catch {
      // Silent — clear cookie regardless
    }
  }

  clearRefreshCookie(res);
  sendSuccess(res, { ok: true });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------

router.get("/me", async (req: Request, res: Response) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    return sendError(res, 401, "UNAUTHORIZED" as SendErrorCode, "Authentication required", {
      details: { code: "AUTH_TOKEN_INVALID" },
    });
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    const user = await authService.getUserById(payload.sub);
    sendSuccess(res, user);
  } catch (err) {
    if (err instanceof ServiceError) {
      handleAuthError(res, err);
      return;
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
});

export default router;
