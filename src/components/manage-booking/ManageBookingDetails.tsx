import { useState } from "react";
import type { ManagedBooking } from "@/hooks/useManageBooking";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, CalendarDays, RefreshCw, XCircle, AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { Trans } from "react-i18next";

interface Props {
  booking: ManagedBooking;
  onReschedule: () => void;
  onCancel: () => Promise<void>;
  isCancelling: boolean;
  cancelError: string | null;
}

export function ManageBookingDetails({ booking, onReschedule, onCancel, isCancelling, cancelError }: Props) {
  const { t } = useTranslation();
  const { i18n } = useTranslation();
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const locale = i18n.language?.startsWith("en") ? "en-US" : "de-DE";
    return date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  return (
    <>
      <div className="text-center mb-8">
        <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <CalendarDays className="h-7 w-7 text-primary" />
        </div>
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">{t("manageDetails.title")}</h1>
        <p className="text-muted-foreground">{t("manageDetails.subtitle")}</p>
      </div>

      {/* Policy notice */}
      <Card className="mb-6 border-accent bg-accent/10">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-accent-foreground flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              <Trans i18nKey="manageDetails.policy" components={[<strong key="0" />]} />
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Booking info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>{booking.serviceName}</span>
            <Badge variant="outline">{booking.serviceDuration} {t("manageDetails.minutes")}</Badge>
          </CardTitle>
          <CardDescription>{t("manageDetails.details")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="font-medium">{booking.gymName}</span>
              {booking.gymAddress && <span className="text-muted-foreground ml-1">• {booking.gymAddress}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{formatDate(booking.booking_date)}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{booking.booking_time.slice(0, 5)} {t("manageDetails.uhr")}</span>
          </div>
          <div className="pt-3 border-t border-border">
            <span className="font-semibold text-foreground">€{booking.total_amount}</span>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {booking.canModify ? (
        <div className="space-y-3">
          <Button className="w-full" size="lg" onClick={onReschedule}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("manageDetails.reschedule")}
          </Button>
          <Button
            variant="outline"
            className="w-full text-destructive hover:text-destructive"
            size="lg"
            onClick={() => setShowCancelDialog(true)}
          >
            <XCircle className="h-4 w-4 mr-2" />
            {t("manageDetails.cancel")}
          </Button>
        </div>
      ) : (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 text-center">
            <p className="text-amber-800 font-medium">
              {t("manageDetails.tooLate", { hours: booking.hoursUntil })}
            </p>
            <p className="text-amber-700 text-sm mt-1">
              {t("manageDetails.tooLateNote")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Cancel dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("bookings.cancelTitle")}</DialogTitle>
            <DialogDescription>{t("bookings.cancelDescription")}</DialogDescription>
          </DialogHeader>
          {cancelError && (
            <p className="text-sm text-destructive">{cancelError}</p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)} disabled={isCancelling}>
              {t("bookings.cancelKeep")}
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await onCancel();
                setShowCancelDialog(false);
              }}
              disabled={isCancelling}
            >
              {isCancelling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              {t("bookings.cancelConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
