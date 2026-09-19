import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Edit, House, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWeeklyScheduleMutations } from "@/hooks/useWeeklySchedules";
import { DAY_OF_WEEK_LABELS, DAY_OF_WEEK_OPTIONS, type DayOfWeek } from "@/types/schedule";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface CityOption {
  id: string;
  name: string;
}

interface HomeSchedule {
  id: string;
  city_id: string | null;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface Props {
  therapistId: string;
  cities: CityOption[];
  assignedCityIds: string[];
}

const EMPTY_FORM = {
  city_id: "",
  day_of_week: "monday" as DayOfWeek,
  start_time: "09:00",
  end_time: "18:00",
};

export function HomeVisitWorkingHours({ therapistId, cities, assignedCityIds }: Props) {
  const { toast } = useToast();
  const { createSchedule, updateSchedule, deleteSchedule } = useWeeklyScheduleMutations();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const assignedCities = useMemo(
    () => cities.filter((city) => assignedCityIds.includes(city.id)),
    [assignedCityIds, cities],
  );

  const { data: schedules = [], isLoading, refetch } = useQuery({
    queryKey: ["therapist-home-hours", therapistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapist_weekly_schedules")
        .select("id, city_id, day_of_week, start_time, end_time, is_active")
        .eq("therapist_id", therapistId)
        .is("gym_id", null)
        .is("hotel_id", null);
      if (error) throw error;
      return (data || []) as HomeSchedule[];
    },
  });

  const orderedSchedules = useMemo(() => {
    const dayOrder = new Map(DAY_OF_WEEK_OPTIONS.map((day, index) => [day.value, index]));
    return [...schedules].sort((a, b) => {
      const cityA = cities.find((city) => city.id === a.city_id)?.name || "All cities";
      const cityB = cities.find((city) => city.id === b.city_id)?.name || "All cities";
      return cityA.localeCompare(cityB) || (dayOrder.get(a.day_of_week) ?? 0) - (dayOrder.get(b.day_of_week) ?? 0);
    });
  }, [cities, schedules]);

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, city_id: assignedCities[0]?.id || "" });
    setDialogOpen(true);
  };

  const openEdit = (schedule: HomeSchedule) => {
    setEditingId(schedule.id);
    setForm({
      city_id: schedule.city_id || "all",
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time.slice(0, 5),
      end_time: schedule.end_time.slice(0, 5),
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.city_id) {
      toast({ title: "Choose a Home Visit city", variant: "destructive" });
      return;
    }
    if (form.start_time >= form.end_time) {
      toast({ title: "End time must be after start time", variant: "destructive" });
      return;
    }

    try {
      const cityId = form.city_id === "all" ? null : form.city_id;
      if (editingId) {
        await updateSchedule.mutateAsync({
          id: editingId,
          city_id: cityId,
          day_of_week: form.day_of_week,
          start_time: form.start_time,
          end_time: form.end_time,
        });
      } else {
        await createSchedule.mutateAsync({
          therapist_id: therapistId,
          gym_id: null,
          hotel_id: null,
          city_id: cityId,
          day_of_week: form.day_of_week,
          start_time: form.start_time,
          end_time: form.end_time,
        });
      }
      await refetch();
      toast({ title: "Home Visit hours saved" });
      closeDialog();
    } catch (error) {
      toast({
        title: "Could not save Home Visit hours",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteSchedule.mutateAsync(id);
      await refetch();
      toast({ title: "Home Visit shift removed" });
    } catch (error) {
      toast({
        title: "Could not remove shift",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  const toggle = async (id: string, isActive: boolean) => {
    try {
      await updateSchedule.mutateAsync({ id, is_active: isActive });
      await refetch();
    } catch (error) {
      toast({
        title: "Could not update shift",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 font-medium">
            <House className="h-4 w-4" /> Home Visit Working Hours
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Set the exact days and hours this therapist serves each assigned city.
          </p>
        </div>
        <Button type="button" size="sm" onClick={openCreate} disabled={assignedCities.length === 0}>
          <Plus className="mr-1 h-4 w-4" /> Add hours
        </Button>
      </div>

      {assignedCities.length === 0 ? (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Assign at least one Home Visit city above, save the therapist, then add working hours.
        </p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading Home Visit hours…</p>
      ) : orderedSchedules.length === 0 ? (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          No Home Visit days are configured. Customers cannot book this therapist for a Home Visit yet.
        </p>
      ) : (
        <div className="space-y-2">
          {orderedSchedules.map((schedule) => {
            const cityName = schedule.city_id
              ? cities.find((city) => city.id === schedule.city_id)?.name || "Unknown city"
              : "All assigned cities";
            return (
              <div key={schedule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-3 py-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={schedule.city_id ? "secondary" : "outline"}>{cityName}</Badge>
                    <span className="text-sm font-medium">{DAY_OF_WEEK_LABELS[schedule.day_of_week]}</span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {schedule.start_time.slice(0, 5)}–{schedule.end_time.slice(0, 5)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Switch
                    checked={schedule.is_active}
                    onCheckedChange={(checked) => toggle(schedule.id, checked)}
                    aria-label={`Toggle ${cityName} shift`}
                  />
                  <Button type="button" size="icon" variant="ghost" onClick={() => openEdit(schedule)} aria-label="Edit Home Visit hours">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => remove(schedule.id)} aria-label="Delete Home Visit hours">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Home Visit hours" : "Add Home Visit hours"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>City</Label>
              <Select value={form.city_id} onValueChange={(city_id) => setForm((current) => ({ ...current, city_id }))}>
                <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                <SelectContent>
                  {editingId && form.city_id === "all" && <SelectItem value="all">All assigned cities</SelectItem>}
                  {assignedCities.map((city) => <SelectItem key={city.id} value={city.id}>{city.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Day</Label>
              <Select value={form.day_of_week} onValueChange={(day) => setForm((current) => ({ ...current, day_of_week: day as DayOfWeek }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAY_OF_WEEK_OPTIONS.map((day) => <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start</Label>
                <Input type="time" value={form.start_time} onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>End</Label>
                <Input type="time" value={form.end_time} onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button type="button" onClick={save} disabled={createSchedule.isPending || updateSchedule.isPending}>Save hours</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}