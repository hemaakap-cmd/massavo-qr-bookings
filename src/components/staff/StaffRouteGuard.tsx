import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * Redirects therapist-only users away from public routes to /staff/dashboard.
 * Place this inside BrowserRouter but outside Routes.
 */
export function StaffRouteGuard() {
  const { user, roles, loading, isTherapist, isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !user) return;

    const path = location.pathname;

    // If user is ONLY a therapist (not also admin), redirect public routes to staff
    if (isTherapist && !isAdmin && !isSuperAdmin) {
      const isStaffRoute = path.startsWith("/staff");
      const isAuthRoute = path.startsWith("/admin/login") || path.startsWith("/admin/verify") || path.startsWith("/staff/login") || path.startsWith("/staff/verify");

      if (!isStaffRoute && !isAuthRoute) {
        navigate("/staff/dashboard", { replace: true });
      }
    }
  }, [user, roles, loading, isTherapist, isAdmin, isSuperAdmin, location.pathname, navigate]);

  return null;
}
