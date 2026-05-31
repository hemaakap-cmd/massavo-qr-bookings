import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { de, ar, enUS, type Locale } from "date-fns/locale";
import { useTranslation } from "react-i18next";

interface Props {
  type: "reschedule" | "cancel";
  newDate?: string;
  newTime?: string;
  serviceName: string;
  gymName: string;
}

const localeMap: Record<string, Locale> = { de, ar, en: enUS };

export function ManageBookingSuccess({ type, newDate, newTime, serviceName, gymName }: Props) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isReschedule = type === "reschedule";
  const dateLocale = localeMap[i18n.language] || enUS;

  return (
    <Card>
      <CardContent className="pt-10 pb-8 text-center space-y-4">
        <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
          isReschedule ? "bg-green-100" : "bg-red-100"
        }`}>
          {isReschedule ? (
            <CheckCircle className="h-8 w-8 text-green-600" />
          ) : (
            <XCircle className="h-8 w-8 text-red-600" />
          )}
        </div>

        <h2 className="font-display text-2xl font-bold">
          {isReschedule ? t("manageBookingSuccess.rescheduled") : t("manageBookingSuccess.cancelled")}
        </h2>

        <p className="text-muted-foreground">
          {isReschedule ? t("manageBookingSuccess.rescheduledDesc") : t("manageBookingSuccess.cancelledDesc")}
        </p>

        {isReschedule && newDate && newTime && (
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg inline-block mx-auto">
            <p className="font-semibold text-green-800">
              {format(parseISO(newDate), "EEEE, d. MMMM yyyy", { locale: dateLocale })}
            </p>
            <p className="text-green-700">{newTime} • {serviceName} • {gymName}</p>
          </div>
        )}

        <Button variant="outline" onClick={() => navigate("/")} className="mt-4">
          <Home className="h-4 w-4 me-2" /> {t("manageBookingSuccess.backHome")}
        </Button>
      </CardContent>
    </Card>
  );
}
