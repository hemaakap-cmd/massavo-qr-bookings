import { useSearchParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useRescheduleResponse } from "@/hooks/useScheduleExceptions";
import { useGymSchedules } from "@/hooks/useGymSchedules";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, CheckCircle, XCircle, CalendarDays, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function RescheduleBooking() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith("en") ? enUS : de;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const preselectedAction = searchParams.get("action");

  const { reschedule, isLoading, isError, respondToReschedule } = useRescheduleResponse(token);
  const { availableDates } = useGymSchedules(reschedule?.booking?.gym_id);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(preselectedAction === "select");

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  if (isError || !reschedule) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-destructive">{t("reschedulePage.invalidLink")}</CardTitle>
              <CardDescription>
                {t("reschedulePage.invalidLinkDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/")} variant="luxuryOutline">
                {t("reschedulePage.backHome")}
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const isExpired = new Date(reschedule.response_deadline) < new Date();
  const isCompleted = reschedule.status !== "pending";

  const handleConfirmSuggested = async () => {
    await respondToReschedule.mutateAsync({ action: "confirm" });
  };

  const handleSelectAlternative = async () => {
    if (!selectedDate || !selectedTime) return;
    await respondToReschedule.mutateAsync({
      action: "select_alternative",
      selectedDate,
      selectedTime,
    });
  };

  const handleCancel = async () => {
    if (confirm(t("reschedulePage.cancelConfirm"))) {
      await respondToReschedule.mutateAsync({ action: "cancel" });
    }
  };

  // Filter future available dates
  const futureAvailableDates = availableDates.filter(
    (d) => new Date(d.available_date) > new Date()
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container max-w-2xl py-12 px-4">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <CalendarDays className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">{t("reschedulePage.title")}</CardTitle>
            <CardDescription>
              {t("reschedulePage.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status Banner */}
            {isCompleted && (
              <div className={`p-4 rounded-lg ${
                reschedule.status === "confirmed" || reschedule.status === "auto_confirmed"
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}>
                <div className="flex items-center gap-2">
                  {reschedule.status === "confirmed" || reschedule.status === "auto_confirmed" ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className="font-medium">
                    {reschedule.status === "confirmed" && t("reschedulePage.statusConfirmed")}
                    {reschedule.status === "auto_confirmed" && t("reschedulePage.statusAutoConfirmed")}
                    {reschedule.status === "declined" && t("reschedulePage.statusDeclined")}
                    {reschedule.status === "auto_cancelled" && t("reschedulePage.statusAutoCancelled")}
                  </span>
                </div>
              </div>
            )}

            {isExpired && !isCompleted && (
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <span className="text-amber-800 font-medium">
                  {t("reschedulePage.deadlineExpired")}
                </span>
              </div>
            )}

            {/* Original Booking Info */}
            <div className="bg-secondary/50 p-4 rounded-lg">
              <h3 className="font-semibold mb-3">{t("reschedulePage.originalAppointment")}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {format(parseISO(reschedule.original_date), "EEEE, d. MMMM yyyy", { locale: dateLocale })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{reschedule.original_time.slice(0, 5)} {t("reschedulePage.uhr")}</span>
                </div>
              </div>
            </div>

            {/* Suggested Alternative */}
            {reschedule.suggested_date && !isCompleted && !isExpired && (
              <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="secondary">{t("reschedulePage.recommended")}</Badge>
                  {t("reschedulePage.alternative")}
                </h3>
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="font-medium">
                      {format(parseISO(reschedule.suggested_date), "EEEE, d. MMMM yyyy", { locale: dateLocale })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="font-medium">
                      {(reschedule.suggested_time || reschedule.original_time).slice(0, 5)} {t("reschedulePage.uhr")}
                    </span>
                  </div>
                </div>
                <Button 
                  onClick={handleConfirmSuggested} 
                  className="w-full"
                  disabled={respondToReschedule.isPending}
                >
                  {respondToReschedule.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  {t("reschedulePage.confirmAlternative")}
                </Button>
              </div>
            )}

            {/* Action Buttons */}
            {!isCompleted && !isExpired && (
              <div className="space-y-3">
                {!showAlternatives ? (
                  <>
                    <Button 
                      variant="luxuryOutline" 
                      className="w-full"
                      onClick={() => setShowAlternatives(true)}
                    >
                      <CalendarDays className="h-4 w-4 mr-2" />
                      {t("reschedulePage.chooseOtherTime")}
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full text-destructive hover:text-destructive"
                      onClick={handleCancel}
                      disabled={respondToReschedule.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      {t("reschedulePage.cancelBooking")}
                    </Button>
                  </>
                ) : (
                  <>
                    <h3 className="font-semibold">{t("reschedulePage.availableTimes")}</h3>
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                      {futureAvailableDates.slice(0, 12).map((date) => (
                        <Button
                          key={date.available_date}
                          variant={selectedDate === date.available_date ? "default" : "outline"}
                          size="sm"
                          className="justify-start"
                          onClick={() => {
                            setSelectedDate(date.available_date);
                            setSelectedTime(reschedule.original_time);
                          }}
                        >
                          {format(parseISO(date.available_date), "EEE, d. MMM", { locale: dateLocale })}
                        </Button>
                      ))}
                    </div>
                    {selectedDate && (
                      <div className="flex gap-2 pt-2">
                        <Button 
                          onClick={handleSelectAlternative}
                          disabled={respondToReschedule.isPending}
                          className="flex-1"
                        >
                          {respondToReschedule.isPending && (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          )}
                          {t("reschedulePage.confirmTime")}
                        </Button>
                        <Button 
                          variant="ghost"
                          onClick={() => {
                            setShowAlternatives(false);
                            setSelectedDate(null);
                          }}
                        >
                          {t("reschedulePage.abort")}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Deadline Info */}
            {!isCompleted && !isExpired && (
              <p className="text-xs text-muted-foreground text-center">
                {t("reschedulePage.respondBy", { date: format(parseISO(reschedule.response_deadline), "d. MMMM yyyy, HH:mm", { locale: dateLocale }) })}
              </p>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
