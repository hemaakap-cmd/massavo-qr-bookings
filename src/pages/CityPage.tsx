import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import GymCard from "@/components/gym/GymCard";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { ChevronLeft, MapPin, Building } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Gym {
  id: string;
  name: string;
  address: string;
  rating: number | null;
  image_url: string | null;
  open_hours: string | null;
  therapistCount?: number;
  therapistNames?: string[];
}

interface City {
  id: string;
  name: string;
  country: string;
}

const CityPage = () => {
  const { t } = useTranslation();
  const { cityId } = useParams();
  const [city, setCity] = useState<City | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!cityId) return;

      // Fetch city info
      const { data: cityData } = await supabase
        .from("cities")
        .select("*")
        .eq("id", cityId)
        .single();

      if (cityData) {
        setCity(cityData);
      }

      // Fetch gyms for this city - use public view that excludes sensitive business data
      const { data: gymsData } = await supabase
        .from("gyms_public")
        .select("id, name, address, city_id, rating, review_count, image_url, open_hours, is_active")
        .eq("city_id", cityId);

      if (gymsData) {
        // Fetch available therapists per gym using public view (no RLS issues)
        const gymIds = gymsData.filter(g => g.id).map(g => g.id!);
        const { data: therapistsData } = await supabase
          .from("therapists_public")
          .select("id, name, gym_id, is_available")
          .in("gym_id", gymIds)
          .eq("is_available", true);

        const gymAvailableCount: Record<string, number> = {};
        (therapistsData || []).forEach((t: any) => {
          if (t.gym_id) {
            gymAvailableCount[t.gym_id] = (gymAvailableCount[t.gym_id] || 0) + 1;
          }
        });

        setGyms(gymsData.map(g => ({
          ...g,
          therapistCount: g.id ? (gymAvailableCount[g.id] || 0) : 0,
          therapistNames: [],
        })));
      }

      setLoading(false);
    };

    fetchData();
  }, [cityId]);

  return (
    <div className="min-h-screen bg-background">
      {city && (
        <SEO
          title={`Massage in ${city.name} | MASSAVO`}
          description={`Buche professionelle Sport-, Klassische und Wellness-Massagen in ${city.name}. Direkt im Fitnessstudio oder Partnerhotel – schnell per QR-Code.`}
          path={`/city/${city.id}`}
          keywords={`massage ${city.name}, fitnessstudio ${city.name}, wellness ${city.name}`}
        />
      )}
      <Header />

      <main className="pt-24 pb-16">
        {/* Breadcrumb */}
        <section className="bg-sage-light py-6">
          <div className="container mx-auto px-4">
            <Button variant="ghost" size="sm" asChild className="mb-4">
              <Link to="/cities">
                <ChevronLeft className="w-4 h-4" />
                {t("cityPage.backToCities")}
              </Link>
            </Button>
            
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
              <MapPin className="w-4 h-4" />
              {city?.country || "Deutschland"}
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">
              {t("cityPage.locationsIn")} {city?.name || "..."}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
              <span className="flex items-center gap-2">
                <Building className="w-4 h-4" />
                {gyms.length} {t("cityPage.gymsSection")}
              </span>
            </div>
          </div>
        </section>

        {/* Venues */}
        <section className="py-12">
          <div className="container mx-auto px-4 space-y-16">
            {loading ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground">{t("cities.loading")}</p>
              </div>
            ) : gyms.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg">{t("cityPage.noVenues")}</p>
              </div>
            ) : (
              <>
                {/* Gyms Section */}
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Building className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="font-display text-2xl md:text-3xl font-bold">
                        {t("cityPage.gymsSection")}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {gyms.length} {t("cityPage.partnerGyms")}
                      </p>
                    </div>
                  </div>
                  {gyms.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {gyms.map((gym, index) => (
                        <div key={gym.id} className="animate-fade-up" style={{ animationDelay: `${index * 0.05}s` }}>
                          <GymCard
                            id={gym.id}
                            name={gym.name}
                            address={gym.address}
                            rating={gym.rating || 0}
                            therapistCount={gym.therapistCount || 0}
                            therapistNames={gym.therapistNames || []}
                            openNow={true}
                            image={gym.image_url || "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80"}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">{t("cityPage.noGyms")}</p>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default CityPage;
