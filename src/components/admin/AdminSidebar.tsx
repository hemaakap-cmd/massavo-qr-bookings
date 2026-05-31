import { NavLink, useLocation } from "react-router-dom";
import { useCountryData } from "@/hooks/useCountry";
import { useAuth } from "@/hooks/useAuth";
import { CountrySwitcher } from "@/components/admin/CountrySwitcher";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  MapPin,
  Building2,
  Users,
  Calendar,
  QrCode,
  ScanLine,
  BarChart3,
  Map,
  Building,
  Euro,
  ClipboardList,
  FileBarChart,
  Contact,
  CalendarClock,
  Activity,
  Bot,
  HeartPulse,
  CalendarRange,
  PieChart,
  Brain,
  MessageSquare,
  Briefcase,
  UserX,
  Palmtree,
  Package,
  Hotel as HotelIcon,
  LayoutGrid,
  CreditCard,
} from "lucide-react";
import massavoLogo from "@/assets/massavo-logo.png";
import { getAdminGeographyLabels } from "@/constants/adminGeography";

const createNavGroups = (geoLabels: ReturnType<typeof getAdminGeographyLabels>) => [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
      { title: "Monitoring", url: "/admin/monitoring", icon: Activity },
      { title: "System Health", url: "/admin/system-health", icon: HeartPulse },
      { title: "AI Assistant", url: "/admin/ai-assistant", icon: Bot },
    ],
  },
  {
    label: geoLabels.section,
    items: [
      { title: geoLabels.states, url: "/admin/federal-states", icon: Map },
      { title: geoLabels.counties, url: "/admin/counties", icon: Building },
      { title: geoLabels.cities, url: "/admin/cities", icon: MapPin },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Services", url: "/admin/services", icon: Package },
      { title: "Schedules", url: "/admin/schedules", icon: CalendarClock },
      { title: "Smart Scheduling", url: "/admin/scheduling-config", icon: Brain },
      { title: "Therapists", url: "/admin/therapists", icon: Users },
      { title: "Therapist Analytics", url: "/admin/therapist-analytics", icon: BarChart3 },
      { title: "Weekly Planner", url: "/admin/weekly-planner", icon: CalendarRange },
      { title: "Staff Dashboard", url: "/admin/staff-advanced", icon: Users },
      { title: "Work Tracking", url: "/admin/work-tracking", icon: Briefcase },
      { title: "Abwesenheit", url: "/admin/therapist-absence", icon: UserX },
      { title: "Urlaubsverwaltung", url: "/admin/therapist-leaves", icon: Palmtree },
    ],
  },
  {
    // Unified Venues group — replaces the old Gyms / Gym Profiles / Hotels
    // siblings. Individual type pages remain reachable for backward compat
    // until the AdminVenues page lands in Week 3 of the refactor roadmap.
    label: "Venues",
    items: [
      { title: "All Venues", url: "/admin/gyms", icon: LayoutGrid },
      { title: "Gyms", url: "/admin/gyms", icon: Building2 },
      { title: "Hotels", url: "/admin/hotels", icon: HotelIcon },
      { title: "Gym Profiles", url: "/admin/gym-profiles", icon: Contact },
      { title: "Hotel Profiles", url: "/admin/hotel-profiles", icon: Contact },
    ],
  },
  {
    label: "Clinical",
    items: [
      { title: "Pain Evolution", url: "/admin/pain-evolution", icon: HeartPulse },
    ],
  },
  {
    label: "Bookings & Revenue",
    items: [
      { title: "Bookings", url: "/admin/bookings", icon: Calendar },
      { title: "Daily Assignments", url: "/admin/daily-assignments", icon: ClipboardList },
      { title: "Financial", url: "/admin/financial", icon: Euro },
      { title: "Payment Verifications", url: "/admin/payment-verifications", icon: CreditCard },
      { title: "Reporting", url: "/admin/reporting", icon: FileBarChart },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { title: "Enterprise BI", url: "/admin/business-intelligence", icon: Brain },
      { title: "Advanced Analytics", url: "/admin/advanced-analytics", icon: PieChart },
      { title: "Client Data", url: "/admin/client-data", icon: FileBarChart },
      { title: "Reviews", url: "/admin/reviews", icon: MessageSquare },
    ],
  },
  {
    label: "Tools",
    items: [
      { title: "QR Codes", url: "/admin/qr-codes", icon: QrCode },
      { title: "Scan Booking", url: "/admin/scan-booking", icon: ScanLine },
    ],
  },
];

export function AdminSidebar() {
  const location = useLocation();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { isSuperAdmin, countryId } = useAuth();
  const { countries, selectedCountry, setSelectedCountryId } = useCountryData(countryId);
  const navGroups = createNavGroups(getAdminGeographyLabels(selectedCountry?.code));

  const handleMobileNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarContent className="py-3">
        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 pb-4 mb-2 border-b border-sidebar-border ${collapsed ? "justify-center px-2" : ""}`}>
          <img
            src={massavoLogo}
            alt="MASSAVO"
            className={`${collapsed ? "w-7 h-7" : "w-8 h-8"} rounded-md object-contain`}
          />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-display text-sm font-bold text-sidebar-primary tracking-wide">MASSAVO</span>
              <span className="text-[10px] text-admin-text-secondary font-medium uppercase tracking-widest">Admin</span>
            </div>
          )}
        </div>

        {/* Country Switcher — Super Admins see all, admins see theirs */}
        {isSuperAdmin && countries.length > 1 && (
          <div className="mb-3">
            <CountrySwitcher
              countries={countries}
              selectedCountryId={selectedCountry?.id || null}
              onSelect={setSelectedCountryId}
              collapsed={collapsed}
            />
          </div>
        )}

        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-admin-text-secondary text-[10px] font-semibold uppercase tracking-widest px-4 mb-1">
              {!collapsed && group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive =
                    location.pathname === item.url ||
                    (item.url !== "/admin" && location.pathname.startsWith(item.url));

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                        className={`relative mx-2 rounded-lg transition-all duration-150 ${
                          isActive
                            ? "bg-sidebar-accent text-sidebar-primary font-medium"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`}
                      >
                        <NavLink to={item.url} onClick={handleMobileNavClick}>
                          {isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-sidebar-primary rounded-r-full" />
                          )}
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
