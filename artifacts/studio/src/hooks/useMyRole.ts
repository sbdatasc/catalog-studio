import { useAuthStore } from "@/stores/authStore";
import { useCatalogStore } from "@/stores/catalogStore";
import type { CatalogRole } from "@/lib/apiClient";

/**
 * Returns the effective role for the current user in the given catalog.
 * Platform admins always return 'platform_admin' regardless of catalog membership.
 */
export function useMyRole(catalogId: string): CatalogRole | "platform_admin" | null {
  const user = useAuthStore((s) => s.user);
  const myRoles = useCatalogStore((s) => s.myRoles);

  if (!user) return null;
  if (user.systemRole === "platform_admin") return "platform_admin";
  return myRoles[catalogId] ?? null;
}
