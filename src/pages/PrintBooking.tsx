import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import massavoLogo from "@/assets/massavo-logo-3d.png";

interface BookingLookup {
  id: string;
  booking_date: string;
  booking_time: string;
  status: string;
  customer_name: string;
  gymName: string;
  gymAddress: string;
  serviceName: string;
  serviceDuration: number;
  therapistName: string | null;
  total_amount: number;
}

const PrintBooking = () => {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [booking, setBooking] = useState<BookingLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setError(t("printBooking.missingToken"));
        setLoading(false);
        return;
      }
      try {
        const { data, error: fnError } = await supabase.functions.invoke("manage-booking", {
          body: { token, action: "lookup" },
        });
        if (fnError || !data?.success) {
          setError(data?.error || t("printBooking.notFound"));
        } else {
          setBooking(data.booking);
        }
      } catch (e) {
        console.error(e);
        setError(t("printBooking.notFound"));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [token, t]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const manageUrl = `${window.location.origin}/manage-booking?token=${token}`;
  const dateStr = new Date(booking.booking_date).toLocaleDateString(i18n.language, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="min-h-screen bg-white text-stone-900" style={{ fontFamily: "system-ui, sans-serif" }}>
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 1cm; } }`}</style>

      <div className="no-print sticky top-0 bg-white border-b border-stone-200 p-4 flex justify-end">
        <Button onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" />
          {t("printBooking.printButton")}
        </Button>
      </div>

      <div className="max-w-2xl mx-auto p-8">
        <div className="flex items-center justify-between mb-8 pb-6 border-b-2 border-stone-200">
          <div className="flex items-center gap-3">
            <img src={massavoLogo} alt="MASSAVO" className="w-12 h-12" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">MASSAVO</h1>
              <p className="text-xs text-stone-500">{t("printBooking.confirmation")}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-stone-500">{t("printBooking.bookingId")}</p>
            <p className="font-mono text-sm font-semibold">#{booking.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="space-y-4">
            <Row label={t("printBooking.client")} value={booking.customer_name} />
            <Row label={t("printBooking.date")} value={dateStr} />
            <Row label={t("printBooking.time")} value={booking.booking_time.slice(0, 5)} />
            <Row label={t("printBooking.duration")} value={`${booking.serviceDuration} min`} />
            <Row label={t("printBooking.service")} value={booking.serviceName} />
            <Row
              label={t("printBooking.therapist")}
              value={booking.therapistName || t("printBooking.therapistTba")}
            />
            <Row label={t("printBooking.location")} value={booking.gymName} />
            <p className="text-sm text-stone-600">{booking.gymAddress}</p>
          </div>
          <div className="flex flex-col items-center justify-start">
            <div className="p-3 bg-white border border-stone-200 rounded-lg">
              <QRCodeCanvas value={manageUrl} size={180} level="H" includeMargin />
            </div>
            <p className="mt-2 text-xs text-stone-500 text-center">
              {t("printBooking.qrHint")}
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-stone-200 text-xs text-stone-500 text-center">
          MASSAVO · info@massavo.com · +49 160 5652154
        </div>
      </div>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs uppercase tracking-wider text-stone-500">{label}</p>
    <p className="text-base font-medium">{value}</p>
  </div>
);

export default PrintBooking;