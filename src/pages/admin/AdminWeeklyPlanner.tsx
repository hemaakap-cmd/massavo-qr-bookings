import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useWeeklySchedules, useWeeklyScheduleMutations, type TherapistWeeklySchedule } from "@/hooks/useWeeklySchedules";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, Users, Clock, Building2, Hotel, House } from "lucide-react";
import type { DayOfWeek } from "@/types/schedule";
import { DAY_OF_WEEK_LABELS } from "@/types/schedule";
import { useAuth } from "@/hooks/useAuth";
import { useCountryData } from "@/hooks/useCountry";

const DAYS: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_SHORT: Record<DayOfWeek, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
};

const AdminWeeklyPlanner = () => {
  const { countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>("monday");
  const [selectedTherapist, setSelectedTherapist] = useState("");
  const [selectedVenue, setSelectedVenue] = useState(""); // gym:<id> | hotel:<id> | home
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const { toast } = useToast();

  const { data: schedules = [], isLoading } = useWeeklySchedules();
  const { createSchedule, deleteSchedule } = useWeeklyScheduleMutations();

  const { data: gyms = [] } = useQuery({
    queryKey: ["gyms-planner", selectedCountry?.id],
    queryFn: async () => {
      let query = supabase.from("gyms").select("id, name").eq("is_active", true).order("name");
      if (selectedCountry?.id) query = query.eq("country_id", selectedCountry.id);
      const { data } = await query;
      return data || [];
    },
  });

  const { data: hotels = [] } = useQuery({
    queryKey: ["hotels-planner", selectedCountry?.id],
    queryFn: async () => {
      let query = supabase.from("hotels").select("id, name").eq("is_active", true).order("name");
      if (selectedCountry?.id) query = query.eq("country_id", selectedCountry.id);
      const { data } = await query;
      return data || [];
    },
  });

  const { data: cities = [] } = useQuery({
    queryKey: ["cities-planner", selectedCountry?.id],
    queryFn: async () => {
      let query = supabase.from("cities").select("id, name").eq("is_active", true).order("name");
      if (selectedCountry?.id) query = query.eq("country_id", selectedCountry.id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: therapists = [] } = useQuery({
    queryKey: ["therapists-planner", selectedCountry?.id, gyms.length, cities.length],
    queryFn: async () => {
      const gymIds = new Set(gyms.map((gym) => gym.id));
      const cityIds = new Set(cities.map((city) => city.id));
      const { data, error } = await supabase
        .from("therapists")
        .select("id, name, gym_id, therapist_gyms(gym_id), therapist_cities(city_id)")
        .eq("is_available", true)
        .order("name");
      if (error) throw error;
      return (data || []).filter((therapist: any) => {
        if (!selectedCountry?.id) return true;
        const hasGym = gymIds.has(therapist.gym_id)
          || (therapist.therapist_gyms || []).some((item: any) => gymIds.has(item.gym_id));
        const hasHomeCity = (therapist.therapist_cities || [])
          .some((item: any) => cityIds.has(item.city_id));
        return hasGym || hasHomeCity;
      });
    },
    enabled: !selectedCountry?.id || gyms.length > 0 || cities.length > 0,
  });

  const homeTherapistIds = useMemo(
    () => new Set(therapists
      .filter((therapist: any) => (therapist.therapist_cities || []).length > 0)
      .map((therapist) => therapist.id)),
    [therapists],
  );

  // Build grid: therapist rows × day columns (each cell can have multiple gyms)
  const grid = useMemo(() => {
    const map = new Map<string, Map<DayOfWeek, TherapistWeeklySchedule[]>>();
    therapists.forEach(t => {
      const dayMap = new Map<DayOfWeek, TherapistWeeklySchedule[]>();
      DAYS.forEach(d => dayMap.set(d, []));
      map.set(t.id, dayMap);
    });

    schedules.forEach(s => {
      const dayMap = map.get(s.therapist_id);
      if (dayMap) {
        dayMap.get(s.day_of_week)?.push(s);
      }
    });

    return map;
  }, [schedules, therapists]);

  const handleAdd = async () => {
    if (!selectedTherapist || !selectedVenue) return;
    const [vType, vId] = selectedVenue.split(":");
    if (vType === "home" && !homeTherapistIds.has(selectedTherapist)) {
      toast({
        title: "Home Visit city required",
        description: "Assign this therapist to at least one Home Visit city first.",
        variant: "destructive",
      });
      return;
    }
    try {
      await createSchedule.mutateAsync({
        therapist_id: selectedTherapist,
        gym_id: vType === "gym" ? vId : null,
        hotel_id: vType === "hotel" ? vId : null,
        day_of_week: selectedDay,
        start_time: startTime,
        end_time: endTime,
      });
      toast({ title: "Schedule Created" });
      setShowAddDialog(false);
      setSelectedTherapist("");
      setSelectedVenue("");
      setStartTime("09:00");
      setEndTime("17:00");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message?.includes("duplicate") ? "This therapist is already scheduled at this venue on this day" : err.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    await deleteSchedule.mutateAsync(id);
    toast({ title: "Schedule Removed" });
  };

  // Stats
  const uniqueTherapists = new Set(schedules.map(s => s.therapist_id)).size;
  const totalSlots = schedules.length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">Weekly Schedules</h2>
            <p className="text-muted-foreground text-sm">
              Define recurring weekly therapist assignments. Bookings auto-assign based on these schedules.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card><CardContent className="p-4 text-center">
            <Users className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
            <p className="text-lg font-bold">{uniqueTherapists}</p>
            <p className="text-[11px] text-muted-foreground">Active Therapists</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Clock className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
            <p className="text-lg font-bold">{totalSlots}</p>
            <p className="text-[11px] text-muted-foreground">Weekly Slots</p>
          </CardContent></Card>
        </div>

        {/* Grid */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium w-40">Therapist</th>
                  {DAYS.map(day => (
                    <th key={day} className="text-center py-3 px-2 text-muted-foreground font-medium min-w-[130px]">
                      {DAY_SHORT[day]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {therapists.map(t => (
                  <tr key={t.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-3 px-4 font-medium text-foreground">{t.name}</td>
                    {DAYS.map(day => {
                      const entries = grid.get(t.id)?.get(day) || [];
                      return (
                        <td key={day} className="py-2 px-2 text-center align-top">
                          <div className="flex flex-col gap-1 items-center">
                            {entries.map(entry => (
                              <div
                                key={entry.id}
                                className={`relative group inline-flex flex-col items-center px-2 py-1.5 rounded-md text-xs font-medium w-full ${entry.hotel_id ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : entry.gym_id ? "bg-primary/10 text-primary" : "bg-success/10 text-success"}`}
                              >
                                <span className="truncate max-w-[100px] flex items-center gap-1">
                                  {entry.hotel_id ? <Hotel className="w-3 h-3 shrink-0" /> : entry.gym_id ? <Building2 className="w-3 h-3 shrink-0" /> : <House className="w-3 h-3 shrink-0" />}
                                  {entry.venue_name || entry.gym_name || entry.hotel_name || "Home Visit"}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {entry.start_time.slice(0, 5)}–{entry.end_time.slice(0, 5)}
                                </span>
                                <button
                                  onClick={() => handleDelete(entry.id)}
                                  className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-destructive-foreground rounded-full p-0.5"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => {
                                setSelectedDay(day);
                                setSelectedTherapist(t.id);
                                setShowAddDialog(true);
                              }}
                              className="w-full py-1.5 rounded border border-dashed border-border/50 text-muted-foreground hover:border-primary hover:text-primary transition-colors text-xs"
                            >
                              <Plus className="w-3 h-3 mx-auto" />
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {therapists.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No therapists available</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Add Schedule Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">
              Add Schedule – {DAY_OF_WEEK_LABELS[selectedDay]}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Therapist</label>
              <Select value={selectedTherapist} onValueChange={setSelectedTherapist}>
                <SelectTrigger><SelectValue placeholder="Select therapist" /></SelectTrigger>
                <SelectContent>
                  {therapists.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Service location</label>
              <Select value={selectedVenue} onValueChange={setSelectedVenue}>
                <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
                <SelectContent>
                  {gyms.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3" />Gyms</div>
                      {gyms.map(g => (
                        <SelectItem key={`gym:${g.id}`} value={`gym:${g.id}`}>{g.name}</SelectItem>
                      ))}
                    </>
                  )}
                  {hotels.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1 mt-1"><Hotel className="w-3 h-3" />Hotels</div>
                      {hotels.map(h => (
                        <SelectItem key={`hotel:${h.id}`} value={`hotel:${h.id}`}>{h.name}</SelectItem>
                      ))}
                    </>
                  )}
                  <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1 mt-1"><House className="w-3 h-3" />Home Visit</div>
                  <SelectItem value="home:general" disabled={!homeTherapistIds.has(selectedTherapist)}>
                    Home Visit{selectedTherapist && !homeTherapistIds.has(selectedTherapist) ? " — assign a city first" : ""}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Start Time</label>
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">End Time</label>
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleAdd} disabled={!selectedTherapist || !selectedVenue || createSchedule.isPending} className="w-full">
              {createSchedule.isPending ? "Creating..." : "Add Schedule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminWeeklyPlanner;
