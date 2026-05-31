import { ReactNode } from "react";
import { Navigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCountryData } from "@/hooks/useCountry";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { VenueProvider } from "@/domain/venue/VenueContext";
import { VenueTypeFilter } from "./VenueTypeFilter";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, Home, ChevronRight, Bell } from "lucide-react";
import { useTodayPendingBookings } from "@/hooks/useTodayPendingBookings";
import { getAdminGeographyLabels } from "@/constants/adminGeography";

interface AdminLayoutProps {
  children: ReactNode;
}

const baseRouteLabels: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/venues": "Venues",
  "/admin/venue-profiles": "Venue Profiles",
  "/admin/gyms": "Gyms",
  "/admin/gym-profiles": "Gym Profiles",
  "/admin/hotels": "Hotels",
  "/admin/schedules": "Schedules",
  "/admin/therapists": "Therapists",
  "/admin/bookings": "Bookings",
  "/admin/daily-assignments": "Daily Assignments",
  "/admin/financial": "Financial",
  "/admin/reporting": "Reporting",
  "/admin/qr-codes": "QR Codes",
  "/admin/monitoring": "Monitoring",
  "/admin/payment-verifications": "Payment Verifications",
  "/admin/ai-assistant": "AI Assistant",
  "/admin/staff-advanced": "Staff Dashboard",
};

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, isAdmin, loading, signOut, countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);
  const location = useLocation();
  const { data: pendingCount = 0 } = useTodayPendingBookings();
  const geographyLabels = getAdminGeographyLabels(selectedCountry?.code);

  const currentLabel = ({
    ...baseRouteLabels,
    "/admin/federal-states": geographyLabels.states,
    "/admin/counties": geographyLabels.counties,
    "/admin/cities": geographyLabels.cities,
  })[location.pathname] || "Admin";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading admin panel...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <span className="text-2xl">🔒</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Access Denied
          </h1>
          <p className="text-muted-foreground text-sm">
            You don't have permission to access the admin dashboard.
          </p>
          <Button variant="sage" asChild>
            <Link to="/">Go Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <VenueProvider>
    <SidebarProvider dir="ltr">
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div className="hidden sm:flex items-center gap-1.5 text-sm">
                <span className="text-muted-foreground">Admin</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                <span className="font-medium text-foreground">{currentLabel}</span>
              </div>
              <span className="sm:hidden font-medium text-foreground text-sm">{currentLabel}</span>
              <VenueTypeFilter className="hidden md:flex ml-3" />
            </div>
            <div className="flex items-center gap-1">
              {/* Notification badge */}
              <Button variant="ghost" size="icon" className="relative" asChild>
                <Link to="/admin/bookings">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                  {pendingCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                      {pendingCount > 9 ? "9+" : pendingCount}
                    </span>
                  )}
                </Link>
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" asChild>
                <Link to="/">
                  <Home className="w-4 h-4 mr-1.5" />
                  <span className="hidden sm:inline">Site</span>
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => signOut()}
              >
                <LogOut className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </header>
          {/* Mobile venue-type filter — sits below the header on small screens. */}
          <div className="md:hidden border-b border-border/60 bg-card/60 px-3 py-2">
            <VenueTypeFilter />
          </div>
          {/* Main content */}
          <main className="flex-1 p-4 md:p-6 bg-background overflow-x-hidden overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
    </VenueProvider>
  );
}
