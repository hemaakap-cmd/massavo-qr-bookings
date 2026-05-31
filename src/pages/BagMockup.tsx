import { useSearchParams, Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download } from "lucide-react";
import bagMockup from "@/assets/bag-mockup.jpg";
import massavoLogo from "@/assets/massavo-logo.png";

const BagMockup = () => {
  const [searchParams] = useSearchParams();
  const gymId = searchParams.get("gym") || "massavo";
  const gymName = searchParams.get("name") || "MASSAVO";
  
  // Generate the booking URL
  const bookingUrl = `${window.location.origin}/gym/${gymId}`;

  const handleDownload = () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = 1200;
      canvas.height = 1200;
      
      if (ctx) {
        // Draw bag image
        ctx.drawImage(img, 0, 0, 1200, 1200);
        
        // Create QR code overlay
        const qrCanvas = document.createElement("canvas");
        const qrCtx = qrCanvas.getContext("2d");
        qrCanvas.width = 300;
        qrCanvas.height = 300;
        
        // Get QR SVG and convert to image
        const qrSvg = document.getElementById("bag-qr-code");
        if (qrSvg && qrCtx) {
          const svgData = new XMLSerializer().serializeToString(qrSvg);
          const qrImg = new Image();
          qrImg.onload = () => {
            // Position QR code in center of bag
            const qrSize = 280;
            const qrX = (1200 - qrSize) / 2;
            const qrY = (1200 - qrSize) / 2 - 50;
            
            // Draw white background for QR
            ctx.fillStyle = "white";
            ctx.beginPath();
            ctx.roundRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 80, 16);
            ctx.fill();
            
            // Draw QR code
            ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
            
            // Draw text
            ctx.fillStyle = "#5A7A6B";
            ctx.font = "bold 24px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Scan & Book", 600, qrY + qrSize + 35);
            
            // Download
            const pngUrl = canvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.href = pngUrl;
            downloadLink.download = `massavo-bag-mockup-${gymId}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
          };
          qrImg.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
        }
      }
    };
    
    img.src = bagMockup;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <img 
                src={massavoLogo} 
                alt="MASSAVO" 
                className="w-10 h-10 object-contain"
              />
              <span className="font-display text-2xl font-bold text-foreground">
                MASSAVO
              </span>
            </Link>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/print-qr">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Zurück zum QR-Druck
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Title */}
          <div className="text-center mb-12">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
              Bag Mockup Preview
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              So sieht dein QR-Code auf einer Sporttasche aus. Perfekt für Fitness-Studios und Events.
            </p>
          </div>

          {/* Mockup Display */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Bag with QR Overlay */}
            <div className="relative aspect-square max-w-lg mx-auto w-full">
              <img
                src={bagMockup}
                alt="Sports bag mockup"
                className="w-full h-full object-cover rounded-3xl shadow-2xl"
              />
              
              {/* QR Code Overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white p-4 rounded-2xl shadow-xl transform -translate-y-4">
                  <QRCodeSVG
                    id="bag-qr-code"
                    value={bookingUrl}
                    size={160}
                    level="H"
                    includeMargin={false}
                    fgColor="#5A7A6B"
                    bgColor="#FFFFFF"
                  />
                  <p className="text-center text-sm font-semibold text-sage mt-2">
                    Scan & Book
                  </p>
                </div>
              </div>
            </div>

            {/* Info Panel */}
            <div className="space-y-8">
              <div className="bg-card rounded-2xl p-8 shadow-lg border border-border">
                <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                  QR-Code Details
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <span className="text-muted-foreground">Gym/Location</span>
                    <span className="font-semibold text-foreground">{gymName}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <span className="text-muted-foreground">Booking URL</span>
                    <span className="font-mono text-sm text-primary truncate max-w-[200px]">
                      {bookingUrl}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-muted-foreground">Format</span>
                    <span className="font-semibold text-foreground">PNG, 1200x1200px</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={handleDownload}
                  variant="sage"
                  size="lg"
                  className="flex-1"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Mockup herunterladen
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  asChild
                >
                  <Link to="/print-qr">
                    <Printer className="w-5 h-5 mr-2" />
                    Nur QR-Code drucken
                  </Link>
                </Button>
              </div>

              {/* Tips */}
              <div className="bg-sage-light/50 rounded-2xl p-6">
                <h3 className="font-display text-lg font-semibold text-foreground mb-3">
                  💡 Tipps für den Druck
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Verwende hochwertiges Material für langlebige Drucke</li>
                  <li>• Mindestgröße für QR-Codes: 3x3 cm</li>
                  <li>• Teste den QR-Code vor dem finalen Druck</li>
                  <li>• Für individuelle Gym-Branding: ?gym=ID&name=NAME</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Alternative Mockups Preview */}
          <div className="mt-16">
            <h2 className="font-display text-2xl font-bold text-foreground text-center mb-8">
              Weitere Anwendungen
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-card rounded-xl p-6 text-center border border-border">
                <div className="w-16 h-16 bg-sage-light rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🎽</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2">T-Shirts</h3>
                <p className="text-sm text-muted-foreground">Perfekt für Team-Events</p>
              </div>
              <div className="bg-card rounded-xl p-6 text-center border border-border">
                <div className="w-16 h-16 bg-sage-light rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🪧</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2">Banner</h3>
                <p className="text-sm text-muted-foreground">Für Studio-Eingänge</p>
              </div>
              <div className="bg-card rounded-xl p-6 text-center border border-border">
                <div className="w-16 h-16 bg-sage-light rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">📇</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2">Visitenkarten</h3>
                <p className="text-sm text-muted-foreground">Kompakt & professionell</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BagMockup;
