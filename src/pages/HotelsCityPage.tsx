import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { ChevronLeft, MapPin, Hotel as HotelIcon, Star, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface HotelRow {
  id: string;
  name: string;
  address: string;
  image_url: string | null;
  star_rating: number | null;
  rating: number | null;
  open_hours: string | null;
}

interface City {
  id: string;
  name: string;
  country: string;
}

const HotelsCityPage = () => {
  const { t } = useTranslation();
  const { cityId } = useParams();
  const [city, setCity] = useState<City | null>(null);
  const [hotels, setHotels] = useState<HotelRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!cityId) return;
      setLoading(true);
      const [cityRes, hotelsRes] = await Promise.all([
        supabase.from("cities").select("id, name, country").eq("id", cityId).maybeSingle(),
        supabase
          .from("hotels")
          .select("id, name, address, image_url, star_rating, rating, open_hours")
          .eq("city_id", cityId)
          .eq("is_active", true)
          .order("name"),
      ]);
      if (cityRes.data) setCity(cityRes.data as City);
      setHotels((hotelsRes.data || []) as HotelRow[]);
      setLoading(false);
    };
    fetchData();
  }, [cityId]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SEO
        title={city ? t("hotels.cityHotels", { city: city.name }) : t("hotels.pageTitle")}
        description={t("hotels.seoDescription")}
        path={`/hotels/city/${cityId || ""}`}
      />
      <Header />
      <main className="pt-24 pb-16">
        <section className="bg-sage-light py-6">
          <div className="container mx-auto px-4">
            <Button variant="ghost" size="sm" asChild className="mb-4">
              <Link to="/hotels">
                <ChevronLeft className="w-4 h-4" />
                {t("hotels.backToCities")}
              </Link>
            </Button>
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
              <MapPin className="w-4 h-4" />
              {city?.country || ""}
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">
              {city ? t("hotels.cityHotels", { city: city.name }) : "..."}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
              <span className="flex items-center gap-2">
                <HotelIcon className="w-4 h-4" />
                {hotels.length} {t("hotels.partnerHotels")}
              </span>
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="container mx-auto px-4">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : hotels.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                {t("hotels.noHotelsInCity")}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                {hotels.map((h, idx) => (
                  <Link
                    key={h.id}
                    to={`/hotel/${h.id}`}
                    className="group glass rounded-2xl overflow-hidden border border-border/50 hover:border-primary/40 hover:shadow-lg transition-all animate-fade-up"
                    style={{ animationDelay: `${idx * 0.05}s` }}
                  >
                    {h.image_url ? (
                      <div className="aspect-video w-full overflow-hidden bg-muted">
                        <img
                          src={h.image_url}
                          alt={h.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video w-full flex items-center justify-center bg-muted">
                        <HotelIcon className="w-12 h-12 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-display text-lg font-bold leading-tight">{h.name}</h3>
                        {h.star_rating ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary shrink-0">
                            {h.star_rating}
                            <Star className="w-3 h-3 fill-current" />
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{h.address}</span>
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default HotelsCityPage;