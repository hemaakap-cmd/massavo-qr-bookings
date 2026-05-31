import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { QrCode, Download, Building2, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeCanvas } from "qrcode.react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

interface Gym {
  id: string;
  name: string;
  address: string;
  cities?: { name: string };
}

const ScanQR = () => {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);

  useEffect(() => {
    const fetchGyms = async () => {
      // Use admin gyms table - qr_code_id is only accessible to admins
      const { data, error } = await supabase
        .from("gyms")
        .select("id, name, address, cities(name)")
        .order("name");

      if (!error && data) {
        setGyms(data);
        if (data.length > 0) {
          setSelectedGym(data[0]);
        }
      }
      setLoading(false);
    };

    fetchGyms();
  }, []);

  // Use published URL for QR codes so customers can access them
  const PUBLISHED_URL = "https://massavo-qr-bookings.lovable.app";
  
  const getBookingUrl = (gymId: string) => {
    return `${PUBLISHED_URL}/gym/${gymId}`;
  };

  const downloadQRCode = (gym: Gym) => {
    const canvas = document.getElementById(`qr-${gym.id}`) as HTMLCanvasElement;
    if (!canvas) return;

    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `massavo-qr-${gym.name.toLowerCase().replace(/\s+/g, "-")}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <QrCode className="w-4 h-4" />
              QR-Codes
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
              Dein Gym <span className="text-primary">QR-Code</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Wähle dein Gym aus und lade den QR-Code herunter. Kunden können diesen scannen, um direkt zur Buchungsseite zu gelangen.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : gyms.length === 0 ? (
            <div className="text-center py-20">
              <Building2 className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-muted-foreground">Noch keine Gyms verfügbar.</p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Gym Selector */}
              <div className="space-y-4">
                <h2 className="font-display text-xl font-semibold text-foreground mb-4">
                  Wähle ein Gym
                </h2>
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {gyms.map((gym) => (
                    <button
                      key={gym.id}
                      onClick={() => setSelectedGym(gym)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        selectedGym?.id === gym.id
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-border bg-card hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          selectedGym?.id === gym.id ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}>
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate">{gym.name}</h3>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{gym.cities?.name}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* QR Code Display */}
              {selectedGym && (
                <div className="bg-card border border-border rounded-2xl p-8 text-center">
                  <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                    {selectedGym.name}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    {selectedGym.address}
                  </p>

                  {/* QR Code */}
                  <div className="flex flex-col items-center mb-6">
                    <div className="p-6 bg-white rounded-2xl shadow-lg">
                      <QRCodeCanvas
                        id={`qr-${selectedGym.id}`}
                        value={getBookingUrl(selectedGym.id)}
                        size={240}
                        level="H"
                        includeMargin
                      />
                    </div>
                    {/* Gym & City Label */}
                    <div className="mt-4 text-center">
                      <p className="text-base font-semibold text-foreground">{selectedGym.name}</p>
                      {selectedGym.cities?.name && (
                        <p className="text-sm text-muted-foreground">{selectedGym.cities.name}</p>
                      )}
                    </div>
                  </div>

                  {/* Booking URL */}
                  <div className="bg-muted/50 rounded-lg p-3 mb-6">
                    <p className="text-xs text-muted-foreground mb-1">Buchungs-URL:</p>
                    <p className="text-sm font-mono text-foreground break-all">
                      {getBookingUrl(selectedGym.id)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      variant="sage"
                      className="flex-1"
                      onClick={() => downloadQRCode(selectedGym)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      QR-Code herunterladen
                    </Button>
                    <Button variant="luxuryOutline" className="flex-1" asChild>
                      <Link to={`/print-qr?gym=${selectedGym.id}&name=${encodeURIComponent(selectedGym.name)}`}>
                        Druckversion
                      </Link>
                    </Button>
                  </div>

                  {/* Instructions */}
                  <div className="mt-8 pt-6 border-t border-border text-left">
                    <h3 className="font-semibold text-foreground mb-3">So funktioniert's:</h3>
                    <ol className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                        <span>Lade den QR-Code herunter oder drucke ihn aus</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                        <span>Platziere den QR-Code gut sichtbar im Gym</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                        <span>Kunden scannen den Code und buchen direkt ihre Massage</span>
                      </li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ScanQR;
