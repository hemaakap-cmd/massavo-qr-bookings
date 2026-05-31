import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, ExternalLink, Building2, Hotel as HotelIcon } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useAuth } from "@/hooks/useAuth";
import { useCountryData } from "@/hooks/useCountry";

interface Gym {
  id: string;
  name: string;
  qr_code_id: string;
  address: string;
  cities?: { name: string };
}

interface HotelEntity {
  id: string;
  name: string;
  qr_code_id: string;
  address: string;
  cities?: { name: string };
}

const AdminQRCodes = () => {
  const { countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [hotels, setHotels] = useState<HotelEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const qrRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  const fetchData = async () => {
    let gymQuery = supabase
      .from("gyms")
      .select("id, name, qr_code_id, address, cities(name)")
      .order("name");
    let hotelQuery = supabase
      .from("hotels")
      .select("id, name, qr_code_id, address, cities(name)")
      .order("name");

    if (selectedCountry?.id) {
      gymQuery = gymQuery.eq("country_id", selectedCountry.id);
      hotelQuery = hotelQuery.eq("country_id", selectedCountry.id);
    }

    const [{ data: gymData, error: gymErr }, { data: hotelData, error: hotelErr }] = await Promise.all([
      gymQuery,
      hotelQuery,
    ]);

    if (gymErr) toast({ title: "Error", description: gymErr.message, variant: "destructive" });
    else setGyms(gymData || []);
    if (hotelErr) toast({ title: "Error", description: hotelErr.message, variant: "destructive" });
    else setHotels((hotelData as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedCountry?.id]);

  const PUBLISHED_URL = "https://massavo-qr-bookings.lovable.app";
  const getBookingUrl = (id: string, type: "gym" | "hotel" = "gym") =>
    `${PUBLISHED_URL}/${type}/${id}`;

  const setQrRef = useCallback((gymId: string) => (el: HTMLCanvasElement | null) => {
    if (el) {
      qrRefs.current.set(gymId, el);
    }
  }, []);

  const downloadQRCode = async (entity: { id: string; name: string; qr_code_id: string }) => {
    const canvas = qrRefs.current.get(entity.id);
    
    if (!canvas) {
      toast({ title: "Error", description: "QR code not ready", variant: "destructive" });
      return;
    }

    try {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-code-${entity.qr_code_id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast({ title: "Downloaded", description: `QR code for ${entity.name} downloaded` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to download QR code", variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">QR Codes</h2>
          <p className="text-muted-foreground">
            Generate and download QR codes for each gym. Place these at gym locations for easy booking access.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-sage" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mt-2">
              <Building2 className="w-5 h-5 text-primary" />
              <h3 className="font-display text-xl font-semibold">Gyms</h3>
            </div>
            {gyms.length === 0 ? (
              <div className="text-sm text-muted-foreground">No gyms found.</div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gyms.map((gym) => (
              <Card key={gym.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{gym.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{gym.cities?.name}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-center p-4 bg-white rounded-lg">
                    <QRCodeCanvas
                      value={getBookingUrl(gym.id)}
                      size={128}
                      level="H"
                      ref={setQrRef(gym.id)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">QR ID:</span> {gym.qr_code_id}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      <span className="font-medium">Address:</span> {gym.address}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => downloadQRCode(gym)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                    >
                      <a
                        href={`/gym/${gym.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            </div>
            )}

            <div className="flex items-center gap-2 mt-8">
              <HotelIcon className="w-5 h-5 text-primary" />
              <h3 className="font-display text-xl font-semibold">Hotels</h3>
            </div>
            {hotels.length === 0 ? (
              <div className="text-sm text-muted-foreground">No hotels found.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {hotels.map((hotel) => (
                  <Card key={hotel.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{hotel.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{hotel.cities?.name}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-center p-4 bg-white rounded-lg">
                        <QRCodeCanvas
                          value={getBookingUrl(hotel.id, "hotel")}
                          size={128}
                          level="H"
                          ref={setQrRef(hotel.id)}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">QR ID:</span> {hotel.qr_code_id}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          <span className="font-medium">Address:</span> {hotel.address}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => downloadQRCode(hotel)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <a
                            href={`/hotel/${hotel.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminQRCodes;
