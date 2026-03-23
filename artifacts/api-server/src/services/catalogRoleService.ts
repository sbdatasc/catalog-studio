import { eq, and, ilike, or, ne } from "drizzle-orm";
import {
  catalogRolesTable,
  catalogsTable,
  usersTable,
  type CatalogRole,
} from "@workspace/db";
import { getDb } from "../db/connection";
import { ServiceError } from "../lib/errors";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type { CatalogRole };

export interface CatalogMember {
  userId: string;
  displayName: string;
  email: string;
  catalogRole: CatalogRole;
  assignedBy: string | null;
  assignedAt: string;
  isSelf: boolean;
}

export interface CatalogWithRole {
  catalog: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    templateCount: number;
    createdAt: string;
    updatedAt: string;
  };
  catalogRole: CatalogRole | "platform_admin";
}

export interface EligibleUser {
  id: string;
  displayName: string;
  email: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getRequesterRole(
  catalogId: string,
  requesterId: string,
): Promise<CatalogRole | "platform_admin" | null> {
  return getUserCatalogRole(catalogId, requesterId);
}

function assertCanManageMembers(role: CatalogRole | "platform_admin" | null): void {
  if (role !== "platform_admin" && role !== "catalog_admin") {
    throw new ServiceError("FORBIDDEN", "Only Catalog Admins and Platform Admins can manage members.");
  }
}

async function buildMemberRow(
  row: { userId: string; catalogRole: string; assignedBy: string | null; assignedAt: Date },
  requesterId: string,
  db: ReturnType<typeof getDb>,
): Promise<CatalogMember> {
  const [userRow] = await db
    .select({ displayName: usersTable.displayName, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, row.userId))
    .limit(1);

  let assignedByName: string | null = null;
  if (row.assignedBy) {
    const [assignerRow] = await db
      .select({ displayName: usersTable.displayName })
      .from(usersTable)
      .where(eq(usersTable.id, row.assignedBy))
      .limit(1);
    assignedByName = assignerRow?.displayName ?? null;
  }

  return {
    userId: row.userId,
    displayName: userRow?.displayName ?? row.userId,
    email: userRow?.email ?? "",
    catalogRole: row.catalogRole as CatalogRole,
    assignedBy: assignedByName,
    assignedAt: row.assignedAt.toISOString(),
    isSelf: row.userId === requesterId,
  };
}

// ---------------------------------------------------------------------------
// getUserCatalogRole — primary role resolution
// ---------------------------------------------------------------------------

export async function getUserCatalogRole(
  catalogId: string,
  userId: string,
): Promise<CatalogRole | "platform_admin" | null> {
  const db = getDb();

  // Always resolve platform_admin first
  const [userRow] = await db
    .select({ systemRole: usersTable.systemRole, isActive: usersTable.isActive })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!userRow) return null;
  if (!userRow.isActive) return null;
  if (userRow.systemRole === "platform_admin") return "platform_admin";

  // Check catalog_roles
  const [roleRow] = await db
    .select({ catalogRole: catalogRolesTable.catalogRole })
    .from(catalogRolesTable)
    .where(
      and(
        eq(catalogRolesTable.catalogId, catalogId),
        eq(catalogRolesTable.userId, userId),
      ),
    )
    .limit(1);

  return (roleRow?.catalogRole as CatalogRole) ?? null;
}

// ---------------------------------------------------------------------------
// getMyCatalogs
// ---------------------------------------------------------------------------

export async function getMyCatalogs(userId: string): Promise<CatalogWithRole[]> {
  const db = getDb();

  const [userRow] = await db
    .select({ systemRole: usersTable.systemRole, isActive: usersTable.isActive })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!userRow || !userRow.isActive) return [];

  if (userRow.systemRole === "platform_admin") {
    // Platform Admins see ALL catalogs
    const allCatalogs = await db
      .select()
      .from(catalogsTable)
      .orderBy(catalogsTable.name);

    return allCatalogs.map((c) => ({
      catalog: {
        id: c.id,
        name: c.name,
        description: c.description,
        status: c.status,
        templateCount: 0,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      },
      catalogRole: "platform_admin" as const,
    }));
  }

  // Regular users: join catalog_roles with catalogs
  const rows = await db
    .select({
      catalogId: catalogRolesTable.catalogId,
      catalogRole: catalogRolesTable.catalogRole,
      catalogName: catalogsTable.name,
      catalogDescription: catalogsTable.description,
      catalogStatus: catalogsTable.status,
      catalogCreatedAt: catalogsTable.createdAt,
      catalogUpdatedAt: catalogsTable.updatedAt,
    })
    .from(catalogRolesTable)
    .innerJoin(catalogsTable, eq(catalogRolesTable.catalogId, catalogsTable.id))
    .where(eq(catalogRolesTable.userId, userId))
    .orderBy(catalogsTable.name);

  return rows.map((r) => ({
    catalog: {
      id: r.catalogId,
      name: r.catalogName,
      description: r.catalogDescription,
      status: r.catalogStatus,
      templateCount: 0,
      createdAt: r.catalogCreatedAt.toISOString(),
      updatedAt: r.catalogUpdatedAt.toISOString(),
    },
    catalogRole: r.catalogRole as CatalogRole,
  }));
}

// ---------------------------------------------------------------------------
// listMembers
// ---------------------------------------------------------------------------

export async function listMembers(
  catalogId: string,
  requesterId: string,
): Promise<CatalogMember[]> {
  const db = getDb();

  const requesterRole = await getRequesterRole(catalogId, requesterId);
  assertCanManageMembers(requesterRole);

  const rows = await db
    .select({
      userId: catalogRolesTable.userId,
      catalogRole: catalogRolesTable.catalogRole,
      assignedBy: catalogRolesTable.assignedBy,
      assignedAt: catalogRolesTable.assignedAt,
    })
    .from(catalogRolesTable)
    .where(eq(catalogRolesTable.catalogId, catalogId))
    .orderBy(catalogRolesTable.assignedAt);

  const members: CatalogMember[] = [];
  for (const row of rows) {
    members.push(await buildMemberRow(row, requesterId, db));
  }

  return members;
}

// ---------------------------------------------------------------------------
// searchEligibleUsers — for AddMemberDrawer typeahead
// ---------------------------------------------------------------------------

export async function searchEligibleUsers(
  catalogId: string,
  requesterId: string,
  query: string,
): Promise<EligibleUser[]> {
  const db = getDb();

  const requesterRole = await getRequesterRole(catalogId, requesterId);
  assertCanManageMembers(requesterRole);

  // Get already-assigned user IDs for this catalog
  const assigned = await db
    .select({ userId: catalogRolesTable.userId })
    .from(catalogRolesTable)
    .where(eq(catalogRolesTable.catalogId, catalogId));

  const assignedIds = new Set(assigned.map((r) => r.userId));

  const searchPattern = `%${query}%`;
  const users = await db
    .select({ id: usersTable.id, displayName: usersTable.displayName, email: usersTable.email })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.isActive, true),
        ne(usersTable.id, requesterId),
        or(
          ilike(usersTable.displayName, searchPattern),
          ilike(usersTable.email, searchPattern),
        ),
      ),
    )
    .limit(20);

  return users
    .filter((u) => !assignedIds.has(u.id))
    .map((u) => ({ id: u.id, displayName: u.displayName, email: u.email }));
}

// ---------------------------------------------------------------------------
// addMember
// ---------------------------------------------------------------------------

export async function addMember(
  catalogId: string,
  userId: string,
  role: CatalogRole,
  requesterId: string,
): Promise<CatalogMember> {
  const db = getDb();

  const requesterRole = await getRequesterRole(catalogId, requesterId);
  assertCanManageMembers(requesterRole);

  if (userId === requesterId) {
    throw new ServiceError("FORBIDDEN", "You cannot assign a role to yourself.");
  }

  // Check target user is active
  const [targetUser] = await db
    .select({ isActive: usersTable.isActive })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!targetUser) {
    throw new ServiceError("NOT_FOUND", "User not found.");
  }
  if (!targetUser.isActive) {
    throw new ServiceError("VALIDATION_ERROR", "Cannot assign a role to an inactive user.");
  }

  // Check no existing role
  const [existing] = await db
    .select({ id: catalogRolesTable.id })
    .from(catalogRolesTable)
    .where(
      and(
        eq(catalogRolesTable.catalogId, catalogId),
        eq(catalogRolesTable.userId, userId),
      ),
    )
    .limit(1);

  if (existing) {
    throw new ServiceError("CONFLICT", "This user already has a role on this catalog.");
  }

  const [inserted] = await db
    .insert(catalogRolesTable)
    .values({
      catalogId,
      userId,
      catalogRole: role,
      assignedBy: requesterId,
    })
    .returning();

  return buildMemberRow(
    { userId: inserted.userId, catalogRole: inserted.catalogRole, assignedBy: inserted.assignedBy, assignedAt: inserted.assignedAt },
    requesterId,
    db,
  );
}

