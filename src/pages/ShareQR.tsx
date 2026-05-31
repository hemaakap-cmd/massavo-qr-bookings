import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MapPin, Building2, Share2, MessageCircle, Mail, Download, ArrowLeft, ExternalLink } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

interface City {
  id: string;
  name: string;
  country: string;
  image_url: string | null;
}

interface Gym {
  id: string;
  name: string;
  address: string;
  cities?: { name: string };
}

const ShareQR = () => {
  const [cities, setCities] = useState<City[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [citiesRes, gymsRes] = await Promise.all([
      supabase.from("cities").select("*").eq("is_active", true).order("name"),
      // Use admin gyms table - QR sharing is an admin feature
      supabase.from("gyms").select("id, name, address, cities(name)").order("name"),
    ]);

    if (citiesRes.data) setCities(citiesRes.data);
    if (gymsRes.data) setGyms(gymsRes.data);
    setLoading(false);
  };

  const getBookingUrl = (type: "city" | "gym", id: string) => {
    const baseUrl = window.location.origin;
    return type === "city" ? `${baseUrl}/city/${id}` : `${baseUrl}/gym/${id}`;
  };

  const shareViaWhatsApp = (name: string, url: string) => {
    const text = encodeURIComponent(`Buche jetzt deine Massage bei ${name}! 💆‍♂️\n\n${url}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const shareViaEmail = (name: string, url: string) => {
    const subject = encodeURIComponent(`Massage buchen bei ${name}`);
    const body = encodeURIComponent(`Hallo!\n\nBuche jetzt deine Massage bei ${name}:\n${url}\n\nViele Grüße`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const downloadQRCode = (canvasId: string, name: string) => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) return;
    
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-code-${name.toLowerCase().replace(/\s+/g, "-")}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filteredGyms = selectedCity 
    ? gyms.filter(gym => gym.cities?.name === selectedCity)
    : gyms;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-24">
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" />
            Zurück
          </Link>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">
            QR-Codes teilen
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Teile unsere QR-Codes über WhatsApp oder E-Mail, damit deine Freunde auch einfach eine Massage buchen können.
          </p>
        </div>

        <Tabs defaultValue="gyms" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="gyms" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Gyms
            </TabsTrigger>
            <TabsTrigger value="cities" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Städte
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gyms" className="space-y-6">
            {/* City Filter */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCity === null ? "sage" : "outline"}
                size="sm"
                onClick={() => setSelectedCity(null)}
              >
                Alle
              </Button>
              {cities.map((city) => (
                <Button
                  key={city.id}
                  variant={selectedCity === city.name ? "sage" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCity(city.name)}
                >
                  {city.name}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGyms.map((gym) => (
                <QRCard
                  key={gym.id}
                  id={gym.id}
                  name={gym.name}
                  subtitle={gym.cities?.name || gym.address}
                  url={getBookingUrl("gym", gym.id)}
                  type="gym"
                  onWhatsApp={() => shareViaWhatsApp(gym.name, getBookingUrl("gym", gym.id))}
                  onEmail={() => shareViaEmail(gym.name, getBookingUrl("gym", gym.id))}
                  onDownload={() => downloadQRCode(`qr-gym-${gym.id}`, gym.name)}
                  canvasId={`qr-gym-${gym.id}`}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="cities" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cities.map((city) => (
                <QRCard
                  key={city.id}
                  id={city.id}
                  name={city.name}
                  subtitle={city.country}
                  url={getBookingUrl("city", city.id)}
                  type="city"
                  onWhatsApp={() => shareViaWhatsApp(city.name, getBookingUrl("city", city.id))}
                  onEmail={() => shareViaEmail(city.name, getBookingUrl("city", city.id))}
                  onDownload={() => downloadQRCode(`qr-city-${city.id}`, city.name)}
                  canvasId={`qr-city-${city.id}`}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
};

interface QRCardProps {
  id: string;
  name: string;
  subtitle: string;
  url: string;
  type: "city" | "gym";
  onWhatsApp: () => void;
  onEmail: () => void;
  onDownload: () => void;
  canvasId: string;
}

const QRCard = ({ id, name, subtitle, url, type, onWhatsApp, onEmail, onDownload, canvasId }: QRCardProps) => {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Share2 className="w-5 h-5 text-primary" />
          {name}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center p-4 bg-white rounded-lg border">
          <QRCodeCanvas
            id={canvasId}
            value={url}
            size={160}
            level="H"
            includeMargin
          />
        </div>

        <div className="text-xs text-muted-foreground text-center truncate px-2">
          {url}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="luxuryOutline"
            size="sm"
            onClick={onWhatsApp}
            className="flex-col h-auto py-3 gap-1"
          >
            <MessageCircle className="w-5 h-5 text-primary" />
            <span className="text-xs">WhatsApp</span>
          </Button>
          <Button
            variant="luxuryOutline"
            size="sm"
            onClick={onEmail}
            className="flex-col h-auto py-3 gap-1"
          >
            <Mail className="w-5 h-5 text-primary" />
            <span className="text-xs">E-Mail</span>
          </Button>
          <Button
            variant="luxuryOutline"
            size="sm"
            onClick={onDownload}
            className="flex-col h-auto py-3 gap-1"
          >
            <Download className="w-5 h-5 text-primary" />
            <span className="text-xs">Download</span>
          </Button>
        </div>

        {/* View Detail Link */}
        <Button variant="ghost" size="sm" asChild className="w-full">
          <Link to={`/qr/${id}?type=${type}`}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Detailansicht öffnen
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};

export default ShareQR;
