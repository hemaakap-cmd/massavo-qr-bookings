import { useMemo } from "react";
import { useStaffBookings, useUpdateBookingStatus } from "@/hooks/useStaffBookings";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2, Hotel, MapPin, Phone, Clock, ExternalLink,
  Calendar, User, ChevronRight, CheckCircle2, AlertTriangle,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { de as dfDe, enUS as dfEnUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import type { StaffWorkingDay } from "./StaffWorkingDays";
import type { StaffBooking } from "@/hooks/useStaffBookings";

interface Props {
  day: StaffWorkingDay;
  highlightedId: string | null;
  onSelectBooking: (booking: StaffBooking) => void;
}

export function StaffDayView({ day, highlightedId, onSelectBooking }: Props) {
  const { t, i18n } = useTranslation();
  const dfLocale = i18n.language?.startsWith("de") ? dfDe : dfEnUS;
  const { data: allBookings = [], isLoading } = useStaffBookings({
    dateFrom: day.date,
    dateTo: day.date,
  });

  // Filter to only this venue's bookings (gym OR hotel)
  const bookings = useMemo(
    () =>
      allBookings.filter((b) =>
        day.venueType === "hotel"
          ? b.hotel?.id === day.venueId || b.hotel_id === day.venueId
          : b.gym?.id === day.venueId || b.gym_id === day.venueId,
      ),
    [allBookings, day.venueId, day.venueType],
  );

  const scheduled = bookings.filter(b => b.status !== "completed" && b.status !== "no_show");
  const completed = bookings.filter(b => b.status === "completed");
  const noShows = bookings.filter(b => b.status === "no_show");

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(day.venueAddress)}`;
  const dateObj = new Date(day.date + "T00:00:00");

  return (
    <div className="space-y-6">
      {/* Gym Header Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                {day.venueType === "hotel" ? (
                  <Hotel className="h-5 w-5 text-primary" />
                ) : (
                  <Building2 className="h-5 w-5 text-primary" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-foreground">{day.venueName}</h2>
                  <Badge
                    variant="outline"
                    className="text-[9px] py-0 h-4 px-1.5 capitalize border-muted-foreground/30 text-muted-foreground"
                  >
                    {day.venueType}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{format(dateObj, "EEEE, dd MMM yyyy", { locale: dfLocale })}</p>
              </div>
            </div>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
            >
              <MapPin className="h-3.5 w-3.5" />
              {t("staff.dayView.map")}
            </a>
          </div>

          <div className="grid gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{day.venueAddress}</span>
            </div>
            {day.venuePhone && (
              <a href={`tel:${day.venuePhone}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                <span>{day.venuePhone}</span>
              </a>
            )}
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{day.startTime.slice(0, 5)} – {day.endTime.slice(0, 5)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Calendar} label={t("staff.dayView.scheduled")} value={scheduled.length} color="text-primary" />
        <StatCard icon={CheckCircle2} label={t("staff.dayView.completed")} value={completed.length} color="text-emerald-500" />
        <StatCard icon={AlertTriangle} label={t("staff.dayView.noShows")} value={noShows.length} color="text-destructive" />
      </div>

      {/* Bookings List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">{t("staff.dayView.noBookings")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {scheduled.length > 0 && (
            <BookingGroup
              title={t("staff.dayView.scheduled")}
              bookings={scheduled}
              highlightedId={highlightedId}
              onSelect={onSelectBooking}
            />
          )}
          {completed.length > 0 && (
            <BookingGroup
              title={t("staff.dayView.completed")}
              bookings={completed}
              highlightedId={highlightedId}
              onSelect={onSelectBooking}
            />
          )}
          {noShows.length > 0 && (
            <BookingGroup
              title={t("staff.dayView.noShows")}
              bookings={noShows}
              highlightedId={highlightedId}
              onSelect={onSelectBooking}
            />
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: number; color: string;
}) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-2.5">
        <Icon className={`w-4 h-4 ${color}`} />
        <div>
          <div className="text-lg font-bold text-foreground leading-tight">{value}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function BookingGroup({ title, bookings, highlightedId, onSelect }: {
  title: string;
  bookings: StaffBooking[];
  highlightedId: string | null;
  onSelect: (b: StaffBooking) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
      <div className="space-y-2">
        {bookings.map(b => (
          <Card
            key={b.id}
            className={`cursor-pointer transition-all hover:shadow-sm active:scale-[0.99] ${
              highlightedId === b.id
                ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                : ""
            }`}
            onClick={() => onSelect(b)}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="font-medium text-sm text-foreground truncate">
                  {b.customer_name || t("staff.dayView.anonymous")}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {b.booking_time?.slice(0, 5)}
                  </span>
                  <span>{b.service?.name || "—"}</span>
                  <span>{b.service?.duration_minutes || "—"} {t("staff.dayView.minutes")}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusDot status={b.status} />
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string | null }) {
  const color = status === "confirmed"
    ? "bg-emerald-500"
    : status === "completed"
    ? "bg-blue-500"
    : status === "no_show"
    ? "bg-destructive"
    : "bg-muted-foreground";

  return <span className={`w-2.5 h-2.5 rounded-full ${color}`} />;
}
