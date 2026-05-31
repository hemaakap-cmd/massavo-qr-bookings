import { Globe } from "lucide-react";
import { useVenueContext } from "@/domain/venue/VenueContext";
import { cn } from "@/lib/utils";

/**
 * Persistent venue-type filter chip — lives in the admin header.
 * Single source of truth for "which venue type am I operating on right now".
 * Pages that opt-in read `useVenueContext().activeType` to scope their queries.
 */
export function VenueTypeFilter({ className }: { className?: string }) {
  const { activeType, setActiveType, shippable } = useVenueContext();

  const baseChip =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors";
  const inactive =
    "border-border/60 bg-background/40 text-muted-foreground hover:bg-background/70 hover:text-foreground";
  const active = "border-primary bg-primary/15 text-primary";

  return (
    <div
      className={cn("flex items-center gap-1.5 overflow-x-auto", className)}
      role="tablist"
      aria-label="Venue type filter"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeType === null}
        onClick={() => setActiveType(null)}
        className={cn(baseChip, activeType === null ? active : inactive)}
      >
        <Globe className="w-3.5 h-3.5" />
        <span>All</span>
      </button>
      {shippable.map((cfg) => {
        const Icon = cfg.icon;
        const isActive = activeType === cfg.type;
        return (
          <button
            key={cfg.type}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setActiveType(cfg.type)}
            className={cn(baseChip, isActive ? active : inactive)}
            title={cfg.terminology.plural}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{cfg.terminology.plural}</span>
          </button>
        );
      })}
    </div>
  );
}

export default VenueTypeFilter;