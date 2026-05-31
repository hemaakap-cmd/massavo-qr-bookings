import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { QrCode, Download, Printer, Copy, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface GymQRCodeProps {
  gymId: string;
  gymName: string;
  cityName?: string;
}

const GymQRCode = ({ gymId, gymName, cityName }: GymQRCodeProps) => {
  // Use published URL for QR codes so customers can access them
  const PUBLISHED_URL = "https://massavo-qr-bookings.lovable.app";
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const getBookingUrl = () => {
    return `${PUBLISHED_URL}/gym/${gymId}`;
  };

  const downloadQRCode = () => {
    const canvas = document.getElementById(`gym-qr-${gymId}`) as HTMLCanvasElement;
    if (!canvas) return;

    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `massavo-qr-${gymName.toLowerCase().replace(/\s+/g, "-")}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(getBookingUrl());
      setCopied(true);
      toast({ title: "Link kopiert", description: getBookingUrl() });
      setTimeout(() => setCopied(false), 2000);
    } catch (e: any) {
      toast({ title: "Kopieren fehlgeschlagen", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <QrCode className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">QR-Code für Kunden</h3>
          <p className="text-sm text-muted-foreground">Zum Scannen und Buchen</p>
        </div>
      </div>

      {/* QR Code Content - Always Visible */}
      <div className="p-6">
        {/* QR Code */}
        <div className="flex flex-col items-center mb-6">
          <div className="p-4 bg-white rounded-xl shadow-md">
            <QRCodeCanvas
              id={`gym-qr-${gymId}`}
              value={getBookingUrl()}
              size={180}
              level="H"
              includeMargin
            />
          </div>
          {/* Gym & City Label */}
          <div className="mt-3 text-center">
            <p className="text-sm font-semibold text-foreground">{gymName}</p>
            {cityName && (
              <p className="text-xs text-muted-foreground">{cityName}</p>
            )}
          </div>
        </div>

        {/* URL hidden from end users – QR code remains scannable */}

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadQRCode}
          >
            <Download className="w-4 h-4 mr-1" />
            Download
          </Button>
          <Button variant="outline" size="sm" onClick={copyLink}>
            {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
            {copied ? "Kopiert" : "Link"}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/print-qr?gym=${gymId}&name=${encodeURIComponent(gymName)}`}>
              <Printer className="w-4 h-4 mr-1" />
              Drucken
            </Link>
          </Button>
        </div>

        {/* Instructions */}
        <p className="text-xs text-muted-foreground text-center mt-4">
          Platziere diesen QR-Code im Gym. Kunden scannen ihn, um direkt zu buchen.
        </p>
      </div>
    </div>
  );
};

export default GymQRCode;
