import { useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import massavoPrintLogo from "@/assets/massavo-print-logo.png";
import { COMPANY_INFO, PRINT_STYLES } from "@/constants/branding";

const PrintQR = () => {
  const [searchParams] = useSearchParams();
  const gymId = searchParams.get("gym");
  const hotelId = searchParams.get("hotel");
  const venueType: "gym" | "hotel" = hotelId ? "hotel" : "gym";
  const venueId = hotelId || gymId || "massavo";
  const gymName = searchParams.get("name") || "MASSAVO";

  // Generate the booking URL
  const bookingUrl = `${window.location.origin}/${venueType}/${venueId}`;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const svg = document.getElementById("qr-code-svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = 2000;
      canvas.height = 2000;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, 2000, 2000);
        
        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
          downloadLink.download = `massavo-qr-${venueType}-${venueId}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div 
      className="min-h-screen bg-white"
      style={{ fontFamily: PRINT_STYLES.fonts.body }}
    >
      {/* Watermark for print */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none print:block hidden z-0">
        <div className="flex flex-col items-center">
          <img 
            src={massavoPrintLogo} 
            alt="" 
            className="w-[500px] h-[500px] opacity-[0.03] object-contain"
          />
          <span 
            className="text-7xl font-bold tracking-widest"
            style={{ 
              color: "rgba(0,0,0,0.02)",
              fontFamily: PRINT_STYLES.fonts.display,
            }}
          >
            {COMPANY_INFO.name}
          </span>
        </div>
      </div>

      {/* Print-only content */}
      <div className="print-content flex flex-col items-center justify-center min-h-screen p-8 relative z-10">
        {/* Header with branding */}
        <div className="mb-8 text-center">
          <div className="flex flex-col items-center gap-4 mb-4">
            <img 
              src={massavoPrintLogo} 
              alt={COMPANY_INFO.name}
              className="w-28 h-28 object-contain"
            />
            <h1 
              className="text-5xl md:text-6xl font-bold"
              style={{ 
                color: PRINT_STYLES.colors.primary,
                fontFamily: PRINT_STYLES.fonts.display,
              }}
            >
              {COMPANY_INFO.name}
            </h1>
          </div>
          <p className="text-xl" style={{ color: PRINT_STYLES.colors.textMuted }}>
            {COMPANY_INFO.tagline}
          </p>
        </div>

        {/* QR Code with professional border */}
        <div 
          className="bg-white p-8 rounded-3xl shadow-2xl mb-8"
          style={{ border: `4px solid ${PRINT_STYLES.colors.accent}` }}
        >
          <QRCodeSVG
            id="qr-code-svg"
            value={bookingUrl}
            size={400}
            level="H"
            includeMargin={true}
            fgColor={PRINT_STYLES.colors.primary}
            bgColor="#FFFFFF"
          />
        </div>

        {/* Instructions */}
        <div className="text-center max-w-md">
          <h2 
            className="text-2xl md:text-3xl font-bold mb-3"
            style={{ 
              color: PRINT_STYLES.colors.primary,
              fontFamily: PRINT_STYLES.fonts.display,
            }}
          >
            Scan & Book
          </h2>
          <p className="text-lg" style={{ color: PRINT_STYLES.colors.textMuted }}>
            Scanne den QR-Code mit deinem Handy
          </p>
          <p className="text-lg" style={{ color: PRINT_STYLES.colors.textMuted }}>
            und buche deine Massage in 30 Sekunden!
          </p>
          
          {gymName !== "MASSAVO" && (
            <div 
              className="mt-6 pt-6"
              style={{ borderTop: `2px solid ${PRINT_STYLES.colors.headerBorder}40` }}
            >
              <p className="text-sm" style={{ color: PRINT_STYLES.colors.textMuted }}>
                Partner Location
              </p>
              <p 
                className="text-xl font-bold"
                style={{ 
                  color: PRINT_STYLES.colors.primary,
                  fontFamily: PRINT_STYLES.fonts.display,
                }}
              >
                {gymName}
              </p>
            </div>
          )}
        </div>

        {/* Footer with full company details */}
        <div 
          className="mt-12 pt-6 text-center w-full max-w-lg"
          style={{ borderTop: `2px solid ${PRINT_STYLES.colors.headerBorder}40` }}
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <img 
              src={massavoPrintLogo} 
              alt={COMPANY_INFO.name}
              className="w-10 h-10 object-contain opacity-70"
            />
            <span 
              className="font-bold text-lg"
              style={{ color: PRINT_STYLES.colors.primary }}
            >
              {COMPANY_INFO.name}
            </span>
          </div>
          
          {/* Contact Details Grid */}
          <div className="grid grid-cols-3 gap-4 text-sm mb-4">
            <div>
              <p className="font-medium" style={{ color: PRINT_STYLES.colors.text }}>Website</p>
              <p style={{ color: PRINT_STYLES.colors.textMuted }}>{COMPANY_INFO.website}</p>
            </div>
            <div>
              <p className="font-medium" style={{ color: PRINT_STYLES.colors.text }}>Email</p>
              <p style={{ color: PRINT_STYLES.colors.textMuted }}>{COMPANY_INFO.email}</p>
            </div>
            <div>
              <p className="font-medium" style={{ color: PRINT_STYLES.colors.text }}>Social</p>
              <p style={{ color: PRINT_STYLES.colors.textMuted }}>{COMPANY_INFO.social.instagram}</p>
            </div>
          </div>
          
          <p className="text-sm" style={{ color: PRINT_STYLES.colors.textMuted }}>
            {COMPANY_INFO.address}
          </p>
          <p className="text-xs mt-2" style={{ color: "#9ca3af" }}>
            {COMPANY_INFO.services}
          </p>
        </div>
      </div>

      {/* Screen-only controls */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 print:hidden z-50">
        <Button
          onClick={handlePrint}
          className="shadow-lg text-white"
          style={{ backgroundColor: PRINT_STYLES.colors.accent }}
          size="lg"
        >
          <Printer className="w-5 h-5 mr-2" />
          Drucken
        </Button>
        <Button
          onClick={handleDownload}
          variant="outline"
          size="lg"
          className="shadow-lg bg-white"
          style={{ 
            borderColor: PRINT_STYLES.colors.accent,
            color: PRINT_STYLES.colors.primary,
          }}
        >
          <Download className="w-5 h-5 mr-2" />
          Als PNG herunterladen
        </Button>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .print-content {
            width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PrintQR;
