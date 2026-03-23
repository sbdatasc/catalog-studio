import crypto from "crypto";
import bcrypt from "bcrypt";
import { eq, and, gt } from "drizzle-orm";
import { usersTable, refreshTokensTable } from "@workspace/db";
import { getDb } from "../db/connection";
import { ServiceError } from "../lib/errors";
import { signAccessToken } from "../utils/jwt";
import { checkRateLimit, clearRateLimit } from "../utils/rateLimiter";
import { logger } from "../lib/logger";

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  systemRole: "user" | "platform_admin";
  isActive: boolean;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  rawRefreshToken: string;
}

function toPublicUser(row: typeof usersTable.$inferSelect): PublicUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    systemRole: row.systemRole as "user" | "platform_admin",
    isActive: row.isActive,
  };
}

function generateRefreshToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

function refreshTokenExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  return d;
}

function issueAccessToken(user: typeof usersTable.$inferSelect): string {
  return signAccessToken({
    sub: user.id,
    email: user.email,
    systemRole: user.systemRole as "user" | "platform_admin",
  });
}

async function createRefreshToken(userId: string): Promise<string> {
  const db = getDb();
  const { raw, hash } = generateRefreshToken();
  await db.insert(refreshTokensTable).values({
    userId,
    tokenHash: hash,
    expiresAt: refreshTokenExpiresAt(),
  });
  return raw;
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export async function register(
  email: string,
  password: string,
  confirmPassword: string,
): Promise<AuthResult> {
  if (password !== confirmPassword) {
    throw new ServiceError("VALIDATION_ERROR", "Passwords do not match");
  }

  if (password.length < 8) {
    throw new ServiceError("VALIDATION_ERROR", "Password must be at least 8 characters");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const db = getDb();

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);

  if (existing) {
    throw new ServiceError("CONFLICT", "An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const displayName = normalizedEmail.split("@")[0] ?? normalizedEmail;

  const [user] = await db
    .insert(usersTable)
    .values({
      email: normalizedEmail,
      passwordHash,
      displayName,
      systemRole: "user",
      isActive: true,
    })
    .returning();

  if (!user) {
    throw new ServiceError("INTERNAL_ERROR", "Failed to create user");
  }

  const accessToken = issueAccessToken(user);
  const rawRefreshToken = await createRefreshToken(user.id);

  return { user: toPublicUser(user), accessToken, rawRefreshToken };
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function login(email: string, password: string): Promise<AuthResult> {
  const normalizedEmail = email.trim().toLowerCase();

  checkRateLimit(normalizedEmail);

  const db = getDb();
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);

  const INVALID_MSG = "Invalid email or password.";

  if (!user) {
    throw new ServiceError("AUTH_INVALID_CREDENTIALS", INVALID_MSG);
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    throw new ServiceError("AUTH_INVALID_CREDENTIALS", INVALID_MSG);
  }

  if (!user.isActive) {
    throw new ServiceError("AUTH_ACCOUNT_INACTIVE", "Your account has been deactivated.");
  }

  clearRateLimit(normalizedEmail);

  const accessToken = issueAccessToken(user);
  const rawRefreshToken = await createRefreshToken(user.id);

  return { user: toPublicUser(user), accessToken, rawRefreshToken };
}

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------

export async function refresh(rawToken: string): Promise<AuthResult> {
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const db = getDb();
  const now = new Date();

  const [tokenRow] = await db
    .select()
    .from(refreshTokensTable)
    .where(
      and(
        eq(refreshTokensTable.tokenHash, tokenHash),
        gt(refreshTokensTable.expiresAt, now),
      ),
    )
    .limit(1);

  if (!tokenRow) {
    throw new ServiceError("AUTH_REFRESH_INVALID", "Refresh token is invalid or expired.");
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, tokenRow.userId))
    .limit(1);

  if (!user || !user.isActive) {
    await db.delete(refreshTokensTable).where(eq(refreshTokensTable.id, tokenRow.id));
    throw new ServiceError("AUTH_ACCOUNT_INACTIVE", "Account is inactive.");
  }

  await db.delete(refreshTokensTable).where(eq(refreshTokensTable.id, tokenRow.id));

  const accessToken = issueAccessToken(user);
  const rawRefreshToken = await createRefreshToken(user.id);

  return { user: toPublicUser(user), accessToken, rawRefreshToken };
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export async function logout(rawToken: string): Promise<void> {
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const db = getDb();
  await db.delete(refreshTokensTable).where(eq(refreshTokensTable.tokenHash, tokenHash));
}

// ---------------------------------------------------------------------------
// Validate token (for GET /api/auth/me)
// ---------------------------------------------------------------------------

export async function getUserById(userId: string): Promise<PublicUser> {
  const db = getDb();
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    throw new ServiceError("NOT_FOUND", "User not found");
  }

  if (!user.isActive) {
    throw new ServiceError("AUTH_ACCOUNT_INACTIVE", "Your account has been deactivated.");
  }

  return toPublicUser(user);
}

// ---------------------------------------------------------------------------
// Platform Admin bootstrap
// ---------------------------------------------------------------------------

export async function bootstrapAdmin(): Promise<void> {
  const adminEmail = process.env["ADMIN_EMAIL"];
  const adminPassword = process.env["ADMIN_PASSWORD"];

  if (!adminEmail || !adminPassword) {
    logger.warn("ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin bootstrap");
    return;
  }

  const db = getDb();
  const normalizedEmail = adminEmail.trim().toLowerCase();

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.systemRole, "platform_admin"))
    .limit(1);

  if (existing) {
    logger.info("Platform Admin already exists — skipping bootstrap");
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);
  const displayName = normalizedEmail.split("@")[0] ?? "Admin";

  await db.insert(usersTable).values({
    email: normalizedEmail,
    passwordHash,
    displayName,
    systemRole: "platform_admin",
    isActive: true,
  });

  logger.info({ email: normalizedEmail }, "Platform Admin bootstrapped");
}
