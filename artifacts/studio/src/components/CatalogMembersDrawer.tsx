import { useState, useEffect, useRef, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  Users,
  UserPlus,
  Loader2,
  AlertCircle,
  Search,
  X,
  ChevronDown,
} from "lucide-react";
import { apiClient, type CatalogMember, type EligibleUser, type CatalogRole } from "@/lib/apiClient";
import type { AuthUser } from "@/stores/authStore";

// ---------------------------------------------------------------------------
// Role helpers
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<CatalogRole, string> = {
  catalog_admin: "Catalog Admin",
  designer: "Designer",
  steward: "Steward",
  viewer: "Viewer",
  api_consumer: "API Consumer",
};

const ROLE_DESCRIPTIONS: Record<CatalogRole, string> = {
  catalog_admin: "Full control including managing members",
  designer: "Edit schema templates and attributes",
  steward: "Edit entries and manage data quality",
  viewer: "Read-only access to catalog and entries",
  api_consumer: "API access only (no UI permissions)",
};

const ROLE_BADGE_CLASS: Record<CatalogRole, string> = {
  catalog_admin: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-400",
  designer: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400",
  steward: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400",
  viewer: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400",
  api_consumer: "bg-muted text-muted-foreground border-border",
};

const SELECTABLE_ROLES: CatalogRole[] = ["catalog_admin", "designer", "steward", "viewer", "api_consumer"];

function RoleBadge({ role }: { role: CatalogRole }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_BADGE_CLASS[role]}`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ChangeRoleModal
// ---------------------------------------------------------------------------

interface ChangeRoleModalProps {
  member: CatalogMember | null;
  catalogId: string;
  onClose: () => void;
  onChanged: (updated: CatalogMember) => void;
}

function ChangeRoleModal({ member, catalogId, onClose, onChanged }: ChangeRoleModalProps) {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<CatalogRole>("viewer");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      setSelectedRole(member.catalogRole);
      setError(null);
    }
  }, [member]);

  const handleSave = async () => {
    if (!member || selectedRole === member.catalogRole) {
      onClose();
      return;
    }
    setIsSaving(true);
    setError(null);
    const { data, error: err } = await apiClient.catalogRoles.changeRole(catalogId, member.userId, selectedRole);
    setIsSaving(false);
    if (err) {
      if (err.code === "LAST_ADMIN") {
        setError("Cannot demote the only catalog admin. Assign another admin first.");
      } else {
        setError(err.message);
      }
      return;
    }
    if (data) {
      onChanged(data);
      toast({ title: "Role updated", description: `${member.displayName} is now ${ROLE_LABELS[selectedRole]}` });
    }
  };

  return (
    <Dialog open={!!member} onOpenChange={(open) => { if (!open && !isSaving) onClose(); }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Change Role</DialogTitle>
          <DialogDescription className="sr-only">Change the catalog role for this member</DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg flex items-start gap-2 border border-destructive/20">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Select a new role for{" "}
            <span className="font-semibold text-foreground">{member?.displayName}</span>.
          </p>
          <div className="space-y-2">
            {SELECTABLE_ROLES.map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                  selectedRole === role
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/50"
                }`}
                data-testid={`role-option-${role}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{ROLE_LABELS[role]}</span>
                  {selectedRole === role && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{ROLE_DESCRIPTIONS[role]}</p>
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving} data-testid="button-cancel-role">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-role">
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// RemoveMemberModal
// ---------------------------------------------------------------------------

interface RemoveMemberModalProps {
  member: CatalogMember | null;
  catalogId: string;
  onClose: () => void;
  onRemoved: (userId: string) => void;
}

function RemoveMemberModal({ member, catalogId, onClose, onRemoved }: RemoveMemberModalProps) {
  const { toast } = useToast();
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (member) setError(null);
  }, [member]);

  const handleRemove = async () => {
    if (!member) return;
    setIsRemoving(true);
    setError(null);
    const { data, error: err } = await apiClient.catalogRoles.removeMember(catalogId, member.userId);
    setIsRemoving(false);
    if (err) {
      if (err.code === "LAST_ADMIN") {
        setError("Cannot remove the only catalog admin. Assign another admin first.");
      } else {
        setError(err.message);
      }
      return;
    }
    if (data) {
      onRemoved(member.userId);
      toast({ title: "Member removed", description: `${member.displayName} has been removed from this catalog` });
    }
  };

  return (
    <Dialog open={!!member} onOpenChange={(open) => { if (!open && !isRemoving) onClose(); }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Remove Member</DialogTitle>
          <DialogDescription className="sr-only">Remove this member from the catalog</DialogDescription>
        </DialogHeader>
        <div className="py-3 space-y-3">
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg flex items-start gap-2 border border-destructive/20">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Remove{" "}
            <span className="font-semibold text-foreground">{member?.displayName}</span> from this
            catalog? They will lose all access immediately.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isRemoving} data-testid="button-cancel-remove">
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleRemove} disabled={isRemoving} data-testid="button-confirm-remove">
            {isRemoving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// RoleSelector
// ---------------------------------------------------------------------------

interface RoleSelectorProps {
  value: CatalogRole;
  onChange: (r: CatalogRole) => void;
}

function RoleSelector({ value, onChange }: RoleSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
        data-testid="role-selector-button"
      >
        {ROLE_LABELS[value]}
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-card border border-border rounded-lg shadow-lg py-1 overflow-hidden">
          {SELECTABLE_ROLES.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => { onChange(role); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                value === role ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted/60"
              }`}
              data-testid={`role-selector-option-${role}`}
            >
              <div className="font-medium">{ROLE_LABELS[role]}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{ROLE_DESCRIPTIONS[role]}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddMemberDrawer
