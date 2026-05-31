import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useCountryData } from "@/hooks/useCountry";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2, MapPin } from "lucide-react";
import { getAdminGeographyLabels } from "@/constants/adminGeography";

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
  country_id: string | null;
  image_url: string | null;
  gym_count: number;
  is_active: boolean;
  created_at: string;
  federal_state_id: string | null;
  county_id: string | null;
  federal_states?: { name: string; code: string } | null;
  counties?: { name: string; code: string } | null;
}

const AdminCities = () => {
  const { countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);
  const activeCountryId = selectedCountry?.id || null;
  const geoLabels = getAdminGeographyLabels(selectedCountry?.code);
  const isArabicGeo = selectedCountry?.code === "EG" || selectedCountry?.code === "SA";
  const allStatesLabel = isArabicGeo ? `كل ${geoLabels.states}` : `All ${geoLabels.states}`;
  const allCountiesLabel = isArabicGeo ? `كل ${geoLabels.counties}` : `All ${geoLabels.counties}`;

  const [cities, setCities] = useState<City[]>([]);
  const [federalStates, setFederalStates] = useState<FederalState[]>([]);
  const [counties, setCounties] = useState<County[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [stateFilter, setStateFilter] = useState("all");
  const [countyFilter, setCountyFilter] = useState("all");
  const [formData, setFormData] = useState({
    name: "",
    country: "",
    image_url: "",
    is_active: true,
    federal_state_id: "",
    county_id: "",
  });
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);

    let citiesQuery = supabase
      .from("cities")
      .select("*, federal_states(name, code), counties(name, code)")
      .order("name");

    let statesQuery = supabase
      .from("federal_states")
      .select("id, name, code")
      .eq("is_active", true)
      .order("name");

    if (activeCountryId) {
      citiesQuery = citiesQuery.eq("country_id", activeCountryId);
      statesQuery = statesQuery.eq("country_id", activeCountryId);
    }

    const [citiesRes, statesRes] = await Promise.all([citiesQuery, statesQuery]);

    const stateIds = (statesRes.data || []).map((state) => state.id);
    let scopedCounties: County[] = [];

    if (stateIds.length > 0) {
      const { data: countiesData } = await supabase
        .from("counties")
        .select("id, name, code, federal_state_id")
        .eq("is_active", true)
        .in("federal_state_id", stateIds)
        .order("name");

      scopedCounties = (countiesData || []) as County[];
    }

    setCities((citiesRes.data || []) as City[]);
    setFederalStates((statesRes.data || []) as FederalState[]);
    setCounties(scopedCounties);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [activeCountryId]);

  useEffect(() => {
    setStateFilter("all");
    setCountyFilter("all");
  }, [activeCountryId]);

  // Set default country name when selectedCountry changes
  useEffect(() => {
    if (selectedCountry && !editingCity) {
      setFormData((prev) => ({
        ...prev,
        country: selectedCountry.name,
        federal_state_id: "",
        county_id: "",
      }));
    }
  }, [selectedCountry, editingCity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cityData = {
      name: formData.name,
      country: formData.country,
      country_id: activeCountryId,
      image_url: formData.image_url || null,
      is_active: formData.is_active,
      federal_state_id: formData.federal_state_id || null,
      county_id: formData.county_id || null,
    };

    if (editingCity) {
      const { error } = await supabase.from("cities").update(cityData).eq("id", editingCity.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "City updated successfully" });
        setIsDialogOpen(false);
        fetchData();
      }
    } else {
      const { error } = await supabase.from("cities").insert(cityData);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "City created successfully" });
        setIsDialogOpen(false);
        fetchData();
      }
    }
  };

  const handleEdit = (city: City) => {
    setEditingCity(city);
    setFormData({
      name: city.name,
      country: city.country,
      image_url: city.image_url || "",
      is_active: city.is_active,
      federal_state_id: city.federal_state_id || "",
      county_id: city.county_id || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this city?")) return;
    const { error } = await supabase.from("cities").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "City deleted successfully" });
      fetchData();
    }
  };

  const resetForm = () => {
    setEditingCity(null);
    setFormData({
      name: "",
      country: selectedCountry?.name || "",
      image_url: "",
      is_active: true,
      federal_state_id: "",
      county_id: "",
    });
  };

  const filteredCountiesForForm = formData.federal_state_id
    ? counties.filter(c => c.federal_state_id === formData.federal_state_id)
    : counties;

  const filteredCountiesForFilter = stateFilter === "all"
    ? counties
    : counties.filter(c => c.federal_state_id === stateFilter);

  let filteredCities = cities;
  if (stateFilter !== "all") {
    filteredCities = filteredCities.filter((city) => city.federal_state_id === stateFilter);
  }
  if (countyFilter !== "all") {
    filteredCities = filteredCities.filter((city) => city.county_id === countyFilter);
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">{geoLabels.cities}</h2>
              <p className="text-xs text-muted-foreground">
                {selectedCountry
                  ? `${selectedCountry.name} · ${filteredCities.length} ${geoLabels.cities}`
                  : `${filteredCities.length} ${geoLabels.cities}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={stateFilter} onValueChange={(v) => { setStateFilter(v); setCountyFilter("all"); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={geoLabels.states} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{allStatesLabel}</SelectItem>
                {federalStates.map((state) => (
                  <SelectItem key={state.id} value={state.id}>{state.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={countyFilter} onValueChange={setCountyFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={geoLabels.counties} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{allCountiesLabel}</SelectItem>
                {filteredCountiesForFilter.map((county) => (
                  <SelectItem key={county.id} value={county.id}>{county.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  {isArabicGeo ? "إضافة مدينة" : "Add City"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingCity ? (isArabicGeo ? "تعديل مدينة" : "Edit City") : (isArabicGeo ? "إضافة مدينة جديدة" : "Add New City")}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>{geoLabels.stateSingular}</Label>
                    <Select
                      value={formData.federal_state_id}
                      onValueChange={(value) => setFormData({ ...formData, federal_state_id: value, county_id: "" })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={isArabicGeo ? "اختر" : `Select ${geoLabels.stateSingular}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {federalStates.map((state) => (
                          <SelectItem key={state.id} value={state.id}>
                            {state.name} ({state.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{geoLabels.countySingular} ({isArabicGeo ? "اختياري" : "optional"})</Label>
                    <Select
                      value={formData.county_id || "none"}
                      onValueChange={(value) => setFormData({ ...formData, county_id: value === "none" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={isArabicGeo ? "اختر" : `Select ${geoLabels.countySingular}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{isArabicGeo ? "بدون" : "None (independent city)"}</SelectItem>
                        {filteredCountiesForForm.map((county) => (
                          <SelectItem key={county.id} value={county.id}>
                            {county.name} ({county.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{isArabicGeo ? "اسم المدينة" : "City Name"}</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder={isArabicGeo ? "مثال: القاهرة" : "e.g. Cologne"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{isArabicGeo ? "اسم الدولة" : "Country Label"}</Label>
                    <Input
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      required
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">{isArabicGeo ? "يتم ضبطه تلقائيًا حسب الدولة المختارة" : "Auto-set from selected country"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>{isArabicGeo ? "رابط الصورة" : "Image URL"}</Label>
                    <Input
                      value={formData.image_url}
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label>{isArabicGeo ? "نشط" : "Active"}</Label>
                  </div>
                  <Button type="submit" className="w-full">
                    {editingCity ? (isArabicGeo ? "تحديث المدينة" : "Update City") : (isArabicGeo ? "إنشاء مدينة" : "Create City")}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>{geoLabels.citySingular}</TableHead>
                  <TableHead>{geoLabels.countySingular}</TableHead>
                  <TableHead>{geoLabels.stateSingular}</TableHead>
                  <TableHead>Gyms</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {isArabicGeo
                        ? `لا توجد ${geoLabels.cities} في ${selectedCountry?.name || "الدولة الحالية"}.`
                        : `No ${geoLabels.cities.toLowerCase()} found for ${selectedCountry?.name || "this country"}.`}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCities.map((city) => (
                    <TableRow key={city.id}>
                      <TableCell className="font-medium">{city.name}</TableCell>
                      <TableCell>
                        {city.counties ? (
                          <span className="inline-flex items-center gap-1">
                            <code className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                              {city.counties.code}
                            </code>
                            <span className="text-sm text-muted-foreground">{city.counties.name}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {city.federal_states ? (
                          <span className="inline-flex items-center gap-1">
                            <code className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                              {city.federal_states.code}
                            </code>
                            <span className="text-sm text-muted-foreground">{city.federal_states.name}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{city.gym_count}</TableCell>
                      <TableCell>
                        <Badge variant={city.is_active ? "default" : "secondary"} className="text-[10px]">
                          {city.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(city)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(city.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminCities;