// ---------------------------------------------------------------------------
// changeMemberRole
// ---------------------------------------------------------------------------

export async function changeMemberRole(
  catalogId: string,
  userId: string,
  newRole: CatalogRole,
  requesterId: string,
): Promise<CatalogMember> {
  const db = getDb();

  const requesterRole = await getRequesterRole(catalogId, requesterId);
  assertCanManageMembers(requesterRole);

  if (userId === requesterId) {
    throw new ServiceError("FORBIDDEN", "You cannot change your own role.");
  }

  // Last-admin guard: if changing from catalog_admin, ensure another admin remains
  const [targetRow] = await db
    .select({ catalogRole: catalogRolesTable.catalogRole })
    .from(catalogRolesTable)
    .where(
      and(
        eq(catalogRolesTable.catalogId, catalogId),
        eq(catalogRolesTable.userId, userId),
      ),
    )
    .limit(1);

  if (!targetRow) {
    throw new ServiceError("NOT_FOUND", "This user does not have a role on this catalog.");
  }

  if (targetRow.catalogRole === "catalog_admin" && newRole !== "catalog_admin") {
    const adminCount = await db
      .select({ id: catalogRolesTable.id })
      .from(catalogRolesTable)
      .where(
        and(
          eq(catalogRolesTable.catalogId, catalogId),
          eq(catalogRolesTable.catalogRole, "catalog_admin"),
        ),
      );
    if (adminCount.length <= 1) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "At least one Catalog Admin must remain on this catalog.",
      );
    }
  }

  const [updated] = await db
    .update(catalogRolesTable)
    .set({ catalogRole: newRole, assignedBy: requesterId, assignedAt: new Date() })
    .where(
      and(
        eq(catalogRolesTable.catalogId, catalogId),
        eq(catalogRolesTable.userId, userId),
      ),
    )
    .returning();

  return buildMemberRow(
    { userId: updated.userId, catalogRole: updated.catalogRole, assignedBy: updated.assignedBy, assignedAt: updated.assignedAt },
    requesterId,
    db,
  );
}

// ---------------------------------------------------------------------------
// removeMember
// ---------------------------------------------------------------------------

export async function removeMember(
  catalogId: string,
  userId: string,
  requesterId: string,
): Promise<void> {
  const db = getDb();

  const requesterRole = await getRequesterRole(catalogId, requesterId);
  assertCanManageMembers(requesterRole);

  if (userId === requesterId) {
    throw new ServiceError("FORBIDDEN", "You cannot remove yourself from a catalog.");
  }

  // Last-admin guard
  const [targetRow] = await db
    .select({ catalogRole: catalogRolesTable.catalogRole })
    .from(catalogRolesTable)
    .where(
      and(
        eq(catalogRolesTable.catalogId, catalogId),
        eq(catalogRolesTable.userId, userId),
      ),
    )
    .limit(1);

  if (!targetRow) {
    throw new ServiceError("NOT_FOUND", "This user does not have a role on this catalog.");
  }

  if (targetRow.catalogRole === "catalog_admin") {
    const adminCount = await db
      .select({ id: catalogRolesTable.id })
      .from(catalogRolesTable)
      .where(
        and(
          eq(catalogRolesTable.catalogId, catalogId),
          eq(catalogRolesTable.catalogRole, "catalog_admin"),
        ),
      );
    if (adminCount.length <= 1) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "At least one Catalog Admin must remain on this catalog.",
      );
    }
  }

  await db
    .delete(catalogRolesTable)
    .where(
      and(
        eq(catalogRolesTable.catalogId, catalogId),
        eq(catalogRolesTable.userId, userId),
      ),
    );
}
