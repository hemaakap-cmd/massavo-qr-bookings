import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useCountryData } from "@/hooks/useCountry";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Activity, Heart, Leaf, Package, Building2, Hotel as HotelIcon } from "lucide-react";

interface Service {
  id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  description_ar: string | null;
  duration_minutes: number;
  price: number;
  icon: string | null;
  is_active: boolean;
  country_id: string | null;
}

interface GymServiceAssignment {
  gym_id: string;
  gym_name: string;
  assigned: boolean;
  custom_price: number | null;
}

interface HotelServiceAssignment {
  hotel_id: string;
  hotel_name: string;
  assigned: boolean;
  custom_price: number | null;
}

const ICON_OPTIONS = [
  { value: "sports", label: "Sports", icon: Activity },
  { value: "recovery", label: "Recovery", icon: Heart },
  { value: "relaxation", label: "Relaxation", icon: Leaf },
];

const AdminServices = () => {
  const { t } = useTranslation();
  const { countryId } = useAuth();
  const { countries, selectedCountry, setSelectedCountryId } = useCountryData(countryId);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [gymDialogOpen, setGymDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [gymAssignments, setGymAssignments] = useState<GymServiceAssignment[]>([]);
  const [selectedServiceForGyms, setSelectedServiceForGyms] = useState<Service | null>(null);
  const [hotelDialogOpen, setHotelDialogOpen] = useState(false);
  const [hotelAssignments, setHotelAssignments] = useState<HotelServiceAssignment[]>([]);
  const [selectedServiceForHotels, setSelectedServiceForHotels] = useState<Service | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "",
    name_ar: "",
    description: "",
    description_ar: "",
    duration_minutes: 30,
    price: 0,
    icon: "relaxation",
    is_active: true,
  });

  const activeCountryId = selectedCountry?.id || null;

  useEffect(() => {
    fetchServices();
  }, [activeCountryId]);

  const fetchServices = async () => {
    setLoading(true);
    let query = supabase.from("services").select("id, name, name_ar, description, description_ar, duration_minutes, price, icon, is_active, country_id").order("name");
    if (activeCountryId) query = query.eq("country_id", activeCountryId);
    const { data, error } = await query;
    if (!error && data) setServices(data as Service[]);
    setLoading(false);
  };

  const openCreate = () => {
    setEditingService(null);
    setForm({ name: "", name_ar: "", description: "", description_ar: "", duration_minutes: 30, price: 0, icon: "relaxation", is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (service: Service) => {
    setEditingService(service);
    setForm({
      name: service.name,
      name_ar: service.name_ar || "",
      description: service.description || "",
      description_ar: service.description_ar || "",
      duration_minutes: service.duration_minutes,
      price: service.price,
      icon: service.icon || "relaxation",
      is_active: service.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Service name is required"); return; }
    if (form.price < 0) { toast.error("Price must be positive"); return; }

    const payload = {
      name: form.name.trim(),
      name_ar: form.name_ar.trim() || null,
      description: form.description.trim() || null,
      description_ar: form.description_ar.trim() || null,
      duration_minutes: form.duration_minutes,
      price: form.price,
      icon: form.icon,
      is_active: form.is_active,
      country_id: activeCountryId,
    };

    if (editingService) {
      const { error } = await supabase.from("services").update(payload).eq("id", editingService.id);
      if (error) { toast.error("Failed to update service"); return; }
      toast.success("Service updated");
    } else {
      const { error } = await supabase.from("services").insert(payload);
      if (error) { toast.error("Failed to create service"); return; }
      toast.success("Service created");
    }
    setDialogOpen(false);
    fetchServices();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this service? This cannot be undone.")) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) { toast.error("Failed to delete service"); return; }
    toast.success("Service deleted");
    fetchServices();
  };

  // Gym assignments
  const openGymAssignments = async (service: Service) => {
    setSelectedServiceForGyms(service);
    // Fetch gyms for this country
    let gymsQuery = supabase.from("gyms").select("id, name, country_id").eq("is_active", true);
    if (activeCountryId) gymsQuery = gymsQuery.eq("country_id", activeCountryId);
    const { data: gyms } = await gymsQuery.order("name");

    // Fetch existing assignments
    const { data: assignments } = await supabase
      .from("gym_services")
      .select("gym_id, custom_price, is_active")
      .eq("service_id", service.id);

    const assignmentMap = new Map((assignments || []).map((a: any) => [a.gym_id, a]));

    setGymAssignments(
      (gyms || []).map((g: any) => ({
        gym_id: g.id,
        gym_name: g.name,
        assigned: assignmentMap.has(g.id) && (assignmentMap.get(g.id) as any).is_active,
        custom_price: assignmentMap.has(g.id) ? (assignmentMap.get(g.id) as any).custom_price : null,
      }))
    );
    setGymDialogOpen(true);
  };

  const toggleGymAssignment = async (gymId: string, assigned: boolean) => {
    if (!selectedServiceForGyms) return;

    if (assigned) {
      const { error } = await supabase.from("gym_services").upsert(
        { gym_id: gymId, service_id: selectedServiceForGyms.id, is_active: true },
        { onConflict: "gym_id,service_id" }
      );
      if (error) { toast.error("Failed to assign"); return; }
    } else {
      const { error } = await supabase
        .from("gym_services")
        .update({ is_active: false })
        .eq("gym_id", gymId)
        .eq("service_id", selectedServiceForGyms.id);
      if (error) { toast.error("Failed to unassign"); return; }
    }

    setGymAssignments(prev =>
      prev.map(g => g.gym_id === gymId ? { ...g, assigned } : g)
    );
    toast.success(assigned ? "Service assigned to gym" : "Service removed from gym");
  };

  const updateCustomPrice = async (gymId: string, price: number | null) => {
    if (!selectedServiceForGyms) return;
    await supabase.from("gym_services").update({ custom_price: price }).eq("gym_id", gymId).eq("service_id", selectedServiceForGyms.id);
    setGymAssignments(prev =>
      prev.map(g => g.gym_id === gymId ? { ...g, custom_price: price } : g)
    );
  };

  // Hotel assignments — mirrors gym flow
  const openHotelAssignments = async (service: Service) => {
    setSelectedServiceForHotels(service);
    let hotelsQuery = supabase.from("hotels").select("id, name, country_id").eq("is_active", true);
    if (activeCountryId) hotelsQuery = hotelsQuery.eq("country_id", activeCountryId);
    const { data: hotels } = await hotelsQuery.order("name");
    const { data: assignments } = await supabase
      .from("hotel_services")
      .select("hotel_id, custom_price, is_active")
      .eq("service_id", service.id);
    const map = new Map((assignments || []).map((a: any) => [a.hotel_id, a]));
    setHotelAssignments(
      (hotels || []).map((h: any) => ({
        hotel_id: h.id,
        hotel_name: h.name,
        assigned: map.has(h.id) && (map.get(h.id) as any).is_active,
        custom_price: map.has(h.id) ? (map.get(h.id) as any).custom_price : null,
      }))
    );
    setHotelDialogOpen(true);
  };

  const toggleHotelAssignment = async (hotelId: string, assigned: boolean) => {
    if (!selectedServiceForHotels) return;
    if (assigned) {
      const { error } = await supabase.from("hotel_services").upsert(
        { hotel_id: hotelId, service_id: selectedServiceForHotels.id, is_active: true },
        { onConflict: "hotel_id,service_id" }
      );
      if (error) { toast.error("Failed to assign"); return; }
    } else {
      const { error } = await supabase.from("hotel_services").update({ is_active: false })
        .eq("hotel_id", hotelId).eq("service_id", selectedServiceForHotels.id);
      if (error) { toast.error("Failed to unassign"); return; }
    }
    setHotelAssignments(prev => prev.map(h => h.hotel_id === hotelId ? { ...h, assigned } : h));
    toast.success(assigned ? "Service assigned to hotel" : "Service removed from hotel");
  };

  const updateHotelCustomPrice = async (hotelId: string, price: number | null) => {
    if (!selectedServiceForHotels) return;
    await supabase.from("hotel_services").update({ custom_price: price }).eq("hotel_id", hotelId).eq("service_id", selectedServiceForHotels.id);
    setHotelAssignments(prev => prev.map(h => h.hotel_id === hotelId ? { ...h, custom_price: price } : h));
  };

  const getIconComponent = (icon: string | null) => {
    switch (icon) {
      case "sports": return Activity;
      case "recovery": return Heart;
      default: return Leaf;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-sidebar-primary flex items-center gap-2">
              <Package className="h-6 w-6" />
              Service Management
            </h1>
            <p className="text-sm text-admin-text-secondary mt-1">
              {selectedCountry ? `Services for ${selectedCountry.name}` : "All services"}
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            New Service
          </Button>
        </div>

        {/* Services List */}
        {loading ? (
          <div className="text-center py-12 text-admin-text-secondary">Loading...</div>
        ) : services.length === 0 ? (
          <Card className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground mb-2">No services yet</p>
            <p className="text-sm text-muted-foreground mb-4">Create your first service for {selectedCountry?.name || "this country"}</p>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Create Service
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4">
            {services.map((service) => {
              const Icon = getIconComponent(service.icon);
              return (
                <Card key={service.id} className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">{service.name}</h3>
                      {service.name_ar && <span className="text-sm text-muted-foreground">({service.name_ar})</span>}
                      {!service.is_active && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{service.description || "No description"}</p>
                    <div className="flex items-center gap-3 mt-1 text-sm">
                      <span className="font-medium text-primary">
                        {selectedCountry?.currency_symbol || "€"}{service.price.toFixed(2)}
                      </span>
                      <span className="text-muted-foreground">{service.duration_minutes} min</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => openGymAssignments(service)} title="Assign to gyms">
                      <Building2 className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openHotelAssignments(service)} title="Assign to hotels">
                      <HotelIcon className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(service)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(service.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingService ? "Edit Service" : "Create Service"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Sports Massage" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Duration (min)</Label>
                  <Input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-2">
                  <Label>Price ({selectedCountry?.currency_symbol || "€"})</Label>
                  <Input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <Select value={form.icon} onValueChange={v => setForm(f => ({ ...f, icon: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>
                          <div className="flex items-center gap-2">
                            <o.icon className="h-4 w-4" />
                            {o.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>{editingService ? "Update" : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Gym Assignments Dialog */}
        <Dialog open={gymDialogOpen} onOpenChange={setGymDialogOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Gym Assignments — {selectedServiceForGyms?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {gymAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No gyms found for this country</p>
              ) : (
                gymAssignments.map(ga => (
                  <div key={ga.gym_id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={ga.assigned}
                        onCheckedChange={v => toggleGymAssignment(ga.gym_id, v)}
                      />
                      <span className="font-medium text-sm">{ga.gym_name}</span>
                    </div>
                    {ga.assigned && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">Custom price:</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={`${selectedCountry?.currency_symbol || "€"}${selectedServiceForGyms?.price.toFixed(2)}`}
                          className="w-24 h-8 text-sm"
                          value={ga.custom_price ?? ""}
                          onChange={e => {
                            const val = e.target.value ? parseFloat(e.target.value) : null;
                            updateCustomPrice(ga.gym_id, val);
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Hotel Assignments Dialog */}
        <Dialog open={hotelDialogOpen} onOpenChange={setHotelDialogOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HotelIcon className="h-5 w-5" />
                Hotel Assignments — {selectedServiceForHotels?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {hotelAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No hotels found for this country</p>
              ) : (
                hotelAssignments.map(ha => (
                  <div key={ha.hotel_id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={ha.assigned}
                        onCheckedChange={v => toggleHotelAssignment(ha.hotel_id, v)}
                      />
                      <span className="font-medium text-sm">{ha.hotel_name}</span>
                    </div>
                    {ha.assigned && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">Custom price:</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={`${selectedCountry?.currency_symbol || "€"}${selectedServiceForHotels?.price.toFixed(2)}`}
                          className="w-24 h-8 text-sm"
                          value={ha.custom_price ?? ""}
                          onChange={e => {
                            const val = e.target.value ? parseFloat(e.target.value) : null;
                            updateHotelCustomPrice(ha.hotel_id, val);
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminServices;
