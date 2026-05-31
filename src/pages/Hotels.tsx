import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CityCard from "@/components/cities/CityCard";
import SEO from "@/components/SEO";
import { Search, MapPin, ChevronDown, ChevronUp, Building, Hotel as HotelIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { usePublicCountry } from "@/contexts/CountryContext";

const GEO_TERMS: Record<string, { stateLabel: string; countyLabel: string; cityLabel: string; citiesLabel: string; freeCities: string }> = {
  DE: { stateLabel: "Bundesland", countyLabel: "Landkreis", cityLabel: "Ort", citiesLabel: "Orte", freeCities: "Kreisfreie Städte" },
  EG: { stateLabel: "محافظة", countyLabel: "مركز / حي", cityLabel: "مدينة", citiesLabel: "مدن", freeCities: "مدن رئيسية" },
  SA: { stateLabel: "منطقة", countyLabel: "محافظة", cityLabel: "مدينة", citiesLabel: "مدن", freeCities: "مدن رئيسية" },
};
const DEFAULT_TERMS = { stateLabel: "Region", countyLabel: "District", cityLabel: "City", citiesLabel: "Cities", freeCities: "Major Cities" };

import cityMassage1 from "@/assets/city-massage-1.jpg";
import cityMassage2 from "@/assets/city-massage-2.jpg";
import cityMassage3 from "@/assets/city-massage-3.jpg";
import cityMassage4 from "@/assets/city-massage-4.jpg";
import cityMassage5 from "@/assets/city-massage-5.jpg";
import cityMassage6 from "@/assets/city-massage-6.jpg";

const massageImages = [cityMassage1, cityMassage2, cityMassage3, cityMassage4, cityMassage5, cityMassage6];

interface FederalState { id: string; name: string; code: string; }
interface County { id: string; name: string; code: string; federal_state_id: string; }
interface City {
  id: string;
  name: string;
  country: string;
  hotel_count: number;
  image_url: string | null;
  federal_state_id: string | null;
  county_id: string | null;
}
interface GroupedData {
  state: FederalState;
  counties: { county: County; cities: City[] }[];
  unassignedCities: City[];
}

const Hotels = () => {
  const { t } = useTranslation();
  const { selectedCountry } = usePublicCountry();
  const [searchQuery, setSearchQuery] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [federalStates, setFederalStates] = useState<FederalState[]>([]);
  const [counties, setCounties] = useState<County[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStates, setExpandedStates] = useState<Set<string>>(new Set());
  const [expandedCounties, setExpandedCounties] = useState<Set<string>>(new Set());
  const terms = useMemo(() => GEO_TERMS[selectedCountry?.code || "DE"] || DEFAULT_TERMS, [selectedCountry?.code]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedCountry) return;
      setLoading(true);

      const [citiesRes, statesRes, countiesRes, hotelsRes] = await Promise.all([
        supabase.from("cities").select("*").eq("is_active", true).eq("country_id", selectedCountry.id).order("name"),
        supabase.from("federal_states").select("*").eq("is_active", true).eq("country_id", selectedCountry.id).order("name"),
        supabase.from("counties").select("*").eq("is_active", true).order("name"),
        supabase.from("hotels").select("city_id").eq("is_active", true).eq("country_id", selectedCountry.id),
      ]);

      // Aggregate hotel counts per city
      const hotelCountMap = new Map<string, number>();
      (hotelsRes.data || []).forEach((h: any) => {
        if (h.city_id) hotelCountMap.set(h.city_id, (hotelCountMap.get(h.city_id) || 0) + 1);
      });

      // Only keep cities that have at least one hotel
      const citiesWithHotels = ((citiesRes.data || []) as any[])
        .map((c) => ({ ...c, hotel_count: hotelCountMap.get(c.id) || 0 }))
        .filter((c) => c.hotel_count > 0) as City[];

      setCities(citiesWithHotels);
      if (statesRes.data) {
        setFederalStates(statesRes.data as FederalState[]);
        setExpandedStates(new Set(statesRes.data.slice(0, 3).map((s: any) => s.id)));
      }
      if (countiesRes.data) {
        setCounties(countiesRes.data as County[]);
        setExpandedCounties(new Set(countiesRes.data.slice(0, 5).map((c: any) => c.id)));
      }
      setLoading(false);
    };
    fetchData();
  }, [selectedCountry?.id]);

  const filteredCities = cities.filter((city) => city.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const groupedData: GroupedData[] = federalStates
    .map((state) => {
      const stateCounties = counties.filter((c) => c.federal_state_id === state.id);
      const stateCities = filteredCities.filter((city) => city.federal_state_id === state.id);
      const countiesWithCities = stateCounties
        .map((county) => ({ county, cities: stateCities.filter((city) => city.county_id === county.id) }))
        .filter((g) => g.cities.length > 0);
      const unassignedCities = stateCities.filter((city) => !city.county_id);
      return { state, counties: countiesWithCities, unassignedCities };
    })
    .filter((g) => g.counties.length > 0 || g.unassignedCities.length > 0);

  const orphans = filteredCities.filter((c) => !c.federal_state_id);

  const toggleState = (id: string) => setExpandedStates((p) => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleCounty = (id: string) => setExpandedCounties((p) => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const getCityImage = (i: number) => massageImages[i % massageImages.length];
  const totalInState = (g: GroupedData) => g.counties.reduce((a, c) => a + c.cities.length, 0) + g.unassignedCities.length;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SEO
        title={t("hotels.seoTitle")}
        description={t("hotels.seoDescription")}
        keywords={t("hotels.seoKeywords")}
        path="/hotels"
      />
      <Header />
      <main className="pt-24 pb-16">
        <section className="bg-sage-light py-16">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                <HotelIcon className="w-4 h-4" />
                {t("hotels.pageTitle")}
              </span>
              <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
                {t("hotels.pageTitle")}
              </h1>
              <p className="text-muted-foreground text-lg mb-8">{t("hotels.pageDescription")}</p>
              <div className="relative max-w-md mx-auto">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t("hotels.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-14 pl-12 pr-4 rounded-xl border-2 border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="container mx-auto px-4">
            {loading ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg">{t("hotels.loading")}</p>
              </div>
            ) : groupedData.length === 0 && orphans.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg">{t("hotels.noCities")}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedData.map((group, gi) => {
                  const open = expandedStates.has(group.state.id);
                  return (
                    <div key={group.state.id} className="border border-border rounded-2xl overflow-hidden bg-card">
                      <Button variant="ghost" onClick={() => toggleState(group.state.id)} className="w-full flex items-center justify-between p-6 hover:bg-muted/50 rounded-none h-auto">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <MapPin className="w-6 h-6 text-primary" />
                          </div>
                          <div className="text-left">
                            <h2 className="font-display text-xl font-bold text-foreground">{group.state.name}</h2>
                            <p className="text-sm text-muted-foreground">
                              {group.counties.length} {terms.countyLabel} • {totalInState(group)} {terms.citiesLabel}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-medium">{group.state.code}</code>
                          {open ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                        </div>
                      </Button>
                      {open && (
                        <div className="border-t border-border">
                          {group.counties.map((cg, ci) => {
                            const co = expandedCounties.has(cg.county.id);
                            return (
                              <div key={cg.county.id} className="border-b border-border last:border-b-0">
                                <Button variant="ghost" onClick={() => toggleCounty(cg.county.id)} className="w-full flex items-center justify-between p-4 pl-10 hover:bg-muted/30 rounded-none h-auto">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-sage/10 flex items-center justify-center">
                                      <Building className="w-4 h-4 text-sage" />
                                    </div>
                                    <div className="text-left">
                                      <h3 className="font-medium text-foreground">{cg.county.name}</h3>
                                      <p className="text-xs text-muted-foreground">
                                        {cg.cities.length} {cg.cities.length === 1 ? terms.cityLabel : terms.citiesLabel}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <code className="text-xs bg-sage/10 text-sage px-2 py-0.5 rounded font-medium">{cg.county.code}</code>
                                    {co ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                  </div>
                                </Button>
                                {co && (
                                  <div className="p-4 pl-14 bg-muted/20">
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                      {cg.cities.map((city, idx) => (
                                        <div key={city.id} className="animate-fade-up" style={{ animationDelay: `${idx * 0.03}s` }}>
                                          <CityCard
                                            id={city.id}
                                            name={city.name}
                                            country={city.country}
                                            gymCount={0}
                                            hotelCount={city.hotel_count}
                                            variant="hotel"
                                            image={getCityImage(gi * 20 + ci * 5 + idx)}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {group.unassignedCities.length > 0 && (
                            <div className="p-6 bg-muted/10">
                              <h4 className="text-sm font-medium text-muted-foreground mb-4 pl-4">{terms.freeCities}</h4>
                              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {group.unassignedCities.map((city, idx) => (
                                  <div key={city.id} className="animate-fade-up" style={{ animationDelay: `${idx * 0.03}s` }}>
                                    <CityCard
                                      id={city.id}
                                      name={city.name}
                                      country={city.country}
                                      gymCount={0}
                                      hotelCount={city.hotel_count}
                                      variant="hotel"
                                      image={getCityImage(gi * 20 + idx)}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {orphans.length > 0 && (
                  <div className="border border-border rounded-2xl bg-card p-6">
                    <h4 className="text-sm font-medium text-muted-foreground mb-4">{terms.freeCities}</h4>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {orphans.map((city, idx) => (
                        <div key={city.id} className="animate-fade-up" style={{ animationDelay: `${idx * 0.03}s` }}>
                          <CityCard
                            id={city.id}
                            name={city.name}
                            country={city.country}
                            gymCount={0}
                            hotelCount={city.hotel_count}
                            variant="hotel"
                            image={getCityImage(idx)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Hotels;