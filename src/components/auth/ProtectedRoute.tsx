import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: AppRole[];
  redirectTo?: string;
}

export function ProtectedRoute({ children, allowedRoles, redirectTo }: ProtectedRouteProps) {
  const { user, roles, loading, isSuperAdmin, isAdmin, isTherapist } = useAuth();
  const pathname = window.location.pathname;

  console.log("[ProtectedRoute]", { pathname, loading, userId: user?.id || null, roles, allowedRoles });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Verifying access...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    const loginPath = allowedRoles.includes("therapist")
      ? "/staff/login"
      : allowedRoles.some((r) => r === "admin" || r === "super_admin")
        ? "/admin/login"
        : "/login";
    console.log("[ProtectedRoute] NO USER → redirect to:", redirectTo || loginPath);
    return <Navigate to={redirectTo || loginPath} replace />;
  }

  const hasAccess = roles.some((r) => allowedRoles.includes(r));
  console.log("[ProtectedRoute] ACCESS CHECK:", { hasAccess, userRoles: roles, allowedRoles });

  if (!hasAccess) {
    console.log("[ProtectedRoute] NO ACCESS → redirecting based on role:", { isSuperAdmin, isAdmin, isTherapist });
    if (isSuperAdmin) return <Navigate to="/super-admin" replace />;
    if (isAdmin) return <Navigate to="/admin" replace />;
    if (isTherapist) return <Navigate to="/staff/dashboard" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
