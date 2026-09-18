import { Globe } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useVenueContext } from "@/domain/venue/VenueContext";
import type { VenueType } from "@/domain/venue/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Persistent venue-type filter chip — lives in the admin header.
 * Single source of truth for "which venue type am I operating on right now".
 * Pages that opt-in read `useVenueContext().activeType` to scope their queries.
 */
export function VenueTypeFilter({ className }: { className?: string }) {
  const { activeType, setActiveType, shippable } = useVenueContext();
  const navigate = useNavigate();
  const location = useLocation();

  const routeByType: Record<"all" | "gym" | "hotel" | "home", string> = {
    all: "/admin/venues",
    gym: "/admin/gyms",
    hotel: "/admin/hotels",
    home: "/admin/home-visits",
  };
  const routeType = location.pathname === "/admin/venues"
    ? null
    : location.pathname.startsWith("/admin/gyms")
      ? "gym"
      : location.pathname.startsWith("/admin/hotels")
        ? "hotel"
        : location.pathname.startsWith("/admin/home-visits")
          ? "home"
          : activeType;
  const chooseType = (type: VenueType | null) => {
    setActiveType(type);
    navigate(routeByType[type === null ? "all" : type as "gym" | "hotel" | "home"] || "/admin/venues");
  };

  return (
    <div
      className={cn("flex items-center gap-1.5 overflow-x-auto", className)}
      role="tablist"
      aria-label="Venue type filter"
    >
      <Button
        type="button"
        role="tab"
        variant={routeType === null ? "default" : "outline"}
        size="sm"
        aria-selected={routeType === null}
        onClick={() => chooseType(null)}
        className="h-8 shrink-0 gap-1.5 rounded-full px-3 text-xs"
      >
        <Globe className="w-3.5 h-3.5" />
        <span>All</span>
      </Button>
      {shippable.map((cfg) => {
        const Icon = cfg.icon;
        const isActive = routeType === cfg.type;
        return (
          <Button
            key={cfg.type}
            type="button"
            role="tab"
            aria-selected={isActive}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => chooseType(cfg.type)}
            className="h-8 shrink-0 gap-1.5 rounded-full px-3 text-xs"
            title={cfg.terminology.plural}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{cfg.terminology.plural}</span>
          </Button>
        );
      })}
    </div>
  );
}

export default VenueTypeFilter;