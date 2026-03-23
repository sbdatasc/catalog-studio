import { useMyRole } from "./useMyRole";

const ROLE_ORDER = ["viewer", "steward", "designer", "catalog_admin"] as const;

function meetsMinRole(
  userRole: string | null,
  minRole: (typeof ROLE_ORDER)[number],
): boolean {
  if (userRole === "platform_admin") return true;
  if (!userRole || userRole === "api_consumer") return false;
  return ROLE_ORDER.indexOf(userRole as never) >= ROLE_ORDER.indexOf(minRole);
}

export function usePermissions(catalogId: string) {
  const role = useMyRole(catalogId);
  return {
    role,
    canViewDesigner: meetsMinRole(role, "viewer"),
    canEditSchema: meetsMinRole(role, "designer"),
    canPublishSchema: meetsMinRole(role, "designer"),
    canManageCatalog: meetsMinRole(role, "catalog_admin"),
    canManageMembers: meetsMinRole(role, "catalog_admin"),
    canViewEntries: meetsMinRole(role, "viewer"),
    canCreateEntries: meetsMinRole(role, "steward"),
    canEditEntries: meetsMinRole(role, "steward"),
    canDeleteEntries: meetsMinRole(role, "steward"),
    canLinkEntries: meetsMinRole(role, "steward"),
    canUseGraphQL: role !== null,
    canMutateGraphQL:
      meetsMinRole(role, "steward") || role === "api_consumer",
    isPlatformAdmin: role === "platform_admin",
    isCatalogAdmin: meetsMinRole(role, "catalog_admin"),
  };
}
