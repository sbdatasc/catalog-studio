import { Redirect } from "wouter";
import { useAuthStore } from "@/stores/authStore";
import { ProtectedRoute } from "./ProtectedRoute";

interface Props {
  children: React.ReactNode;
}

export function AdminRoute({ children }: Props) {
  const user = useAuthStore((s) => s.user);

  // ProtectedRoute handles the unauthenticated case (refresh + redirect)
  return (
    <ProtectedRoute>
      {user && user.systemRole !== "platform_admin" ? (
        <Redirect to="/catalogs" />
      ) : (
        <>{children}</>
      )}
    </ProtectedRoute>
  );
}
