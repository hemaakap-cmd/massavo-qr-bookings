import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWeeklyScheduleMutations } from "@/hooks/useWeeklySchedules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Edit, Home, Info } from "lucide-react";
import { DAY_OF_WEEK_OPTIONS, DAY_OF_WEEK_LABELS, type DayOfWeek } from "@/types/schedule";
import { toast } from "sonner";

interface Props {
  cityId: string;
  cityName: string;
}

interface Row {
  id: string;
  therapist_id: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  is_active: boolean;
  gym_id: string | null;
  hotel_id: string | null;
  venue_label: string;
}

export function HomeVisitScheduleManager({ cityId, cityName }: Props) {
  const queryClient = useQueryClient();
  const { createSchedule, updateSchedule, deleteSchedule } = useWeeklyScheduleMutations();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    therapist_id: "",
    day_of_week: "monday" as DayOfWeek,
    start_time: "09:00",
    end_time: "18:00",
  });

  const { data: therapists = [], isLoading: therapistsLoading } = useQuery({
    queryKey: ["home-visit-therapists", cityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapist_cities")
        .select("therapist_id, therapists(id, name, is_available)")
        .eq("city_id", cityId);
      if (error) throw error;
      return (data || [])
        .map((r: any) => r.therapists)
        .filter(Boolean)
        .sort((a: any, b: any) => a.name.localeCompare(b.name)) as {
        id: string;
        name: string;
        is_available: boolean | null;
      }[];
    },
    enabled: !!cityId,
  });

  const therapistIds = therapists.map((t) => t.id);

  const { data: rows = [], isLoading: rowsLoading } = useQuery({
    queryKey: ["home-visit-schedules", cityId, therapistIds.join(",")],
    queryFn: async () => {
      if (therapistIds.length === 0) return [] as Row[];
      const { data, error } = await supabase
        .from("therapist_weekly_schedules")
        .select("*, gyms(name), hotels(name)")
        .in("therapist_id", therapistIds)
        .is("gym_id", null)
        .is("hotel_id", null)
        .order("day_of_week");
      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        venue_label: "Home Visit",
      })) as Row[];
    },
    enabled: therapistIds.length > 0,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["home-visit-schedules"] });
  };

  const resetForm = () => {
    setFormData({ therapist_id: "", day_of_week: "monday", start_time: "09:00", end_time: "18:00" });
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!formData.therapist_id) {
      toast.error("Select a therapist");
      return;
    }
    if (formData.start_time >= formData.end_time) {
      toast.error("End time must be after start time");
      return;
    }
    try {
      if (editingId) {
        await updateSchedule.mutateAsync({
          id: editingId,
          start_time: formData.start_time,
          end_time: formData.end_time,
        });
      } else {
        await createSchedule.mutateAsync({
          therapist_id: formData.therapist_id,
          gym_id: null,
          hotel_id: null,
          day_of_week: formData.day_of_week,
          start_time: formData.start_time,
          end_time: formData.end_time,
        });
      }
      toast.success("Schedule saved");
      setIsDialogOpen(false);
      resetForm();
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Could not save the schedule");
    }
  };

  const openEdit = (row: Row) => {
    setEditingId(row.id);
    setFormData({
      therapist_id: row.therapist_id,
      day_of_week: row.day_of_week,
      start_time: row.start_time?.slice(0, 5) || "09:00",
      end_time: row.end_time?.slice(0, 5) || "18:00",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this shift?")) return;
    try {
      await deleteSchedule.mutateAsync(id);
      toast.success("Shift deleted");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Could not delete the shift");
    }
  };

  const handleToggle = async (id: string, is_active: boolean) => {
    try {
      await updateSchedule.mutateAsync({ id, is_active });
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Could not update the shift");
    }
  };

  const therapistName = (id: string) => therapists.find((t) => t.id === id)?.name || "—";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2">
          <Home className="h-5 w-5" />
          Home Visit availability — {cityName}
        </CardTitle>
        <Button
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          disabled={therapists.length === 0}
        >
          <Plus className="h-4 w-4 mr-2" /> Add shift
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 text-sm text-muted-foreground border rounded-lg p-3 bg-muted/40">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Home Visit slots come from the therapists assigned to this city and their active weekly shifts.
            A session must fit completely inside a shift (service duration + 5 min buffer), and a therapist
            can only hold one booking per time window across all cities.
          </p>
        </div>

        {therapistsLoading || rowsLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        ) : therapists.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground border rounded-lg bg-muted/50">
            <Home className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No therapist is assigned to {cityName} yet, so Home Visit has no availability here.</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground border rounded-lg bg-muted/50">
            <p>{therapists.length} therapist(s) cover {cityName}, but none has a weekly shift yet.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Therapist</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{therapistName(row.therapist_id)}</TableCell>
                  <TableCell>{DAY_OF_WEEK_LABELS[row.day_of_week]}</TableCell>
                  <TableCell>
                    {row.start_time?.slice(0, 5)} – {row.end_time?.slice(0, 5)}
                  </TableCell>
                  <TableCell>
                    {row.gym_id || row.hotel_id ? (
                      <Badge variant="outline">{row.venue_label}</Badge>
                    ) : (
                      <Badge>Home Visit / General</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch checked={row.is_active} onCheckedChange={(v) => handleToggle(row.id, v)} />
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(row.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit shift" : "Add Home Visit shift"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Therapist</Label>
              <Select
                value={formData.therapist_id}
                onValueChange={(v) => setFormData((f) => ({ ...f, therapist_id: v }))}
                disabled={!!editingId}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a therapist" />
                </SelectTrigger>
                <SelectContent>
                  {therapists.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Day</Label>
              <Select
                value={formData.day_of_week}
                onValueChange={(v) => setFormData((f) => ({ ...f, day_of_week: v as DayOfWeek }))}
                disabled={!!editingId}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OF_WEEK_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start</Label>
                <Input
                  type="time"
                  className="mt-1"
                  value={formData.start_time}
                  onChange={(e) => setFormData((f) => ({ ...f, start_time: e.target.value }))}
                />
              </div>
              <div>
                <Label>End</Label>
                <Input
                  type="time"
                  className="mt-1"
                  value={formData.end_time}
                  onChange={(e) => setFormData((f) => ({ ...f, end_time: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createSchedule.isPending || updateSchedule.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
