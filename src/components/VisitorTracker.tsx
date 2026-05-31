import { useVisitorPresence } from "@/hooks/useVisitorPresence";
import { useAuth } from "@/hooks/useAuth";

/**
 * Silent component that tracks visitor presence on public pages.
 * Excludes admin, super_admin, and therapist users entirely.
 * Mount inside BrowserRouter.
 */
export function VisitorTracker() {
  const { isAdmin, isSuperAdmin, isTherapist, loading } = useAuth();

  // Don't track admin/staff users on ANY page
  if (loading) return null;
  if (isAdmin || isSuperAdmin || isTherapist) return null;

  return <VisitorTrackerInner />;
}

function VisitorTrackerInner() {
  useVisitorPresence();
  return null;
}
