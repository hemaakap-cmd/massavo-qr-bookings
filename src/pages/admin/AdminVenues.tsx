import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Hotel, Home, ArrowRight, Loader2, MapPin } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCountryData } from "@/hooks/useCountry";

type VenueSummary = {
  gyms: number;
  activeGyms: number;
  hotels: number;
  activeHotels: number;
  homeCities: number;
  homeServices: number;
};

const initialSummary: VenueSummary = {
  gyms: 0,
  activeGyms: 0,
  hotels: 0,
  activeHotels: 0,
  homeCities: 0,
  homeServices: 0,
};

const AdminVenues = () => {
  const { countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);
  const [summary, setSummary] = useState(initialSummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      let gymsQuery = supabase.from("gyms").select("id, is_active");
      let hotelsQuery = supabase.from("hotels").select("id, is_active");
      let citiesQuery = supabase.from("cities").select("id, is_active, home_visit_travel_fee");
      let servicesQuery = supabase.from("services").select("id, is_active, home_visit_enabled");

      if (selectedCountry?.id) {
        gymsQuery = gymsQuery.eq("country_id", selectedCountry.id);
        hotelsQuery = hotelsQuery.eq("country_id", selectedCountry.id);
        citiesQuery = citiesQuery.eq("country_id", selectedCountry.id);
        servicesQuery = servicesQuery.eq("country_id", selectedCountry.id);
      }

      const [gyms, hotels, cities, services] = await Promise.all([
        gymsQuery,
        hotelsQuery,
        citiesQuery,
        servicesQuery,
      ]);
      const firstError = gyms.error || hotels.error || cities.error || services.error;
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      setSummary({
        gyms: gyms.data?.length || 0,
        activeGyms: gyms.data?.filter((item) => item.is_active).length || 0,
        hotels: hotels.data?.length || 0,
        activeHotels: hotels.data?.filter((item) => item.is_active).length || 0,
        homeCities: cities.data?.filter((item) => item.is_active && item.home_visit_travel_fee !== null).length || 0,
        homeServices: services.data?.filter((item) => item.is_active && item.home_visit_enabled).length || 0,
      });
      setLoading(false);
    };

    load();
  }, [selectedCountry?.id]);

  const sections = [
    {
      title: "Gyms",
      description: "QR locations, services, prices and location details",
      icon: Building2,
      count: summary.gyms,
      status: `${summary.activeGyms} active`,
      href: "/admin/gyms",
      action: "Manage Gyms",
    },
    {
      title: "Hotels",
      description: "Hotel QR locations, guest services and availability",
      icon: Hotel,
      count: summary.hotels,
      status: `${summary.activeHotels} active`,
      href: "/admin/hotels",
      action: "Manage Hotels",
    },
    {
      title: "Home Visits",
      description: "Service cities, travel fees, services and therapist coverage",
      icon: Home,
      count: summary.homeCities,
      status: `${summary.homeServices} enabled services`,
      href: "/admin/home-visits",
      action: "Manage Home Visits",
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">All Venues</h1>
            <p className="text-sm text-muted-foreground">
              {selectedCountry ? `${selectedCountry.name} · all service channels` : "All service channels"}
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Venue information could not be loaded: {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          {sections.map((section) => (
            <Card key={section.title} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                    <section.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-foreground">
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : section.count}
                    </div>
                    <div className="text-xs text-muted-foreground">{section.status}</div>
                  </div>
                </div>
                <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
                <p className="mt-1 min-h-10 text-sm text-muted-foreground">{section.description}</p>
                <Button asChild className="mt-5 w-full justify-between">
                  <Link to={section.href}>
                    {section.action}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminVenues;