import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CityCard from "@/components/cities/CityCard";
import SEO from "@/components/SEO";
import { Search, MapPin, ChevronDown, ChevronUp, Building } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { usePublicCountry } from "@/contexts/CountryContext";

// Geographic terminology per country
const GEO_TERMS: Record<string, { stateLabel: string; countyLabel: string; cityLabel: string; citiesLabel: string; freeCities: string }> = {
  DE: { stateLabel: "Bundesland", countyLabel: "Landkreis", cityLabel: "Ort", citiesLabel: "Orte", freeCities: "Kreisfreie Städte" },
  EG: { stateLabel: "محافظة", countyLabel: "مركز / حي", cityLabel: "مدينة", citiesLabel: "مدن", freeCities: "مدن رئيسية" },
  SA: { stateLabel: "منطقة", countyLabel: "محافظة", cityLabel: "مدينة", citiesLabel: "مدن", freeCities: "مدن رئيسية" },
};
const DEFAULT_TERMS = { stateLabel: "Region", countyLabel: "District", cityLabel: "City", citiesLabel: "Cities", freeCities: "Major Cities" };

// Import massage-themed images for cities
import cityMassage1 from "@/assets/city-massage-1.jpg";
import cityMassage2 from "@/assets/city-massage-2.jpg";
import cityMassage3 from "@/assets/city-massage-3.jpg";
import cityMassage4 from "@/assets/city-massage-4.jpg";
import cityMassage5 from "@/assets/city-massage-5.jpg";
import cityMassage6 from "@/assets/city-massage-6.jpg";

const massageImages = [
  cityMassage1,
  cityMassage2,
  cityMassage3,
  cityMassage4,
  cityMassage5,
  cityMassage6,
];

interface FederalState {
  id: string;
  name: string;
  code: string;
}

interface County {
  id: string;
  name: string;
  code: string;
  federal_state_id: string;
}

interface City {
  id: string;
  name: string;
  country: string;
  gym_count: number;
  image_url: string | null;
  federal_state_id: string | null;
  county_id: string | null;
}

interface GroupedData {
  state: FederalState;
  counties: {
    county: County;
    cities: City[];
  }[];
  unassignedCities: City[];
}