// ---------------------------------------------------------------------------

interface AddMemberDrawerProps {
  isOpen: boolean;
  catalogId: string;
  onClose: () => void;
  onAdded: (member: CatalogMember) => void;
}

function AddMemberDrawer({ isOpen, catalogId, onClose, onAdded }: AddMemberDrawerProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EligibleUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<EligibleUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<CatalogRole>("viewer");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setSelected(null);
      setSelectedRole("viewer");
      setAddError(null);
    }
  }, [isOpen]);

  const search = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!q.trim()) {
        setResults([]);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        setSearching(true);
        const { data } = await apiClient.catalogRoles.searchEligible(catalogId, q.trim());
        setSearching(false);
        if (data) setResults(data);
      }, 280);
    },
    [catalogId],
  );

  const handleQueryChange = (v: string) => {
    setQuery(v);
    setSelected(null);
    search(v);
  };

  const handleSelectUser = (u: EligibleUser) => {
    setSelected(u);
    setQuery(u.displayName);
    setResults([]);
  };

  const handleAdd = async () => {
    if (!selected) return;
    setIsAdding(true);
    setAddError(null);
    const { data, error } = await apiClient.catalogRoles.addMember(catalogId, {
      userId: selected.id,
      catalogRole: selectedRole,
    });
    setIsAdding(false);
    if (error) {
      if (error.code === "CONFLICT") {
        setAddError("This user is already a member of the catalog.");
      } else {
        setAddError(error.message);
      }
      return;
    }
    if (data) {
      onAdded(data);
      toast({ title: "Member added", description: `${selected.displayName} added as ${ROLE_LABELS[selectedRole]}` });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open && !isAdding) onClose(); }}>
      <SheetContent
        className="w-[380px] sm:max-w-[380px] p-0 flex flex-col border-l border-border bg-card"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => { e.preventDefault(); onClose(); }}
      >
        <SheetHeader className="px-6 py-4 border-b border-border/50">
          <SheetTitle className="text-lg font-semibold">Add Member</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {addError && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg flex items-start gap-2 border border-destructive/20">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{addError}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Search users</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Name or email…"
                className="pl-9"
                autoFocus
                data-testid="input-member-search"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(""); setResults([]); setSelected(null); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {searching && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Searching…
              </div>
            )}

            {results.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden bg-background shadow-sm">
                {results.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectUser(u)}
                    className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors border-b border-border/50 last:border-0"
                    data-testid={`eligible-user-${u.id}`}
                  >
                    <div className="text-sm font-medium text-foreground">{u.displayName}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </button>
                ))}
              </div>
            )}

            {selected && (
              <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <div>
                  <span className="font-medium text-foreground">{selected.displayName}</span>
                  <span className="text-muted-foreground ml-1.5">{selected.email}</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <div className="space-y-2">
              {SELECTABLE_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSelectedRole(role)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                    selectedRole === role
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  }`}
                  data-testid={`add-role-option-${role}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{ROLE_LABELS[role]}</span>
                    {selectedRole === role && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{ROLE_DESCRIPTIONS[role]}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border/50 bg-muted/20 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isAdding} data-testid="button-cancel-add-member">
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!selected || isAdding} data-testid="button-confirm-add-member">
            {isAdding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Add Member
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// MemberRow
// ---------------------------------------------------------------------------

interface MemberRowProps {
  member: CatalogMember;
  canManage: boolean;
  onChangeRole: () => void;
  onRemove: () => void;
}

function MemberRow({ member, canManage, onChangeRole, onRemove }: MemberRowProps) {
  return (
    <div
      className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0"
      data-testid={`member-row-${member.userId}`}
    >
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <span className="text-xs font-semibold text-primary">
          {member.displayName.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground truncate">{member.displayName}</span>
          {member.isSelf && (
            <span className="text-xs text-muted-foreground">(you)</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <RoleBadge role={member.catalogRole} />
        {canManage && (
          <>
            <button
              onClick={onChangeRole}
              className="px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-md transition-colors"
              data-testid={`button-change-role-${member.userId}`}
            >
              Change
            </button>
            <button
              onClick={onRemove}
              className="px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              data-testid={`button-remove-member-${member.userId}`}
            >
              Remove
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CatalogMembersDrawer (main export)
// ---------------------------------------------------------------------------

interface CatalogMembersDrawerProps {
  isOpen: boolean;
  catalogId: string;
  catalogName: string;
  currentUser: AuthUser;
  effectiveRole: CatalogRole | "platform_admin" | null;
  onClose: () => void;
}

export function CatalogMembersDrawer({
  isOpen,
  catalogId,
  catalogName,
  currentUser,
  effectiveRole,
  onClose,
}: CatalogMembersDrawerProps) {
  const [members, setMembers] = useState<CatalogMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [changeRoleTarget, setChangeRoleTarget] = useState<CatalogMember | null>(null);
  const [removeTarget, setRemoveTarget] = useState<CatalogMember | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  const canManage = effectiveRole === "catalog_admin" || effectiveRole === "platform_admin";

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await apiClient.catalogRoles.listMembers(catalogId);
    setLoading(false);
    if (error) {
      setLoadError(error.message);
    } else if (data) {
      setMembers(data);
    }
  }, [catalogId]);

  useEffect(() => {
    if (isOpen) {
      loadMembers();
    } else {
      setMembers([]);
      setLoadError(null);
      setAddMemberOpen(false);
      setChangeRoleTarget(null);
      setRemoveTarget(null);
    }
  }, [isOpen, loadMembers]);

  const platformAdminMembers = members.filter((m) => m.catalogRole === "catalog_admin" && currentUser.systemRole === "platform_admin" && m.isSelf);
  const regularMembers = members;

  const handleChanged = (updated: CatalogMember) => {
    setMembers((prev) => prev.map((m) => (m.userId === updated.userId ? updated : m)));
    setChangeRoleTarget(null);
  };

  const handleRemoved = (userId: string) => {
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
    setRemoveTarget(null);
  };

  const handleAdded = (member: CatalogMember) => {
    setMembers((prev) => [...prev, member]);
    setAddMemberOpen(false);
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent
          className="w-[440px] sm:max-w-[440px] p-0 flex flex-col border-l border-border bg-card"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => { e.preventDefault(); onClose(); }}
        >
          <SheetHeader className="px-6 py-4 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-lg font-semibold">Members</SheetTitle>
                <p className="text-sm text-muted-foreground mt-0.5 truncate max-w-[280px]">{catalogName}</p>
              </div>
              {canManage && (
                <Button
                  size="sm"
                  onClick={() => setAddMemberOpen(true)}
                  data-testid="button-add-member"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                  Add
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-3">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <AlertCircle className="w-8 h-8 text-destructive/70" />
                <p className="text-sm text-muted-foreground">{loadError}</p>
                <Button variant="outline" size="sm" onClick={loadMembers}>
                  Retry
                </Button>
              </div>
            ) : members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Users className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No members assigned yet.</p>
                {canManage && (
                  <Button size="sm" onClick={() => setAddMemberOpen(true)}>
                    <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                    Add first member
                  </Button>
                )}
              </div>
            ) : (
              <div>
                {/* Platform Admin implicit access note (only for platform_admins viewing) */}
                {currentUser.systemRole === "platform_admin" && (
                  <div className="flex items-center gap-2 py-3 border-b border-border/50 mb-1">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
                      <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{currentUser.displayName}</span>
                        <span className="text-xs text-muted-foreground">(you)</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Platform Admin — full access</p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 shrink-0">
                      <Shield className="w-3 h-3" />
                      Platform Admin
                    </span>
                  </div>
                )}

                {regularMembers.map((m) => (
                  <MemberRow
                    key={m.userId}
                    member={m}
                    canManage={canManage}
                    onChangeRole={() => setChangeRoleTarget(m)}
                    onRemove={() => setRemoveTarget(m)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border/50 bg-muted/20 flex justify-end">
            <Button variant="outline" onClick={onClose} data-testid="button-close-members-drawer">
              Close
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ChangeRoleModal
        member={changeRoleTarget}
        catalogId={catalogId}
        onClose={() => setChangeRoleTarget(null)}
        onChanged={handleChanged}
      />

      <RemoveMemberModal
        member={removeTarget}
        catalogId={catalogId}
        onClose={() => setRemoveTarget(null)}
        onRemoved={handleRemoved}
      />

      <AddMemberDrawer
        isOpen={addMemberOpen}
        catalogId={catalogId}
        onClose={() => setAddMemberOpen(false)}
        onAdded={handleAdded}
      />
    </>
  );
}
