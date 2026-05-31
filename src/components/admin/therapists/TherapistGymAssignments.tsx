import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Star, MapPin } from "lucide-react";
import {
  GymAssignment,
  GymDaySchedule,
  DayOfWeek,
  ALL_DAYS,
  dayLabels,
  createDefaultSchedules,
} from "@/types/therapist";

interface Gym {
  id: string;
  name: string;
}

interface TherapistGymAssignmentsProps {
  assignments: GymAssignment[];
  onChange: (assignments: GymAssignment[]) => void;
  gyms: Gym[];
}

export function TherapistGymAssignments({
  assignments,
  onChange,
  gyms,
}: TherapistGymAssignmentsProps) {
  const assignedGymIds = assignments.map((a) => a.gym_id);
  const availableGyms = gyms.filter((g) => !assignedGymIds.includes(g.id));

  const addGym = (gymId: string) => {
    const gym = gyms.find((g) => g.id === gymId);
    if (!gym) return;

    const newAssignment: GymAssignment = {
      gym_id: gymId,
      gym_name: gym.name,
      is_primary: assignments.length === 0, // first gym is primary
      schedules: createDefaultSchedules(),
    };
    onChange([...assignments, newAssignment]);
  };

  const removeGym = (gymId: string) => {
    const updated = assignments.filter((a) => a.gym_id !== gymId);
    // If removed gym was primary, make first remaining one primary
    if (updated.length > 0 && !updated.some((a) => a.is_primary)) {
      updated[0].is_primary = true;
    }
    onChange(updated);
  };

  const setPrimary = (gymId: string) => {
    onChange(
      assignments.map((a) => ({ ...a, is_primary: a.gym_id === gymId }))
    );
  };

  const updateSchedule = (
    gymId: string,
    day: DayOfWeek,
    field: keyof GymDaySchedule,
    value: string | boolean
  ) => {
    onChange(
      assignments.map((a) => {
        if (a.gym_id !== gymId) return a;
        return {
          ...a,
          schedules: a.schedules.map((s) =>
            s.day_of_week === day ? { ...s, [field]: value } : s
          ),
        };
      })
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm text-muted-foreground border-b pb-2 flex-1">
          Gym Assignments & Weekly Schedules
        </h4>
      </div>

      {assignments.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          No gyms assigned yet. Add at least one gym below.
        </p>
      )}

      {assignments.map((assignment) => (
        <Card key={assignment.gym_id} className="border-border">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">
                  {assignment.gym_name || gyms.find((g) => g.id === assignment.gym_id)?.name}
                  {assignment.city_name && (
                    <span className="text-xs font-normal text-muted-foreground ml-1">({assignment.city_name})</span>
                  )}
                </CardTitle>
                {assignment.is_primary && (
                  <Badge variant="secondary" className="text-xs">
                    <Star className="w-3 h-3 mr-1" /> Primary
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {!assignment.is_primary && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPrimary(assignment.gym_id)}
                    className="text-xs h-7"
                  >
                    Set Primary
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeGym(assignment.gym_id)}
                  className="text-destructive hover:text-destructive h-7 w-7 p-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="space-y-1.5">
              {ALL_DAYS.map((day) => {
                const schedule = assignment.schedules.find(
                  (s) => s.day_of_week === day
                );
                if (!schedule) return null;
                return (
                  <div
                    key={day}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Switch
                      checked={schedule.is_active}
                      onCheckedChange={(checked) =>
                        updateSchedule(assignment.gym_id, day, "is_active", checked)
                      }
                      className="scale-75"
                    />
                    <span className="w-10 text-xs font-medium text-muted-foreground">
                      {dayLabels[day]}
                    </span>
                    {schedule.is_active && (
                      <>
                        <Input
                          type="time"
                          value={schedule.start_time}
                          onChange={(e) =>
                            updateSchedule(
                              assignment.gym_id,
                              day,
                              "start_time",
                              e.target.value
                            )
                          }
                          className="h-7 w-24 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">–</span>
                        <Input
                          type="time"
                          value={schedule.end_time}
                          onChange={(e) =>
                            updateSchedule(
                              assignment.gym_id,
                              day,
                              "end_time",
                              e.target.value
                            )
                          }
                          className="h-7 w-24 text-xs"
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {availableGyms.length > 0 && (
        <div className="flex items-center gap-2">
          <Select onValueChange={addGym}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Add gym assignment..." />
            </SelectTrigger>
            <SelectContent>
              {availableGyms.map((gym) => (
                <SelectItem key={gym.id} value={gym.id}>
                  {gym.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
