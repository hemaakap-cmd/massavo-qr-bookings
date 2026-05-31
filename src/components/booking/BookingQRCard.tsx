import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Download, Printer, QrCode } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface BookingQRCardProps {
  bookingId: string;
  token: string;
  /** Origin used in the encoded URL. Defaults to window.location.origin. */
  origin?: string;
}

/**
 * Per-booking QR card. Encodes a self-management URL with the booking's
 * cancellation_token so the customer (or staff) can pull up the booking.
 * This is fully separate from the permanent gym QR code.
 */
export function BookingQRCard({ bookingId, token, origin }: BookingQRCardProps) {
  const { t } = useTranslation();
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  const manageUrl = `${base}/manage-booking?token=${token}`;
  const canvasId = `booking-qr-${bookingId}`;

  const downloadPng = () => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `massavo-booking-${bookingId.slice(0, 8)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <QrCode className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{t("bookingQr.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("bookingQr.subtitle")}</p>
        </div>
      </div>
      <div className="p-6">
        <div className="flex flex-col items-center mb-6">
          <div className="p-4 bg-white rounded-xl shadow-md">
            <QRCodeCanvas id={canvasId} value={manageUrl} size={180} level="H" includeMargin />
          </div>
          <p className="mt-3 text-xs text-muted-foreground font-mono">
            #{bookingId.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={downloadPng}>
            <Download className="w-4 h-4 mr-1" />
            {t("bookingQr.download")}
          </Button>
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link to={`/print-booking?token=${token}`} target="_blank" rel="noopener noreferrer">
              <Printer className="w-4 h-4 mr-1" />
              {t("bookingQr.print")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default BookingQRCard;