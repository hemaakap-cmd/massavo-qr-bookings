import { format } from "date-fns";
import {
  Loader2,
  CalendarPlus,
  XCircle,
  RefreshCw,
  CreditCard,
  ShieldAlert,
  AlertTriangle,
  Info,
  Clock,
  ArrowRight,
  Hotel as HotelIcon,
  Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BookingEvent } from "@/hooks/useBookingEvents";

interface EventFeedProps {
  events: BookingEvent[];
  loading: boolean;
}

const eventConfig: Record<
  string,
  { icon: typeof CalendarPlus; label: string; badgeClass: string; dotColor: string }
> = {
  created: {
    icon: CalendarPlus,
    label: "Created",
    badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10",
    dotColor: "bg-emerald-500",
  },
  cancelled: {
    icon: XCircle,
    label: "Cancelled",
    badgeClass: "bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/10",
    dotColor: "bg-red-500",
  },
  rescheduled: {
    icon: RefreshCw,
    label: "Rescheduled",
    badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/10",
    dotColor: "bg-blue-500",
  },
  updated: {
    icon: Info,
    label: "Updated",
    badgeClass: "bg-muted text-muted-foreground border-border hover:bg-muted",
    dotColor: "bg-muted-foreground",
  },
  payment_updated: {
    icon: CreditCard,
    label: "Payment",
    badgeClass: "bg-violet-500/10 text-violet-600 border-violet-500/20 hover:bg-violet-500/10",
    dotColor: "bg-violet-500",
  },
  conflict_blocked: {
    icon: ShieldAlert,
    label: "Conflict",
    badgeClass: "bg-orange-500/10 text-orange-600 border-orange-500/20 hover:bg-orange-500/10",
    dotColor: "bg-orange-500",
  },
  payment_failed: {
    icon: AlertTriangle,
    label: "Pay Failed",
    badgeClass: "bg-rose-500/10 text-rose-600 border-rose-500/20 hover:bg-rose-500/10",
    dotColor: "bg-rose-500",
  },
};

export function EventFeed({ events, loading }: EventFeedProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <Clock className="w-8 h-8 opacity-40" />
        <p className="text-sm">No events yet — they appear here in real-time.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
      {events.map((event, idx) => {
        const config = eventConfig[event.event_type] || eventConfig.updated;
        const Icon = config.icon;
        const details = event.details as Record<string, unknown>;
        const isFirst = idx === 0;

        return (
          <div
            key={event.id}
            className={`group relative flex items-start gap-3 px-4 py-3 rounded-xl border transition-all duration-200 ${
              isFirst
                ? "bg-card border-primary/20 shadow-sm ring-1 ring-primary/5"
                : "bg-card/60 border-border/50 hover:bg-card hover:border-border"
            }`}
          >
            {/* Timeline dot */}
            <div className="flex flex-col items-center pt-0.5">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.badgeClass.split(" ").slice(0, 1).join("")}`}
                style={{ minWidth: "2rem" }}
              >
                <Icon className="w-4 h-4" />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 ${config.badgeClass}`}
                >
                  {config.label}
                </Badge>

                {event.severity === "error" && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                    Critical
                  </Badge>
                )}
                {event.severity === "warning" && (
                  <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/10">
                    Warning
                  </Badge>
                )}

                <span className="ml-auto text-[10px] tabular-nums text-muted-foreground font-medium">
                  {format(new Date(event.created_at), "HH:mm:ss")}
                </span>
              </div>

              <p className="text-sm font-medium text-foreground truncate">
                {event.customer_name || event.customer_email || "System Event"}
              </p>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                {event.hotels?.name ? (
                  <span className="flex items-center gap-1">
                    <HotelIcon className="w-3 h-3" />
                    {event.hotels.name}
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 ml-0.5">
                      Hotel
                    </span>
                  </span>
                ) : event.gyms?.name ? (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {event.gyms.name}
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 ml-0.5">
                      Gym
                    </span>
                  </span>
                ) : null}
                {event.booking_date && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(event.booking_date), "dd.MM.yyyy")}{" "}
                    {event.booking_time?.slice(0, 5)}
                  </span>
                )}
                {details?.amount && (
                  <span className="font-semibold text-foreground">
                    €{Number(details.amount).toFixed(2)}
                  </span>
                )}
              </div>

              {/* Detail rows */}
              {details?.old_date && (
                <div className="flex items-center gap-1.5 text-[11px] text-blue-500 font-medium mt-0.5">
                  <RefreshCw className="w-3 h-3" />
                  {String(details.old_date)}
                  <ArrowRight className="w-3 h-3" />
                  {String(details.new_date)}
                </div>
              )}
              {details?.new_payment && (
                <div className="flex items-center gap-1.5 text-[11px] text-violet-500 font-medium mt-0.5">
                  <CreditCard className="w-3 h-3" />
                  {String(details.old_payment)}
                  <ArrowRight className="w-3 h-3" />
                  {String(details.new_payment)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
