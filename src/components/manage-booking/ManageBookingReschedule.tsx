import type { ManagedBooking } from "@/hooks/useManageBooking";
import { ScheduleAwareTimeSlotPicker } from "@/components/booking/ScheduleAwareTimeSlotPicker";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle, Loader2, Calendar, Clock, ShieldCheck } from "lucide-react";
import { format, parseISO } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";

interface Props {
  booking: ManagedBooking;
  selectedDate: string;
  selectedTime: string;
  confirmEmail: string;
  onSelectDate: (date: string) => void;
  onSelectTime: (time: string) => void;
  onConfirmEmailChange: (email: string) => void;
  onConfirm: () => Promise<void>;
  onBack: () => void;
  isPending: boolean;
  error: string | null;
}

export function ManageBookingReschedule({
  booking, selectedDate, selectedTime, confirmEmail,
  onSelectDate, onSelectTime, onConfirmEmailChange, onConfirm, onBack,
  isPending, error,
}: Props) {
  const canSubmit = !!selectedDate && !!selectedTime && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(confirmEmail.trim());
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith("en") ? enUS : de;
  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" /> {t("manageDetails.back")}
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("manageDetails.newAppointment")}</CardTitle>
          <CardDescription>
            {t("manageDetails.currentAppointment", {
              date: format(parseISO(booking.booking_date), "d. MMMM yyyy", { locale: dateLocale }),
              time: booking.booking_time.slice(0, 5),
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScheduleAwareTimeSlotPicker
            gymId={booking.venueType === "hotel" ? undefined : booking.gym_id}
            hotelId={booking.venueType === "hotel" ? booking.hotel_id || undefined : undefined}
            venueType={booking.venueType || "gym"}
            serviceDurationMinutes={booking.serviceDuration}
            selectedDate={selectedDate || null}
            selectedTime={selectedTime || null}
            onSelectDate={onSelectDate}
            onSelectTime={onSelectTime}
          />
        </CardContent>
      </Card>

      {/* Confirmation summary */}
      {selectedDate && selectedTime && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-3">{t("manageDetails.newTimeTitle")}</h3>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="font-medium">
                  {format(parseISO(selectedDate), "EEEE, d. MMMM yyyy", { locale: dateLocale })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="font-medium">{selectedTime} {t("manageDetails.uhr")}</span>
              </div>
            </div>

            {/* Security: re-confirm email so the cancellation token alone can't
                be used to hijack the booking. */}
            <div className="space-y-2 mb-4">
              <Label htmlFor="confirm-email" className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {t("manageDetails.confirmEmailLabel")}
              </Label>
              <Input
                id="confirm-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder={t("manageDetails.confirmEmailPlaceholder")}
                value={confirmEmail}
                onChange={(e) => onConfirmEmailChange(e.target.value)}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                {t("manageDetails.confirmEmailHelp")}
              </p>
            </div>

            {error && <p className="text-sm text-destructive mb-3">{error}</p>}

            <Button className="w-full" size="lg" onClick={onConfirm} disabled={isPending || !canSubmit}>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              {t("manageDetails.reschedule")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
