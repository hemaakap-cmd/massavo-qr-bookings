import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useCountryData } from "@/hooks/useCountry";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Users } from "lucide-react";
import {
  Therapist,
  TherapistFormData,
  initialTherapistFormData,
  ProfessionType,
  GymAssignment,
  createDefaultSchedules,
  DayOfWeek,
} from "@/types/therapist";
import { TherapistForm } from "@/components/admin/therapists/TherapistForm";
import { TherapistFilters } from "@/components/admin/therapists/TherapistFilters";
import { TherapistTable } from "@/components/admin/therapists/TherapistTable";
import { TherapistExport } from "@/components/admin/therapists/TherapistExport";
import { TherapistAIInsights } from "@/components/admin/therapists/TherapistAIInsights";

interface Gym {
  id: string;
  name: string;
  city_id?: string;
  latitude?: number;
  longitude?: number;
}

interface City {
  id: string;
  name: string;
}

type TherapistInsert = Database["public"]["Tables"]["therapists"]["Insert"];
type TherapistUpdate = Database["public"]["Tables"]["therapists"]["Update"];
type TherapistPrivateInfoInsert = Database["public"]["Tables"]["therapist_private_info"]["Insert"];

const AdminTherapists = () => {
  const { countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);

  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTherapist, setEditingTherapist] = useState<Therapist | null>(null);
  const [formData, setFormData] = useState<TherapistFormData>(initialTherapistFormData);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [professionFilter, setProfessionFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");

  // Sorting
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);

    // First fetch gyms filtered by country
    let gymsQuery = supabase.from("gyms").select("id, name, city_id").order("name");
    let citiesQuery = supabase.from("cities").select("id, name").order("name");

    if (selectedCountry?.id) {
      gymsQuery = gymsQuery.eq("country_id", selectedCountry.id);
      citiesQuery = citiesQuery.eq("country_id", selectedCountry.id);
    }

    const [gymsRes, citiesRes] = await Promise.all([gymsQuery, citiesQuery]);

    const countryGymIds = (gymsRes.data || []).map((g) => g.id);
    if (!gymsRes.error) setGyms(gymsRes.data || []);
    if (!citiesRes.error) setCities(citiesRes.data || []);

    // Fetch therapists - filter by gym_ids belonging to selected country
    let therapistsQuery = supabase
      .from("therapists")
      .select("*, gyms(name, address), cities(name), therapist_private_info(phone, email, address), therapist_gyms(gym_id, is_primary, gyms(id, name, cities:city_id(name)))")
      .order("name");

    if (selectedCountry?.id && countryGymIds.length > 0) {
      therapistsQuery = therapistsQuery.in("gym_id", countryGymIds);
    } else if (selectedCountry?.id && countryGymIds.length === 0) {
      // No gyms in this country = no therapists to show
      setTherapists([]);
      setLoading(false);
      return;
    }

    const therapistsRes = await therapistsQuery;

    if (therapistsRes.error) {
      toast({ title: "Error", description: therapistsRes.error.message, variant: "destructive" });
    } else {
      const mappedTherapists = (therapistsRes.data || []).map((therapist: any) => ({
        ...therapist,
        phone: therapist.therapist_private_info?.phone ?? null,
        email: therapist.therapist_private_info?.email ?? null,
        address: therapist.therapist_private_info?.address ?? null,
      }));
      setTherapists(mappedTherapists as unknown as Therapist[]);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedCountry?.id]);

  // Filter and sort therapists
  const filteredTherapists = useMemo(() => {
    let result = [...therapists];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.phone?.toLowerCase().includes(query) ||
          t.email?.toLowerCase().includes(query) ||
          t.cities?.name?.toLowerCase().includes(query) ||
          t.address?.toLowerCase().includes(query)
      );
    }

    if (cityFilter !== "all") {
      result = result.filter((t) => t.city_id === cityFilter);
    }

    if (professionFilter !== "all") {
      result = result.filter((t) => t.profession === professionFilter);
    }

    if (availabilityFilter !== "all") {
      result = result.filter((t) =>
        availabilityFilter === "available" ? t.is_available : !t.is_available
      );
    }

    result.sort((a, b) => {
      let aVal: string | number | boolean = "";
      let bVal: string | number | boolean = "";

      switch (sortField) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "profession":
          aVal = a.profession;
          bVal = b.profession;
          break;
        case "city":
          aVal = a.cities?.name?.toLowerCase() || "";
          bVal = b.cities?.name?.toLowerCase() || "";
          break;
        case "rating":
          aVal = a.rating;
          bVal = b.rating;
          break;
        case "is_available":
          aVal = a.is_available ? 1 : 0;
          bVal = b.is_available ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [therapists, searchQuery, cityFilter, professionFilter, availabilityFilter, sortField, sortDirection]);

  const hasActiveFilters =
    searchQuery !== "" ||
    cityFilter !== "all" ||
    professionFilter !== "all" ||
    availabilityFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setCityFilter("all");
    setProfessionFilter("all");
    setAvailabilityFilter("all");
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const saveGymAssignments = async (therapistId: string, assignments: GymAssignment[]) => {
    // Delete existing gym assignments
    await supabase.from("therapist_gyms" as any).delete().eq("therapist_id", therapistId);

    if (assignments.length > 0) {
      const entries = assignments.map((a) => ({
        therapist_id: therapistId,
        gym_id: a.gym_id,
        is_primary: a.is_primary,
      }));
      await (supabase as any).from("therapist_gyms").insert(entries);
    }
  };

  const saveCityAssignments = async (therapistId: string, cityIds: string[]) => {
    await (supabase as any).from("therapist_cities").delete().eq("therapist_id", therapistId);
    if (cityIds.length > 0) {
      const entries = cityIds.map((city_id) => ({ therapist_id: therapistId, city_id }));
      await (supabase as any).from("therapist_cities").insert(entries);
    }
  };

  const saveWeeklySchedules = async (therapistId: string, assignments: GymAssignment[]) => {
    // Delete existing schedules for this therapist
    const { error: deleteError } = await supabase
      .from("therapist_weekly_schedules")
      .delete()
      .eq("therapist_id", therapistId);

    if (deleteError) {
      console.error("Failed to clear old schedules:", deleteError);
      return false;
    }

    // Build new schedule entries
    const entries = assignments.flatMap((a) =>
      a.schedules
        .filter((s) => s.is_active)
        .map((s) => ({
          therapist_id: therapistId,
          gym_id: a.gym_id,
          day_of_week: s.day_of_week as DayOfWeek,
          start_time: s.start_time,
          end_time: s.end_time,
          is_active: true,
          is_primary: a.is_primary,
        }))
    );

    if (entries.length > 0) {
      const { error: insertError } = await supabase
        .from("therapist_weekly_schedules")
        .insert(entries);

      if (insertError) {
        console.error("Failed to save schedules:", insertError);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const primaryAssignment = formData.gym_assignments.find((a) => a.is_primary);
    const primaryGymId = primaryAssignment?.gym_id || formData.gym_id || null;

    if (formData.gym_assignments.length === 0) {
      toast({ title: "Error", description: "Please assign at least one gym", variant: "destructive" });
      return;
    }

    if (!formData.email?.trim() && !editingTherapist) {
      toast({ title: "Error", description: "Email is required to create a therapist account", variant: "destructive" });
      return;
    }

    const therapistBaseData = {
      gym_id: primaryGymId,
      name: formData.name,
      specialty: formData.specialty || null,
      rating: parseFloat(formData.rating) || 0,
      image_url: formData.image_url || null,
      is_available: formData.is_available,
      city_id: formData.city_id || null,
      latitude: formData.latitude ? parseFloat(formData.latitude) : null,
      longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      profession: formData.profession as ProfessionType,
      education: formData.education || null,
      notes: formData.notes || null,
      gender: formData.gender || null,
    };

    const therapistInsertData: TherapistInsert = therapistBaseData;
    const therapistUpdateData: TherapistUpdate = therapistBaseData;

    const privateInfoData = (therapistId: string): TherapistPrivateInfoInsert => ({
      therapist_id: therapistId,
      phone: formData.phone || null,
      email: formData.email || null,
      address: formData.address || null,
    });

    if (editingTherapist) {
      const { error } = await supabase
        .from("therapists")
        .update(therapistUpdateData)
        .eq("id", editingTherapist.id);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }

      const { error: privateInfoError } = await supabase
        .from("therapist_private_info")
        .upsert(privateInfoData(editingTherapist.id), { onConflict: "therapist_id" });

      if (privateInfoError) {
        toast({ title: "Error", description: privateInfoError.message, variant: "destructive" });
        return;
      }

      // If email changed on edit and is set, re-provision
      if (formData.email && formData.email !== editingTherapist.email) {
        const res = await supabase.functions.invoke("provision-therapist", {
          body: { email: formData.email, therapist_id: editingTherapist.id, name: formData.name },
        });
        if (res.error) {
          toast({ title: "Warning", description: "Therapist updated but auth re-link failed", variant: "destructive" });
        }
      }

      await saveGymAssignments(editingTherapist.id, formData.gym_assignments);
      await saveCityAssignments(editingTherapist.id, formData.serviceable_city_ids);
      const scheduleSaved = await saveWeeklySchedules(editingTherapist.id, formData.gym_assignments);
      if (!scheduleSaved) {
        toast({ title: "Warning", description: "Therapist updated but schedules may not have saved completely", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Therapist and schedules updated successfully" });
      }
      setIsDialogOpen(false);
      fetchData();
    } else {
      // ── ATOMIC: Create therapist record first, then provision auth ──
      const { data, error } = await supabase.from("therapists").insert(therapistInsertData).select("id").single();

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }

      if (data) {
        // Provision auth account (required for new therapists)
        const res = await supabase.functions.invoke("provision-therapist", {
          body: { email: formData.email, therapist_id: data.id, name: formData.name },
        });

        if (res.error || !res.data?.success) {
          // Rollback: delete the therapist record since auth provisioning failed
          await supabase.from("therapists").delete().eq("id", data.id);
          const errMsg = res.error?.message || res.data?.error || "Auth provisioning failed";
          toast({ title: "Error", description: `Therapist creation rolled back: ${errMsg}`, variant: "destructive" });
          return;
        }

        const { error: privateInfoError } = await supabase
          .from("therapist_private_info")
          .upsert(privateInfoData(data.id), { onConflict: "therapist_id" });

        if (privateInfoError) {
          toast({ title: "Error", description: privateInfoError.message, variant: "destructive" });
          return;
        }

        await saveGymAssignments(data.id, formData.gym_assignments);
        await saveCityAssignments(data.id, formData.serviceable_city_ids);
        const scheduleSaved = await saveWeeklySchedules(data.id, formData.gym_assignments);

        if (res.data?.was_existing) {
          toast({ title: "Success", description: "Therapist created & linked to existing auth account" });
        } else if (!scheduleSaved) {
          toast({ title: "Warning", description: "Therapist created with auth account but schedules may not have saved", variant: "destructive" });
        } else {
          toast({ title: "Success", description: "Therapist created with auth account successfully" });
        }
      }
      setIsDialogOpen(false);
      fetchData();
    }
  };

  const handleEdit = async (therapist: Therapist) => {
    setEditingTherapist(therapist);

    // Load gym assignments, weekly schedules, and city assignments in parallel
    const [gymAssignmentsRes, schedulesRes, cityAssignmentsRes] = await Promise.all([
      (supabase as any)
        .from("therapist_gyms")
        .select("gym_id, is_primary, gyms(id, name, cities:city_id(name))")
        .eq("therapist_id", therapist.id),
      supabase
        .from("therapist_weekly_schedules")
        .select("*")
        .eq("therapist_id", therapist.id),
      (supabase as any)
        .from("therapist_cities")
        .select("city_id")
        .eq("therapist_id", therapist.id),
    ]);

    const gymAssignments = gymAssignmentsRes.data;
    const schedules = schedulesRes.data;
    const cityAssignments = cityAssignmentsRes.data;

    // Build serviceable city ids
    const serviceable_city_ids = (cityAssignments || []).map((ca: any) => ca.city_id);

    // Group schedules by gym_id into GymAssignments
    const gymMap = new Map<string, GymAssignment>();

    // First populate from junction table
    if (gymAssignments) {
      for (const ga of gymAssignments as any[]) {
        gymMap.set(ga.gym_id, {
          gym_id: ga.gym_id,
          gym_name: ga.gyms?.name,
          city_name: ga.gyms?.cities?.name,
          is_primary: ga.is_primary,
          schedules: createDefaultSchedules(),
        });
      }
    }

    // Overlay weekly schedules
    if (schedules) {
      for (const s of schedules) {
        if (!gymMap.has(s.gym_id)) {
          const gym = gyms.find((g) => g.id === s.gym_id);
          gymMap.set(s.gym_id, {
            gym_id: s.gym_id,
            gym_name: gym?.name,
            is_primary: s.is_primary,
            schedules: createDefaultSchedules(),
          });
        }
        const assignment = gymMap.get(s.gym_id)!;
        const daySchedule = assignment.schedules.find(
          (d) => d.day_of_week === s.day_of_week
        );
        if (daySchedule) {
          daySchedule.is_active = s.is_active;
          daySchedule.start_time = s.start_time;
          daySchedule.end_time = s.end_time;
        }
      }
    }

    // Fallback: if no data but therapist has a gym_id
    if (gymMap.size === 0 && therapist.gym_id) {
      const gym = gyms.find((g) => g.id === therapist.gym_id);
      gymMap.set(therapist.gym_id, {
        gym_id: therapist.gym_id,
        gym_name: gym?.name,
        is_primary: true,
        schedules: createDefaultSchedules(),
      });
    }

    setFormData({
      gym_id: therapist.gym_id,
      name: therapist.name,
      specialty: therapist.specialty || "",
      rating: therapist.rating.toString(),
      image_url: therapist.image_url || "",
      is_available: therapist.is_available,
      phone: therapist.phone || "",
      email: therapist.email || "",
      city_id: therapist.city_id || "",
      address: therapist.address || "",
      latitude: therapist.latitude?.toString() || "",
      longitude: therapist.longitude?.toString() || "",
      profession: therapist.profession || "massage_therapist",
      education: therapist.education || "",
      notes: therapist.notes || "",
      gender: (therapist as any).gender || "",
      gym_assignments: Array.from(gymMap.values()),
      serviceable_city_ids: serviceable_city_ids,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this therapist?")) return;

    const { error } = await supabase.from("therapists").delete().eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Therapist deleted successfully" });
      fetchData();
    }
  };

  const resetForm = () => {
    setEditingTherapist(null);
    setFormData(initialTherapistFormData);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sage/10 rounded-lg">
              <Users className="w-6 h-6 text-sage" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">Therapists</h2>
              <p className="text-muted-foreground">
                {filteredTherapists.length} of {therapists.length} therapists
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TherapistExport therapists={filteredTherapists} />
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button variant="sage">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Therapist
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingTherapist ? "Edit Therapist" : "Add New Therapist"}
                  </DialogTitle>
                </DialogHeader>
                <TherapistForm
                  formData={formData}
                  onFormChange={setFormData}
                  onSubmit={handleSubmit}
                  gyms={gyms}
                  cities={cities}
                  isEditing={!!editingTherapist}
                  therapistId={editingTherapist?.id}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* AI Insights */}
        <TherapistAIInsights />

        {/* Filters */}
        <TherapistFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          cityFilter={cityFilter}
          onCityFilterChange={setCityFilter}
          professionFilter={professionFilter}
          onProfessionFilterChange={setProfessionFilter}
          availabilityFilter={availabilityFilter}
          onAvailabilityFilterChange={setAvailabilityFilter}
          cities={cities}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-sage" />
          </div>
        ) : (
          <TherapistTable
            therapists={filteredTherapists}
            gyms={gyms}
            onEdit={handleEdit}
            onDelete={handleDelete}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminTherapists;
