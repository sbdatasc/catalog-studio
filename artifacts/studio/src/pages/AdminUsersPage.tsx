import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import { Search, ChevronLeft, ChevronRight, Loader2, AlertCircle, Shield, User as UserIcon, RefreshCw } from "lucide-react";
import { useAdminStore, type AdminUser } from "@/stores/adminStore";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import { getApiBase } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Database } from "lucide-react";
import { UserMenu } from "@/components/auth/UserMenu";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

async function adminPatch<T>(path: string, body: unknown): Promise<{ data: T | null; error: { message: string } | null }> {
  const accessToken = useAuthStore.getState().accessToken;
  const res = await fetch(`${getApiBase()}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify(body),
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// Badge components
// ---------------------------------------------------------------------------

function RoleBadge({ role }: { role: "user" | "platform_admin" }) {
  if (role === "platform_admin") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
        <Shield className="w-3 h-3" />
        Platform Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
      <UserIcon className="w-3 h-3" />
      User
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
        Active
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
      Inactive
    </span>
  );
}

// ---------------------------------------------------------------------------
// Confirmation Modals
// ---------------------------------------------------------------------------

interface DeactivateModalProps {
  user: AdminUser | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function DeactivateModal({ user, onConfirm, onCancel, isLoading }: DeactivateModalProps) {
  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deactivate {user?.displayName}?</DialogTitle>
          <DialogDescription>
            They will be immediately signed out and cannot log in until reactivated.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Deactivate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PromoteModalProps {
  user: AdminUser | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function PromoteModal({ user, onConfirm, onCancel, isLoading }: PromoteModalProps) {
  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promote {user?.displayName} to Platform Admin?</DialogTitle>
          <DialogDescription>
            They will have full access to all catalogs and user management.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Promote to Admin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DemoteModalProps {
  user: AdminUser | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function DemoteModal({ user, onConfirm, onCancel, isLoading }: DemoteModalProps) {
  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Demote {user?.displayName} to regular user?</DialogTitle>
          <DialogDescription>
            They will lose Platform Admin access immediately.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Demote to User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// UserTableRow
// ---------------------------------------------------------------------------

interface UserTableRowProps {
  user: AdminUser;
  adminCount: number;
  onDeactivate: (u: AdminUser) => void;
  onReactivate: (u: AdminUser) => void;
  onPromote: (u: AdminUser) => void;
  onDemote: (u: AdminUser) => void;
  actionLoading: string | null;
}

function UserTableRow({
  user,
  adminCount,
  onDeactivate,
  onReactivate,
  onPromote,
  onDemote,
  actionLoading,
}: UserTableRowProps) {
  const isLastAdmin = user.systemRole === "platform_admin" && adminCount <= 1;
  const busy = actionLoading === user.id;

  return (
    <tr
      className={cn(
        "border-b border-border transition-colors",
        user.isSelf && "bg-primary/5",
      )}
      data-testid={`user-row-${user.id}`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
            {user.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="text-sm font-medium text-foreground">{user.displayName}</span>
            {user.isSelf && (
              <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{user.email}</td>
      <td className="px-4 py-3">
        <RoleBadge role={user.systemRole} />
      </td>
      <td className="px-4 py-3">
        <StatusBadge isActive={user.isActive} />
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
        {formatDate(user.createdAt)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          {!user.isSelf && (
            <>
              {user.isActive ? (
                <button
                  onClick={() => onDeactivate(user)}
                  disabled={busy}
                  className="text-xs px-2.5 py-1 rounded border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 text-muted-foreground transition-colors disabled:opacity-50"
                  data-testid={`deactivate-${user.id}`}
                >
                  Deactivate
                </button>
              ) : (
                <button
                  onClick={() => onReactivate(user)}
                  disabled={busy}
                  className="text-xs px-2.5 py-1 rounded border border-border hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-muted-foreground transition-colors disabled:opacity-50"
                  data-testid={`reactivate-${user.id}`}
                >
                  Reactivate
                </button>
              )}

              {user.isActive && user.systemRole === "user" && (
                <button
                  onClick={() => onPromote(user)}
                  disabled={busy}
                  className="text-xs px-2.5 py-1 rounded border border-border hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 text-muted-foreground transition-colors disabled:opacity-50"
                  data-testid={`promote-${user.id}`}
                >
                  Make Admin
                </button>
              )}

              {user.systemRole === "platform_admin" && (
                <button
                  onClick={() => !isLastAdmin && onDemote(user)}
                  disabled={busy || isLastAdmin}
                  title={isLastAdmin ? "Cannot demote — at least one Platform Admin must always exist." : undefined}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded border border-border text-muted-foreground transition-colors",
                    isLastAdmin
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 disabled:opacity-50",
                  )}
                  data-testid={`demote-${user.id}`}
                >
                  Demote
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// AdminUsersPage
// ---------------------------------------------------------------------------

export function AdminUsersPage() {
  const { users, usersLoading, usersError, pagination, fetchUsers, updateUser } = useAdminStore();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [deactivateTarget, setDeactivateTarget] = useState<AdminUser | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<AdminUser | null>(null);
  const [demoteTarget, setDemoteTarget] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(
    (page: number, s: string) => {
      fetchUsers({ search: s, page, limit: pagination.limit });
    },
    [fetchUsers, pagination.limit],
  );

  // Initial load
  useEffect(() => {
    load(1, "");
  }, []);

  // Search debounce
  function handleSearchChange(value: string) {
    setSearch(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setCurrentPage(1);
      load(1, value);
    }, 300);
  }

  function handlePageChange(newPage: number) {
    setCurrentPage(newPage);
    load(newPage, search);
  }

  // Count active platform admins for demote guard
  const adminCount = users.filter(
    (u) => u.systemRole === "platform_admin" && u.isActive,
  ).length;

  // ---------------------------------------------------------------------------
  // Deactivate
  // ---------------------------------------------------------------------------

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    setActionLoading(deactivateTarget.id);
    try {
      const { data, error } = await adminPatch<AdminUser>(
        `/admin/users/${deactivateTarget.id}/status`,
        { isActive: false },
      );
      if (error || !data) {
        toast({ title: "Error", description: error?.message ?? "Failed to deactivate user", variant: "destructive" });
      } else {
        updateUser(data);
        toast({ title: `${data.displayName} has been deactivated.` });
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setActionLoading(null);
      setDeactivateTarget(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Reactivate
  // ---------------------------------------------------------------------------

  async function handleReactivate(user: AdminUser) {
    setActionLoading(user.id);
    try {
      const { data, error } = await adminPatch<AdminUser>(
        `/admin/users/${user.id}/status`,
        { isActive: true },
      );
      if (error || !data) {
        toast({ title: "Error", description: error?.message ?? "Failed to reactivate user", variant: "destructive" });
      } else {
        updateUser(data);
        toast({ title: `${data.displayName} has been reactivated.` });
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Promote
  // ---------------------------------------------------------------------------

  async function confirmPromote() {
    if (!promoteTarget) return;
    setActionLoading(promoteTarget.id);
    try {
      const { data, error } = await adminPatch<AdminUser>(
        `/admin/users/${promoteTarget.id}/role`,
        { systemRole: "platform_admin" },
      );
      if (error || !data) {
        toast({ title: "Error", description: error?.message ?? "Failed to promote user", variant: "destructive" });
      } else {
        updateUser(data);
        toast({ title: `${data.displayName} is now a Platform Admin.` });
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setActionLoading(null);
      setPromoteTarget(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Demote
  // ---------------------------------------------------------------------------

  async function confirmDemote() {
    if (!demoteTarget) return;
    setActionLoading(demoteTarget.id);
    try {
      const { data, error } = await adminPatch<AdminUser>(
        `/admin/users/${demoteTarget.id}/role`,
        { systemRole: "user" },
      );
      if (error || !data) {
        toast({ title: "Error", description: error?.message ?? "Failed to demote user", variant: "destructive" });
      } else {
        updateUser(data);
        toast({ title: `${data.displayName} has been demoted to user.` });
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setActionLoading(null);
      setDemoteTarget(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-[1400px] mx-auto px-6 md:px-8 lg:px-10 h-16 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
            <Database className="w-4 h-4" />
          </div>
          <Link
            href="/catalogs"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Data Catalog Studio
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-sm font-medium text-foreground">Admin</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-sm font-medium text-foreground">Users</span>
          <div className="flex-1" />
          <UserMenu />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto p-6 md:p-8 lg:p-10 space-y-6">
        {/* Page title + search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">User Management</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage all registered users and their access levels.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-input rounded-lg outline-none focus:ring-2 focus:ring-ring transition-shadow"
              data-testid="admin-search"
            />
          </div>
        </div>

        {/* Error state */}
        {usersError && !usersLoading && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">{usersError.message}</p>
            </div>
            <button
              onClick={() => load(currentPage, search)}
              className="text-sm text-destructive hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* User table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="users-table">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Display Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Registered
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {usersLoading && users.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-muted rounded animate-pulse" style={{ width: j === 0 ? "120px" : j === 1 ? "180px" : "80px" }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      {search ? "No users found." : "No users registered yet."}
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <UserTableRow
                      key={user.id}
                      user={user}
                      adminCount={adminCount}
                      onDeactivate={setDeactivateTarget}
                      onReactivate={handleReactivate}
                      onPromote={setPromoteTarget}
                      onDemote={setDemoteTarget}
                      actionLoading={actionLoading}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.total > 0 && (
            <div className="px-4 py-3 border-t border-border flex items-center justify-between bg-muted/20">
              <p className="text-xs text-muted-foreground">
                {pagination.total} user{pagination.total !== 1 ? "s" : ""} total
                {" · "}
                Page {pagination.page} of {totalPages}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || usersLoading}
                  className="p-1.5 rounded border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  data-testid="prev-page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages || usersLoading}
                  className="p-1.5 rounded border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  data-testid="next-page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <DeactivateModal
        user={deactivateTarget}
        onConfirm={confirmDeactivate}
        onCancel={() => setDeactivateTarget(null)}
        isLoading={actionLoading === deactivateTarget?.id}
      />
      <PromoteModal
        user={promoteTarget}
        onConfirm={confirmPromote}
        onCancel={() => setPromoteTarget(null)}
        isLoading={actionLoading === promoteTarget?.id}
      />
      <DemoteModal
        user={demoteTarget}
        onConfirm={confirmDemote}
        onCancel={() => setDemoteTarget(null)}
        isLoading={actionLoading === demoteTarget?.id}
      />
    </div>
  );
}
