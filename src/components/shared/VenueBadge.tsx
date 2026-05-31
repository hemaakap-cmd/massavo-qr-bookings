import { Building2, Hotel } from "lucide-react";
import { cn } from "@/lib/utils";
import { getVenueDisplay, type VenueBooking } from "@/lib/venueUtils";

interface VenueBadgeProps {
  booking: VenueBooking | null | undefined;
  showName?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Compact badge that shows a venue icon (hotel/gym) and optionally the venue name.
 * Use everywhere a booking is displayed so the user always knows which venue type it is.
 */
export function VenueBadge({ booking, showName = true, size = "sm", className }: VenueBadgeProps) {
  const { type, name } = getVenueDisplay(booking);
  const Icon = type === "hotel" ? Hotel : Building2;
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-muted-foreground",
        textSize,
        className,
      )}
      title={`${type === "hotel" ? "Hotel" : "Gym"}: ${name}`}
    >
      <Icon className={cn(iconSize, "shrink-0")} />
      {showName && <span className="truncate">{name}</span>}
    </span>
  );
}

export default VenueBadge;