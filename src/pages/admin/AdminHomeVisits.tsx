import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Home, Loader2, MapPin, Package, Users } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCountryData } from "@/hooks/useCountry";

type HomeCity = {
  id: string;
  name: string;
  is_active: boolean | null;
  home_visit_travel_fee: number | null;
};

type HomeService = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  is_active: boolean | null;
};

type CityAssignment = {
  city_id: string;
  therapist_id: string;
};

const AdminHomeVisits = () => {
  const { countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);
  const [cities, setCities] = useState<HomeCity[]>([]);
  const [services, setServices] = useState<HomeService[]>([]);
  const [assignments, setAssignments] = useState<CityAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      let citiesQuery = supabase
        .from("cities")
        .select("id, name, is_active, home_visit_travel_fee")
        .order("name");
      let servicesQuery = supabase
        .from("services")
        .select("id, name, duration_minutes, price, is_active")
        .eq("home_visit_enabled", true)
        .order("name");

      if (selectedCountry?.id) {
        citiesQuery = citiesQuery.eq("country_id", selectedCountry.id);
        servicesQuery = servicesQuery.eq("country_id", selectedCountry.id);
      }

      const [citiesResult, servicesResult] = await Promise.all([citiesQuery, servicesQuery]);
      const firstError = citiesResult.error || servicesResult.error;
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const nextCities = (citiesResult.data || []) as HomeCity[];
      const cityIds = nextCities.map((city) => city.id);
      let nextAssignments: CityAssignment[] = [];
      if (cityIds.length > 0) {
        const assignmentsResult = await supabase
          .from("therapist_cities")
          .select("city_id, therapist_id")
          .in("city_id", cityIds);
        if (assignmentsResult.error) {
          setError(assignmentsResult.error.message);
          setLoading(false);
          return;
        }
        nextAssignments = (assignmentsResult.data || []) as CityAssignment[];
      }

      setCities(nextCities);
      setServices((servicesResult.data || []) as HomeService[]);
      setAssignments(nextAssignments);
      setLoading(false);
    };

    load();
  }, [selectedCountry?.id]);

  const therapistCount = useMemo(
    () => new Set(assignments.map((assignment) => assignment.therapist_id)).size,
    [assignments],
  );
  const currency = selectedCountry?.currency_symbol || "€";
  const stats = [
    { label: "Service Cities", value: cities.filter((city) => city.is_active).length, icon: MapPin },
    { label: "Home Services", value: services.filter((service) => service.is_active).length, icon: Package },
    { label: "Assigned Therapists", value: therapistCount, icon: Users },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Home className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">Home Visits</h1>
              <p className="text-sm text-muted-foreground">
                {selectedCountry ? `${selectedCountry.name} · cities, services and therapist coverage` : "Cities, services and therapist coverage"}
              </p>
            </div>
          </div>
          <Button asChild>
            <Link to="/admin/bookings">
              View Home Bookings <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Home Visit settings could not be loaded: {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="text-2xl font-bold text-foreground">{loading ? "—" : stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
                <stat.icon className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Cities & Travel Fees</CardTitle>
                <Button variant="outline" size="sm" asChild><Link to="/admin/cities">Edit Cities</Link></Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>City</TableHead><TableHead>Travel Fee</TableHead><TableHead>Therapists</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {cities.map((city) => (
                      <TableRow key={city.id}>
                        <TableCell className="font-medium">{city.name}</TableCell>
                        <TableCell>{city.home_visit_travel_fee === null ? "Not set" : `${currency}${Number(city.home_visit_travel_fee).toFixed(2)}`}</TableCell>
                        <TableCell>{new Set(assignments.filter((item) => item.city_id === city.id).map((item) => item.therapist_id)).size}</TableCell>
                        <TableCell><Badge variant={city.is_active ? "default" : "secondary"}>{city.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {cities.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No cities configured.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Enabled Home Services</CardTitle>
                <Button variant="outline" size="sm" asChild><Link to="/admin/services">Edit Services</Link></Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {services.map((service) => (
                  <div key={service.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{service.name}</div>
                      <div className="text-xs text-muted-foreground">{service.duration_minutes} min</div>
                    </div>
                    <div className="text-sm font-semibold text-primary">{currency}{Number(service.price).toFixed(2)}</div>
                  </div>
                ))}
                {services.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No Home Visit services enabled.</div>}
                <div className="pt-2">
                  <Button variant="outline" className="w-full justify-between" asChild>
                    <Link to="/admin/therapists">Manage Therapist City Coverage <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminHomeVisits;