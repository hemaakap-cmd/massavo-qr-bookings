import { useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { QrCode, Download, Printer, Copy, Check, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface HotelQRCodeProps {
  hotelId: string;
  hotelName: string;
  cityName?: string;
  size?: number;
}

const PUBLISHED_URL = "https://massavo-qr-bookings.lovable.app";

const HotelQRCode = ({ hotelId, hotelName, cityName, size = 220 }: HotelQRCodeProps) => {
  const { toast } = useToast();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bookingUrl = `${PUBLISHED_URL}/hotel/${hotelId}`;
  const safeName = hotelName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const downloadPng = () => {
    try {
      const canvas = document.getElementById(`hotel-qr-canvas-${hotelId}`) as HTMLCanvasElement | null;
      if (!canvas) throw new Error("QR canvas not ready");
      // Create high-res scaled canvas (1024px) for print quality
      const target = document.createElement("canvas");
      const PRINT_SIZE = 1024;
      target.width = PRINT_SIZE;
      target.height = PRINT_SIZE;
      const ctx = target.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, PRINT_SIZE, PRINT_SIZE);
      ctx.drawImage(canvas, 0, 0, PRINT_SIZE, PRINT_SIZE);
      const url = target.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = `massavo-hotel-${safeName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e: any) {
      setError(e.message || "Failed to download PNG");
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    }
  };

  const downloadSvg = () => {
    try {
      const svg = svgRef.current;
      if (!svg) throw new Error("QR SVG not ready");
      const serializer = new XMLSerializer();
      const source =
        '<?xml version="1.0" standalone="no"?>\n' + serializer.serializeToString(svg);
      const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `massavo-hotel-${safeName}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || "Failed to download SVG");
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      toast({ title: "Link copied", description: bookingUrl });
      setTimeout(() => setCopied(false), 2000);
    } catch (e: any) {
      toast({ title: "Copy failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <QrCode className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">QR-Code für Gäste</h3>
          <p className="text-sm text-muted-foreground">Zum Scannen und Buchen</p>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-md p-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col items-center mb-6">
          <div className="p-4 bg-white rounded-xl shadow-md">
            {/* Visible canvas (for PNG export) */}
            <QRCodeCanvas
              id={`hotel-qr-canvas-${hotelId}`}
              value={bookingUrl}
              size={size}
              level="H"
              includeMargin
            />
            {/* Hidden SVG (for SVG export) */}
            <div className="hidden">
              <QRCodeSVG
                ref={svgRef as any}
                value={bookingUrl}
                size={size}
                level="H"
                includeMargin
              />
            </div>
          </div>
          <div className="mt-3 text-center">
            <p className="text-sm font-semibold text-foreground">{hotelName}</p>
            {cityName && <p className="text-xs text-muted-foreground">{cityName}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={downloadPng}>
            <Download className="w-4 h-4 mr-1" />
            PNG
          </Button>
          <Button variant="outline" size="sm" onClick={downloadSvg}>
            <Download className="w-4 h-4 mr-1" />
            SVG
          </Button>
          <Button variant="outline" size="sm" onClick={copyLink}>
            {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
            {copied ? "Kopiert" : "Link"}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/print-qr?hotel=${hotelId}&name=${encodeURIComponent(hotelName)}`}>
              <Printer className="w-4 h-4 mr-1" />
              Drucken
            </Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Platziere diesen QR-Code im Hotel. Gäste scannen ihn, um direkt zu buchen.
        </p>
      </div>
    </div>
  );
};

export default HotelQRCode;