import { useState } from "react";
import { useHotelSchedules } from "@/hooks/useHotelSchedules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Edit, Calendar } from "lucide-react";
import { DAY_OF_WEEK_OPTIONS, DAY_OF_WEEK_LABELS, type DayOfWeek } from "@/types/schedule";
import { format } from "date-fns";

interface HotelScheduleManagerProps {
  hotelId: string;
  hotelName: string;
}

export function HotelScheduleManager({ hotelId, hotelName }: HotelScheduleManagerProps) {
  const { schedules, isLoading, createSchedule, updateSchedule, deleteSchedule } = useHotelSchedules(hotelId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    day_of_week: "saturday" as DayOfWeek,
    start_time: "09:00",
    end_time: "17:00",
    max_hours_per_day: 8,
    slot_duration_minutes: 30,
  });

  const handleSubmit = async () => {
    if (editingSchedule) {
      await updateSchedule.mutateAsync({
        id: editingSchedule,
        ...formData,
      });
    } else {
      await createSchedule.mutateAsync({
        hotel_id: hotelId,
        ...formData,
      });
    }
    setIsDialogOpen(false);
    setEditingSchedule(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      day_of_week: "saturday",
      start_time: "09:00",
      end_time: "17:00",
      max_hours_per_day: 8,
      slot_duration_minutes: 30,
    });
  };

  const openEditDialog = (schedule: typeof schedules[0]) => {
    setEditingSchedule(schedule.id);
    setFormData({
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      max_hours_per_day: schedule.max_hours_per_day,
      slot_duration_minutes: schedule.slot_duration_minutes,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (scheduleId: string) => {
    if (confirm("Are you sure you want to delete this schedule?")) {
      await deleteSchedule.mutateAsync(scheduleId);
    }
  };

  const handleToggleActive = async (scheduleId: string, isActive: boolean) => {
    await updateSchedule.mutateAsync({ id: scheduleId, is_active: isActive });
  };

  // Get existing days to prevent duplicates
  const existingDays = schedules.map((s) => s.day_of_week);
  const availableDays = DAY_OF_WEEK_OPTIONS.filter(
    (d) => !existingDays.includes(d.value) || editingSchedule
  );

  if (isLoading) {
    return <div className="animate-pulse h-48 bg-muted rounded-lg" />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Weekly Schedule - {hotelName}</CardTitle>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => { resetForm(); setEditingSchedule(null); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Day
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSchedule ? "Edit Schedule" : "Add Working Day"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="day">Day of Week</Label>
                <Select
                  value={formData.day_of_week}
                  onValueChange={(value: DayOfWeek) => 
                    setFormData((prev) => ({ ...prev, day_of_week: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDays.map((day) => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="start_time">Start Time</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, start_time: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end_time">End Time</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, end_time: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="max_hours">Max Hours/Day</Label>
                  <Input
                    id="max_hours"
                    type="number"
                    min={1}
                    max={24}
                    value={formData.max_hours_per_day}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        max_hours_per_day: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="slot_duration">Slot Duration (min)</Label>
                  <Input
                    id="slot_duration"
                    type="number"
                    min={15}
                    max={120}
                    step={15}
                    value={formData.slot_duration_minutes}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        slot_duration_minutes: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={createSchedule.isPending || updateSchedule.isPending}>
                {editingSchedule ? "Save Changes" : "Add Schedule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {schedules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No weekly schedule configured.</p>
            <p className="text-sm">Add working days to enable bookings.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Max Hours</TableHead>
                <TableHead>Slot</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell className="font-medium">
                    {DAY_OF_WEEK_LABELS[schedule.day_of_week]}
                  </TableCell>
                  <TableCell>
                    {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                  </TableCell>
                  <TableCell>{schedule.max_hours_per_day}h</TableCell>
                  <TableCell>{schedule.slot_duration_minutes}min</TableCell>
                  <TableCell>
                    <Switch
                      checked={schedule.is_active}
                      onCheckedChange={(checked) => handleToggleActive(schedule.id, checked)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditDialog(schedule)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(schedule.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
