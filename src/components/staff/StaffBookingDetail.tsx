import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateBookingStatus } from "@/hooks/useStaffBookings";
import { SelectedArea } from "@/components/body-diagram/BodyDiagram";
import { SmartRecoveryProfile } from "@/components/clinical/SmartRecoveryProfile";
import { StaffPainEvolutionCard } from "@/components/staff/StaffPainEvolutionCard";
import { StaffPinUnlockGate } from "@/components/staff/StaffPinUnlockGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  User, Calendar, FileText,
  CheckCircle2, XCircle, Loader2, MessageCircle,
  Stethoscope, Send, Building2, Hotel, MapPin,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { de as dfDe, enUS as dfEnUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { StaffBooking } from "@/hooks/useStaffBookings";
import { getVenueDisplay } from "@/lib/venueUtils";

interface Props {
  booking: StaffBooking;
  onBack: () => void;
}

export function StaffBookingDetail({ booking, onBack }: Props) {
  const { t, i18n } = useTranslation();
  const dfLocale = i18n.language?.startsWith("de") ? dfDe : dfEnUS;
  const updateStatus = useUpdateBookingStatus();
  const queryClient = useQueryClient();
  const [advice, setAdvice] = useState("");
  const [adviceSaved, setAdviceSaved] = useState(false);

  const venue = getVenueDisplay({
    gym_id: booking.gym_id,
    hotel_id: booking.hotel_id,
    gyms: booking.gym ? { name: booking.gym.name } : null,
    hotels: booking.hotel ? { name: booking.hotel.name } : null,
  });
  const venueAddress = booking.hotel?.address || booking.gym?.address || null;

  const isToday = booking.booking_date === format(new Date(), "yyyy-MM-dd");
  const isPast = new Date(booking.booking_date) < new Date(format(new Date(), "yyyy-MM-dd"));
  const isCompleted = booking.status === "completed";
  const canUpdate = (booking.status === "confirmed" || booking.status === "pending") && (isToday || isPast);
  const canWriteAdvice = canUpdate || isCompleted || ((booking.status === "confirmed" || booking.status === "pending") && isToday);

  const { data: bodyAreas = [] } = useQuery({
    queryKey: ["booking-body-areas", booking.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_body_areas")
        .select("*")
        .eq("booking_id", booking.id);
      if (error) throw error;
      return (data || []).map((a: any) => ({
        code: a.area_code,
        label: a.area_label,
        side: a.side as "front" | "back",
        painIntensity: a.pain_intensity || 5,
        isFocus: a.is_focus || false,
        notes: a.notes || "",
      })) as SelectedArea[];
    },
  });

  // Load existing therapist advice
  const { data: existingAdvice } = useQuery({
    queryKey: ["therapist-advice", booking.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("booking_feedback")
        .select("therapist_advice, id")
        .eq("booking_id", booking.id)
        .maybeSingle();
      if (data?.therapist_advice) {
        setAdvice(data.therapist_advice);
        setAdviceSaved(true);
      }
      return data;
    },
  });

  const saveAdviceMutation = useMutation({
    mutationFn: async (adviceText: string) => {
      const trimmed = adviceText.trim();
      if (!trimmed) return;

      // Check if feedback record exists
      const { data: existing } = await supabase
        .from("booking_feedback")
        .select("id")
        .eq("booking_id", booking.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("booking_feedback")
          .update({ therapist_advice: trimmed })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Create feedback record with advice
        const { error } = await supabase
          .from("booking_feedback")
          .insert({
            booking_id: booking.id,
            therapist_id: booking.therapist_id,
            gym_id: booking.gym_id,
            // Note: booking_feedback.hotel_id not yet in schema; admin RLS for hotel feedback
            // is tracked as Phase 1 technical debt.
            therapist_advice: trimmed,
            customer_first_name: booking.customer_name?.split(" ")[0] || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setAdviceSaved(true);
      toast.success(t("staff.bookingDetail.adviceSavedToast"));
      queryClient.invalidateQueries({ queryKey: ["therapist-advice", booking.id] });
    },
    onError: (e: any) => {
      toast.error(e.message || t("staff.bookingDetail.adviceErrorToast"));
    },
  });

  const handleAction = (status: string) => {
    updateStatus.mutate(
      { bookingId: booking.id, status },
      { onSuccess: onBack }
    );
  };

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <div className="flex items-center justify-between">
        <StatusBadge status={booking.status} />
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          {venue.type === "hotel" ? (
            <Hotel className="w-3.5 h-3.5" />
          ) : (
            <Building2 className="w-3.5 h-3.5" />
          )}
          <span className="font-medium text-foreground">{venue.name}</span>
          <Badge
            variant="outline"
            className="text-[9px] py-0 h-4 px-1.5 capitalize border-muted-foreground/30"
          >
            {venue.type}
          </Badge>
        </span>
      </div>

      {/* Venue / Location */}
      {venueAddress && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0 text-sm">
              <div className="font-medium text-foreground">{venue.name}</div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary transition-colors break-words"
              >
                {venueAddress}
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Client Info */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <SectionTitle icon={User} title={t("staff.bookingDetail.clientInfo")} />
          <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
            <InfoRow label={t("staff.bookingDetail.name")} value={booking.customer_name || t("staff.bookingDetail.anonymous")} />
            <InfoRow label={t("staff.bookingDetail.email")} value={booking.customer_email} />
          </div>
        </CardContent>
      </Card>

      {/* Appointment Info */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <SectionTitle icon={Calendar} title={t("staff.bookingDetail.appointment")} />
          <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
            <InfoRow
              label={t("staff.bookingDetail.date")}
              value={format(parseISO(booking.booking_date), "EEE, dd MMM yyyy", { locale: dfLocale })}
            />
            <InfoRow
              label={t("staff.bookingDetail.start")}
              value={booking.booking_time?.slice(0, 5) || "—"}
            />
            <InfoRow
              label={t("staff.bookingDetail.end")}
              value={(() => {
                const t = booking.booking_time;
                const dur = booking.service?.duration_minutes;
                if (!t || !dur) return "—";
                const [h, m] = t.split(":").map(Number);
                const end = new Date(0, 0, 0, h, m + dur);
                return `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
              })()}
            />
            <InfoRow
              label={t("staff.bookingDetail.service")}
              value={booking.service?.name || "—"}
            />
            <InfoRow
              label={t("staff.bookingDetail.duration")}
              value={`${booking.service?.duration_minutes || "—"} ${t("staff.bookingDetail.minutes")}`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Protected Session Data — PIN required */}
      <StaffPinUnlockGate>
        {/* Communication Preference */}
        {booking.communication_preference && (
          <Card>
            <CardContent className="p-5 space-y-3">
              <SectionTitle icon={MessageCircle} title={t("staff.bookingDetail.communication")} />
              <div className="flex items-center gap-3 text-sm">
                <span className="text-lg">
                  {booking.communication_preference === "silent" && "🤫"}
                  {booking.communication_preference === "light_talk" && "💬"}
                  {booking.communication_preference === "normal" && "🗣️"}
                </span>
                <span className="font-medium text-foreground">
                  {booking.communication_preference === "silent" && t("staff.bookingDetail.silent")}
                  {booking.communication_preference === "light_talk" && t("staff.bookingDetail.lightTalk")}
                  {booking.communication_preference === "normal" && t("staff.bookingDetail.normal")}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Client Notes / Anmerkungen */}
        {booking.notes && (
          <Card className="border-accent/30 bg-accent/5">
            <CardContent className="p-5 space-y-3">
              <SectionTitle icon={FileText} title={t("staff.bookingDetail.clientNotes")} />
              <p className="text-sm text-foreground whitespace-pre-wrap bg-background/60 rounded-lg p-3 border border-border/30">{booking.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Smart Recovery Profile */}
        <SmartRecoveryProfile
          bookingId={booking.id}
          customerEmail={booking.customer_email}
          currentAreas={bodyAreas}
          clientGender={booking.gender === "male" ? "male" : booking.gender === "female" ? "female" : null}
        />

        {/* Pain Evolution Tracker */}
        <StaffPainEvolutionCard customerEmail={booking.customer_email} />
      </StaffPinUnlockGate>

      {/* Therapist Advice / Tips for Client */}
      {(booking.status === "confirmed" || booking.status === "pending" || isCompleted) && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-5 space-y-3">
            <SectionTitle icon={Stethoscope} title={t("staff.bookingDetail.advice")} />
            <p className="text-xs text-muted-foreground">
              {t("staff.bookingDetail.adviceHelp")}
            </p>
            <Textarea
              value={advice}
              onChange={(e) => {
                setAdvice(e.target.value.slice(0, 1000));
                setAdviceSaved(false);
              }}
              placeholder={t("staff.bookingDetail.advicePlaceholder")}
              className="resize-none text-sm"
              rows={4}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{advice.length}/1000</span>
              <Button
                size="sm"
                onClick={() => saveAdviceMutation.mutate(advice)}
                disabled={saveAdviceMutation.isPending || !advice.trim() || adviceSaved}
              >
                {saveAdviceMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : adviceSaved ? (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                ) : (
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                )}
                {adviceSaved ? t("staff.bookingDetail.saved") : t("staff.bookingDetail.save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {canUpdate && (
        <div className="flex gap-3 pt-2 pb-6">
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            size="lg"
            onClick={() => handleAction("completed")}
            disabled={updateStatus.isPending}
          >
            {updateStatus.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            )}
            {t("staff.bookingDetail.markCompleted")}
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            size="lg"
            onClick={() => handleAction("no_show")}
            disabled={updateStatus.isPending}
          >
            {updateStatus.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4 mr-2" />
            )}
            {t("staff.bookingDetail.noShow")}
          </Button>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-primary" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground block">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const { t } = useTranslation();
  switch (status) {
    case "confirmed":
      return <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">{t("staff.bookingDetail.statusConfirmed")}</Badge>;
    case "completed":
      return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">{t("staff.bookingDetail.statusCompleted")}</Badge>;
    case "no_show":
      return <Badge variant="destructive">{t("staff.bookingDetail.statusNoShow")}</Badge>;
    default:
      return <Badge variant="secondary">{status || t("staff.bookingDetail.statusPending")}</Badge>;
  }
}