const CitiesPage = () => {
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

      const citiesQuery = supabase
        .from("cities")
        .select("*")
        .eq("is_active", true)
        .eq("country_id", selectedCountry.id)
        .order("name");

      const [citiesRes, statesRes, countiesRes] = await Promise.all([
        citiesQuery,
        supabase
          .from("federal_states")
          .select("*")
          .eq("is_active", true)
          .eq("country_id", selectedCountry.id)
          .order("name"),
        supabase
          .from("counties")
          .select("*")
          .eq("is_active", true)
          .order("name"),
      ]);

      if (!citiesRes.error && citiesRes.data) {
        setCities(citiesRes.data);
      }
      if (!statesRes.error && statesRes.data) {
        setFederalStates(statesRes.data);
        const firstThreeStates = statesRes.data.slice(0, 3).map(s => s.id);
        setExpandedStates(new Set(firstThreeStates));
      }
      if (!countiesRes.error && countiesRes.data) {
        setCounties(countiesRes.data);
        const firstCounties = countiesRes.data.slice(0, 5).map(c => c.id);
        setExpandedCounties(new Set(firstCounties));
      }
      setLoading(false);
    };

    setLoading(true);
    fetchData();
  }, [selectedCountry?.id]);

  const filteredCities = cities.filter(
    (city) => city.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Build hierarchical structure: States → Counties → Towns
  const groupedData: GroupedData[] = federalStates
    .map((state) => {
      const stateCounties = counties.filter(c => c.federal_state_id === state.id);
      const stateCities = filteredCities.filter(city => city.federal_state_id === state.id);
      
      const countiesWithCities = stateCounties
        .map(county => ({
          county,
          cities: stateCities.filter(city => city.county_id === county.id),
        }))
        .filter(group => group.cities.length > 0);
      
      const unassignedCities = stateCities.filter(city => !city.county_id);
      
      return {
        state,
        counties: countiesWithCities,
        unassignedCities,
      };
    })
    .filter(group => group.counties.length > 0 || group.unassignedCities.length > 0);

  const toggleState = (stateId: string) => {
    setExpandedStates((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(stateId)) {
        newSet.delete(stateId);
      } else {
        newSet.add(stateId);
      }
      return newSet;
    });
  };

  const toggleCounty = (countyId: string) => {
    setExpandedCounties((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(countyId)) {
        newSet.delete(countyId);
      } else {
        newSet.add(countyId);
      }
      return newSet;
    });
  };

  const getCityImage = (index: number) => {
    return massageImages[index % massageImages.length];
  };

  const getTotalCitiesInState = (group: GroupedData) => {
    return group.counties.reduce((acc, c) => acc + c.cities.length, 0) + group.unassignedCities.length;
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Städte – Massage in deiner Stadt | MASSAVO"
        description="Finde Massagestudios und Partnerhotels in deiner Stadt. Buche Sport-, Klassische und Wellness-Massagen in Sekunden per QR-Code."
        path="/cities"
        keywords="städte massage, massage in der nähe, fitnessstudio massage, hotel massage"
      />
      <Header />
      
      <main className="pt-24 pb-16">
        {/* Hero Section */}
        <section className="bg-sage-light py-16">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sage/10 text-sage text-sm font-medium mb-4">
                <MapPin className="w-4 h-4" />
                {t("cities.badge")}
              </span>
              <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
                {t("cities.title")} <span className="text-primary">{t("cities.titleHighlight")}</span>
              </h1>
              <p className="text-muted-foreground text-lg mb-8">
                {t("cities.subtitle")}
              </p>

              {/* Search */}
              <div className="relative max-w-md mx-auto">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t("cities.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-14 pl-12 pr-4 rounded-xl border-2 border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Hierarchical Display: States → Counties → Towns */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            {loading ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg">{t("cities.loading")}</p>
              </div>
            ) : groupedData.length > 0 ? (
              <div className="space-y-6">
                {groupedData.map((group, groupIndex) => {
                  const isStateExpanded = expandedStates.has(group.state.id);

                  return (
                    <div key={group.state.id} className="border border-border rounded-2xl overflow-hidden bg-card">
                      {/* State Header */}
                      <Button
                        variant="ghost"
                        onClick={() => toggleState(group.state.id)}
                        className="w-full flex items-center justify-between p-6 hover:bg-muted/50 rounded-none h-auto"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <MapPin className="w-6 h-6 text-primary" />
                          </div>
                          <div className="text-left">
                            <h2 className="font-display text-xl font-bold text-foreground">
                              {group.state.name}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                              {group.counties.length} {terms.countyLabel} • {getTotalCitiesInState(group)} {terms.citiesLabel}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-medium">
                            {group.state.code}
                          </code>
                          {isStateExpanded ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </Button>

                      {/* Counties and Cities */}
                      {isStateExpanded && (
                        <div className="border-t border-border">
                          {/* Counties */}
                          {group.counties.map((countyGroup, countyIndex) => {
                            const isCountyExpanded = expandedCounties.has(countyGroup.county.id);
                            
                            return (
                              <div key={countyGroup.county.id} className="border-b border-border last:border-b-0">
                                {/* County Header */}
                                <Button
                                  variant="ghost"
                                  onClick={() => toggleCounty(countyGroup.county.id)}
                                  className="w-full flex items-center justify-between p-4 pl-10 hover:bg-muted/30 rounded-none h-auto"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-sage/10 flex items-center justify-center">
                                      <Building className="w-4 h-4 text-sage" />
                                    </div>
                                    <div className="text-left">
                                      <h3 className="font-medium text-foreground">
                                        {countyGroup.county.name}
                                      </h3>
                                      <p className="text-xs text-muted-foreground">
                                        {countyGroup.cities.length} {countyGroup.cities.length === 1 ? terms.cityLabel : terms.citiesLabel}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <code className="text-xs bg-sage/10 text-sage px-2 py-0.5 rounded font-medium">
                                      {countyGroup.county.code}
                                    </code>
                                    {isCountyExpanded ? (
                                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    )}
                                  </div>
                                </Button>

                                {/* Towns/Villages Grid */}
                                {isCountyExpanded && (
                                  <div className="p-4 pl-14 bg-muted/20">
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                      {countyGroup.cities.map((city, index) => (
                                        <div 
                                          key={city.id} 
                                          className="animate-fade-up" 
                                          style={{ animationDelay: `${index * 0.03}s` }}
                                        >
                                          <CityCard 
                                            id={city.id}
                                            name={city.name}
                                            country={city.country}
                                            gymCount={city.gym_count || 0}
                                            image={getCityImage(groupIndex * 20 + countyIndex * 5 + index)}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Unassigned cities (major cities directly under state) */}
                          {group.unassignedCities.length > 0 && (
                            <div className="p-6 bg-muted/10">
                              <h4 className="text-sm font-medium text-muted-foreground mb-4 pl-4">
                                {terms.freeCities}
                              </h4>
                              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {group.unassignedCities.map((city, index) => (
                                  <div 
                                    key={city.id} 
                                    className="animate-fade-up" 
                                    style={{ animationDelay: `${index * 0.03}s` }}
                                  >
                                    <CityCard 
                                      id={city.id}
                                      name={city.name}
                                      country={city.country}
                                      gymCount={city.gym_count || 0}
                                      image={getCityImage(groupIndex * 20 + index)}
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
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg">{t("cities.noResults")} "{searchQuery}"</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default CitiesPage;