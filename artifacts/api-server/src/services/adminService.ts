import { eq, ilike, or, and, desc, count, sql } from "drizzle-orm";
import { usersTable, refreshTokensTable } from "@workspace/db";
import { getDb } from "../db/connection";
import { ServiceError } from "../lib/errors";
import type { PublicUser } from "./authService";

export interface AdminUser extends PublicUser {
  isSelf: boolean;
  createdAt: string;
}

export interface ListUsersParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedUsers {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

function toAdminUser(
  row: typeof usersTable.$inferSelect,
  requesterId: string,
): AdminUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    systemRole: row.systemRole as "user" | "platform_admin",
    isActive: row.isActive,
    isSelf: row.id === requesterId,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listUsers(
  params: ListUsersParams,
  requesterId: string,
): Promise<PaginatedUsers> {
  const db = getDb();
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 50));
  const offset = (page - 1) * limit;

  const conditions = [];

  if (params.search && params.search.trim()) {
    const term = `%${params.search.trim()}%`;
    conditions.push(
      or(
        ilike(usersTable.email, term),
        ilike(usersTable.displayName, term),
      ),
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ total: count() })
    .from(usersTable)
    .where(whereClause);

  const total = Number(countRow?.total ?? 0);

  const rows = await db
    .select()
    .from(usersTable)
    .where(whereClause)
    .orderBy(desc(usersTable.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    users: rows.map((row) => toAdminUser(row, requesterId)),
    total,
    page,
    limit,
  };
}

export async function setUserStatus(
  targetId: string,
  isActive: boolean,
  requesterId: string,
): Promise<AdminUser> {
  if (targetId === requesterId) {
    throw new ServiceError("FORBIDDEN", "You cannot change your own account status.");
  }

  const db = getDb();

  const [target] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, targetId))
    .limit(1);

  if (!target) {
    throw new ServiceError("NOT_FOUND", "User not found.");
  }

  // On deactivation: delete all refresh tokens (immediately invalidate sessions)
  if (!isActive) {
    await db
      .delete(refreshTokensTable)
      .where(eq(refreshTokensTable.userId, targetId));
  }

  const [updated] = await db
    .update(usersTable)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(usersTable.id, targetId))
    .returning();

  if (!updated) {
    throw new ServiceError("INTERNAL_ERROR", "Failed to update user status.");
  }

  return toAdminUser(updated, requesterId);
}

export async function setUserRole(
  targetId: string,
  systemRole: "user" | "platform_admin",
  requesterId: string,
): Promise<AdminUser> {
  if (targetId === requesterId) {
    throw new ServiceError("FORBIDDEN", "You cannot change your own role.");
  }

  const db = getDb();

  const [target] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, targetId))
    .limit(1);

  if (!target) {
    throw new ServiceError("NOT_FOUND", "User not found.");
  }

  // Guard: must always have at least one Platform Admin
  if (systemRole === "user" && target.systemRole === "platform_admin") {
    const [adminCountRow] = await db
      .select({ total: count() })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.systemRole, "platform_admin"),
          eq(usersTable.isActive, true),
        ),
      );

    const adminCount = Number(adminCountRow?.total ?? 0);

    if (adminCount <= 1) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Cannot demote — at least one Platform Admin must always exist.",
      );
    }
  }

  const [updated] = await db
    .update(usersTable)
    .set({ systemRole, updatedAt: new Date() })
    .where(eq(usersTable.id, targetId))
    .returning();

  if (!updated) {
    throw new ServiceError("INTERNAL_ERROR", "Failed to update user role.");
  }

  return toAdminUser(updated, requesterId);
}
