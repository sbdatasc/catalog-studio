import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { LogOut, ChevronDown, User, Shield } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const { user, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    await logout();
    setLocation("/login");
  }

  if (!user) return null;

  const isAdmin = user.systemRole === "platform_admin";

  const initials = user.displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted/60 transition-colors text-sm"
        data-testid="user-menu-button"
        aria-label="User menu"
      >
        <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
          {initials || <User className="w-3.5 h-3.5" />}
        </div>
        <span className="hidden sm:block font-medium text-foreground max-w-[120px] truncate">
          {user.displayName}
        </span>
        <ChevronDown
          className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border">
            <p className="text-sm font-medium text-foreground truncate">{user.displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            {isAdmin && (
              <span className="mt-1 inline-block text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                Admin
              </span>
            )}
          </div>
          <div className="p-1">
            {isAdmin && (
              <Link
                href="/admin/users"
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm text-foreground hover:bg-muted rounded-md transition-colors"
                data-testid="admin-panel-link"
              >
                <Shield className="w-4 h-4 text-muted-foreground" />
                Admin panel
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              data-testid="logout-button"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
