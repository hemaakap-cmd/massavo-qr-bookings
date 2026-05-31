import { format, parseISO } from "date-fns";
import { de as dfDe, enUS as dfEnUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2, XCircle, Clock, MapPin, User, Calendar,
  Phone, ExternalLink, Building2, MessageCircle
} from "lucide-react";
import type { StaffBooking } from "@/hooks/useStaffBookings";

interface StaffBookingCardProps {
  booking: StaffBooking;
  onMarkCompleted: (id: string) => void;
  onMarkNoShow: (id: string) => void;
  isUpdating: boolean;
}

function statusBadge(status: string | null, t: (k: string) => string) {
  switch (status) {
    case "confirmed": return <Badge variant="default" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{t("staff.bookingDetail.statusConfirmed")}</Badge>;
    case "completed": return <Badge variant="default" className="bg-blue-500/20 text-blue-400 border-blue-500/30">{t("staff.bookingDetail.statusCompleted")}</Badge>;
    case "no_show": return <Badge variant="destructive">{t("staff.bookingDetail.statusNoShow")}</Badge>;
    default: return <Badge variant="secondary">{status || t("staff.bookingDetail.statusPending")}</Badge>;
  }
}

export function StaffBookingCard({ booking, onMarkCompleted, onMarkNoShow, isUpdating }: StaffBookingCardProps) {
  const { t, i18n } = useTranslation();
  const dfLocale = i18n.language?.startsWith("de") ? dfDe : dfEnUS;
  const isToday = booking.booking_date === format(new Date(), "yyyy-MM-dd");
  const isPast = new Date(booking.booking_date) < new Date(format(new Date(), "yyyy-MM-dd"));
  const canUpdate = (booking.status === "confirmed" || booking.status === "pending") && (isToday || isPast);

  const mapsUrl = booking.gym?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.gym.address)}`
    : null;

  return (
    <Card className={isToday ? "border-primary/40 bg-primary/5" : ""}>
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-medium text-foreground">
              {format(parseISO(booking.booking_date), "EEE, dd MMM yyyy", { locale: dfLocale })}
            </span>
            <span className="text-muted-foreground">
              {booking.booking_time?.slice(0, 5)}
            </span>
            {isToday && <Badge variant="outline" className="text-[10px] py-0 border-primary text-primary">{t("staff.workingDays.today")}</Badge>}
          </div>
        </div>
        {statusBadge(booking.status, t)}
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Client & Service Info — Payment data redacted per staff privacy policy */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-xs text-muted-foreground block">{t("staff.bookingDetail.clientInfo")}</span>
            <span className="font-medium text-foreground flex items-center gap-1">
              <User className="w-3 h-3" />
              {booking.customer_name || t("staff.bookingDetail.anonymous")}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">{t("staff.bookingDetail.service")}</span>
            <span className="font-medium text-foreground">
              {booking.service?.name || "—"}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">{t("staff.bookingDetail.duration")}</span>
            <span className="text-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {booking.service?.duration_minutes || "—"} {t("staff.bookingDetail.minutes")}
            </span>
          </div>
        </div>

        {/* Communication Preference */}
        {booking.communication_preference && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 text-sm">
            <MessageCircle className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs text-muted-foreground">{t("staff.bookingDetail.commShort")}:</span>
            <span className="text-xs font-medium text-foreground">
              {booking.communication_preference === "silent" && `🤫 ${t("staff.bookingDetail.silentShort")}`}
              {booking.communication_preference === "light_talk" && `💬 ${t("staff.bookingDetail.lightTalkShort")}`}
              {booking.communication_preference === "normal" && `🗣️ ${t("staff.bookingDetail.normalShort")}`}
            </span>
          </div>
        )}

        {/* Gym Location Section */}
        {booking.gym && (
          <>
            <Separator className="my-1" />
            <div className="rounded-lg bg-muted/50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm font-semibold text-foreground">{booking.gym.name}</span>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>{booking.gym.address}</span>
                </div>
                {booking.gym.phone && (
                  <a
                    href={`tel:${booking.gym.phone}`}
                    className="flex items-center gap-2 hover:text-primary transition-colors"
                  >
                    <Phone className="w-3 h-3 shrink-0" />
                    <span>{booking.gym.phone}</span>
                  </a>
                )}
              </div>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors mt-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  {t("staff.dayView.map")}
                </a>
              )}
            </div>
          </>
        )}

        {canUpdate && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
              onClick={() => onMarkCompleted(booking.id)}
              disabled={isUpdating}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              {t("staff.bookingDetail.statusCompleted")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => onMarkNoShow(booking.id)}
              disabled={isUpdating}
            >
              <XCircle className="w-3.5 h-3.5 mr-1" />
              {t("staff.bookingDetail.noShow")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
