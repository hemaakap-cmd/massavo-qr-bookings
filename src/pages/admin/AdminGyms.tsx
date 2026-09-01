import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useCountryData } from "@/hooks/useCountry";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2, Building2, MapPin, Package, QrCode, Tag } from "lucide-react";
import GymQRCode from "@/components/gym/GymQRCode";
import { VenuePricingDialog } from "@/components/admin/VenuePricingDialog";

interface Gym {
  id: string;
  city_id: string;
  country_id: string | null;
  name: string;
  address: string;
  phone: string | null;
  qr_code_id: string;
  image_url: string | null;
  rating: number;
  open_hours: string | null;
  is_active: boolean;
  cities?: { name: string };
}

interface City {
  id: string;
  name: string;
  country_id: string | null;
}

interface ServiceOption {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  icon: string | null;
}

const AdminGyms = () => {
  const { countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);
  const activeCountryId = selectedCountry?.id || null;

  const [gyms, setGyms] = useState<Gym[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [countryServices, setCountryServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGym, setEditingGym] = useState<Gym | null>(null);
  const [qrGym, setQrGym] = useState<Gym | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [pricingGym, setPricingGym] = useState<Gym | null>(null);
  const [pricingOpen, setPricingOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    city_id: "",
    name: "",
    address: "",
    phone: "",
    qr_code_id: "",
    image_url: "",
    open_hours: "",
    is_active: true,
    generate_qr: true,
  });
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);

    // Build queries scoped to country
    let gymsQuery = supabase.from("gyms").select("*, cities(name)").order("name");
    let citiesQuery = supabase.from("cities").select("id, name, country_id").eq("is_active", true).order("name");
    let servicesQuery = supabase.from("services").select("id, name, price, duration_minutes, icon").eq("is_active", true).order("name");

    if (activeCountryId) {
      gymsQuery = gymsQuery.eq("country_id", activeCountryId);
      citiesQuery = citiesQuery.eq("country_id", activeCountryId);
      servicesQuery = servicesQuery.eq("country_id", activeCountryId);
    }

    const [gymsRes, citiesRes, servicesRes] = await Promise.all([
      gymsQuery,
      citiesQuery,
      servicesQuery,
    ]);

    setGyms((gymsRes.data || []) as Gym[]);
    setCities((citiesRes.data || []) as City[]);
    setCountryServices((servicesRes.data || []) as ServiceOption[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [activeCountryId]);

  const generateQRCodeId = () =>
    `GYM-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const gymData = {
      city_id: formData.city_id,
      country_id: activeCountryId,
      name: formData.name,
      address: formData.address,
      phone: formData.phone || null,
      qr_code_id: formData.qr_code_id || generateQRCodeId(),
      image_url: formData.image_url || null,
      open_hours: formData.open_hours || null,
      is_active: formData.is_active,
    };

    if (editingGym) {
      const { error } = await supabase.from("gyms").update(gymData).eq("id", editingGym.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }

      // Sync gym_services for edit
      const syncError = await syncGymServices(editingGym.id, selectedServiceIds);
      if (syncError) {
        toast({ title: "Services not saved", description: syncError, variant: "destructive" });
        return;
      }

      toast({ title: "Success", description: "Gym updated successfully" });
      setIsDialogOpen(false);
      fetchData();
    } else {
      const { data, error } = await supabase.from("gyms").insert(gymData).select("*, cities(name)").single();
      if (error || !data) {
        toast({ title: "Error", description: error?.message || "Unknown error", variant: "destructive" });
        return;
      }

      // Assign selected services
      if (selectedServiceIds.length > 0) {
        const inserts = selectedServiceIds.map((sid) => ({
          gym_id: data.id,
          service_id: sid,
          is_active: true,
        }));
        const { error: svcError } = await supabase.from("gym_services").insert(inserts);
        if (svcError) {
          // The gym row exists but has no services — say so instead of
          // reporting a clean success the admin would never re-check.
          toast({
            title: "Gym created, services not assigned",
            description: svcError.message,
            variant: "destructive",
          });
          setIsDialogOpen(false);
          fetchData();
          return;
        }
      }

      toast({
        title: "Gym created",
        description: formData.generate_qr ? "Static QR code generated for this location." : "Gym saved.",
      });
      setIsDialogOpen(false);
      if (formData.generate_qr) {
        setQrGym(data as Gym);
        setQrDialogOpen(true);
      }
      fetchData();
    }
  };

  /**
   * Syncs the gym's service assignments.
   * Returns the first error encountered (or null). Callers must surface it:
   * a silent failure here leaves a gym with no bookable services while the
   * admin is told the save succeeded.
   */
  const syncGymServices = async (gymId: string, newServiceIds: string[]): Promise<string | null> => {
    // Get existing assignments
    const { data: existing, error: readErr } = await supabase
      .from("gym_services")
      .select("id, service_id, is_active")
      .eq("gym_id", gymId);
    if (readErr) return readErr.message;

    const existingMap = new Map((existing || []).map((e) => [e.service_id, e]));

    // Activate selected, deactivate others
    for (const sid of newServiceIds) {
      if (existingMap.has(sid)) {
        if (!existingMap.get(sid)!.is_active) {
          const { error } = await supabase.from("gym_services").update({ is_active: true }).eq("id", existingMap.get(sid)!.id);
          if (error) return error.message;
        }
      } else {
        const { error } = await supabase.from("gym_services").insert({ gym_id: gymId, service_id: sid, is_active: true });
        if (error) return error.message;
      }
    }

    // Deactivate unselected
    for (const [sid, entry] of existingMap.entries()) {
      if (!newServiceIds.includes(sid) && entry.is_active) {
        const { error } = await supabase.from("gym_services").update({ is_active: false }).eq("id", entry.id);
        if (error) return error.message;
      }
    }
    return null;
  };

  const handleEdit = async (gym: Gym) => {
    setEditingGym(gym);
    setFormData({
      city_id: gym.city_id,
      name: gym.name,
      address: gym.address,
      phone: gym.phone || "",
      qr_code_id: gym.qr_code_id,
      image_url: gym.image_url || "",
      open_hours: gym.open_hours || "",
      is_active: gym.is_active,
      generate_qr: true,
    });

    // Load assigned services for this gym
    const { data } = await supabase
      .from("gym_services")
      .select("service_id")
      .eq("gym_id", gym.id)
      .eq("is_active", true);

    setSelectedServiceIds((data || []).map((d) => d.service_id));
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this gym?")) return;
    const { error } = await supabase.from("gyms").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Gym deleted" });
      fetchData();
    }
  };

  const resetForm = () => {
    setEditingGym(null);
    setFormData({
      city_id: "", name: "", address: "", phone: "",
      qr_code_id: "", image_url: "", open_hours: "", is_active: true, generate_qr: true,
    });
    setSelectedServiceIds([]);
  };

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((s) => s !== serviceId) : [...prev, serviceId]
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Gyms</h2>
              <p className="text-xs text-muted-foreground">
                {selectedCountry
                  ? `${selectedCountry.name} · ${selectedCountry.currency_symbol} ${selectedCountry.currency_code}`
                  : "All gyms"}
                {" · "}{gyms.length} locations
              </p>
            </div>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Gym
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  {editingGym ? "Edit Gym" : "Add New Gym"}
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Location Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <MapPin className="w-3.5 h-3.5" /> Location
                  </div>

                  <div className="space-y-2">
                    <Label>City</Label>
                    <Select
                      value={formData.city_id}
                      onValueChange={(value) => setFormData({ ...formData, city_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a city" />
                      </SelectTrigger>
                      <SelectContent>
                        {cities.map((city) => (
                          <SelectItem key={city.id} value={city.id}>{city.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {cities.length === 0 && (
                      <p className="text-xs text-amber-500">No cities found for this country. Add cities first.</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Gym Name</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        placeholder="e.g. FitX Cologne"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+49 ..."
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      required
                      placeholder="Street, City, ZIP"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Open Hours</Label>
                      <Input
                        value={formData.open_hours}
                        onChange={(e) => setFormData({ ...formData, open_hours: e.target.value })}
                        placeholder="06:00 – 22:00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Image URL</Label>
                      <Input
                        value={formData.image_url}
                        onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>

                {/* Services Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Package className="w-3.5 h-3.5" /> Available Services
                  </div>

                  {countryServices.length === 0 ? (
                    <p className="text-xs text-amber-500 py-2">
                      No services found for {selectedCountry?.name || "this country"}. Create services first.
                    </p>
                  ) : (
                    <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/30">
                      {countryServices.map((s) => (
                        <label
                          key={s.id}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-background cursor-pointer transition-colors"
                        >
                          <Checkbox
                            checked={selectedServiceIds.includes(s.id)}
                            onCheckedChange={() => toggleService(s.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium">{s.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {s.duration_minutes} min
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-primary whitespace-nowrap">
                            {selectedCountry?.currency_symbol || "€"}{s.price.toFixed(2)}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className="flex items-center gap-3 pt-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label>Active</Label>
                </div>

                {/* Static QR Code */}
                {!editingGym && (
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <QrCode className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <Label htmlFor="generate-qr-gym" className="text-sm font-semibold cursor-pointer">
                            Generate Static QR Code for this Location
                          </Label>
                          <Switch
                            id="generate-qr-gym"
                            checked={formData.generate_qr}
                            onCheckedChange={(checked) => setFormData({ ...formData, generate_qr: checked })}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Creates a permanent QR linked only to this gym. Customers scan it on-site to unlock the booking page and pricing.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingGym ? "Update Gym" : "Create Gym"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Post-create QR preview dialog */}
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                Static QR Code generated
              </DialogTitle>
            </DialogHeader>
            {qrGym && (
              <GymQRCode
                gymId={qrGym.id}
                gymName={qrGym.name}
                cityName={qrGym.cities?.name}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : gyms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Building2 className="w-10 h-10 opacity-30" />
            <p className="text-sm">No gyms for {selectedCountry?.name || "this country"} yet.</p>
            <Button variant="outline" onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Add First Gym
            </Button>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Gym</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="hidden md:table-cell">Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gyms.map((gym) => (
                  <TableRow key={gym.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-medium text-sm">{gym.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{gym.cities?.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                      {gym.address}
                    </TableCell>
                    <TableCell>
                      <Badge variant={gym.is_active ? "default" : "secondary"} className="text-[10px]">
                        {gym.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(gym)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="View QR Code"
                          onClick={() => { setQrGym(gym); setQrDialogOpen(true); }}
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Pricing"
                          onClick={() => { setPricingGym(gym); setPricingOpen(true); }}
                        >
                          <Tag className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(gym.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {pricingGym && (
        <VenuePricingDialog
          open={pricingOpen}
          onOpenChange={(o) => { setPricingOpen(o); if (!o) setPricingGym(null); }}
          venueType="gym"
          venueId={pricingGym.id}
          venueName={pricingGym.name}
          countryId={pricingGym.country_id ?? activeCountryId}
          currencySymbol={selectedCountry?.currency_symbol || "€"}
        />
      )}
    </AdminLayout>
  );
};

export default AdminGyms;
