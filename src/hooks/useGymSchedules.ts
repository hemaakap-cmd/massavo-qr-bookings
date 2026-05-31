import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { GymSchedule, DayOfWeek, AvailableDate } from "@/types/schedule";

export function useGymSchedules(gymId?: string) {
  const queryClient = useQueryClient();

  const schedulesQuery = useQuery({
    queryKey: ["gym-schedules", gymId],
    queryFn: async () => {
      if (!gymId) return [];
      
      const { data, error } = await supabase
        .from("gym_schedules")
        .select("*")
        .eq("gym_id", gymId)
        .order("day_of_week");

      if (error) throw error;
      return data as GymSchedule[];
    },
    enabled: !!gymId,
  });

  const availableDatesQuery = useQuery({
    queryKey: ["gym-available-dates", gymId],
    queryFn: async () => {
      if (!gymId) return [];
      
      const { data, error } = await supabase
        .rpc("get_gym_available_dates", {
          p_gym_id: gymId,
          p_start_date: new Date().toISOString().split("T")[0],
          p_months_ahead: 3,
        });

      if (error) throw error;
      return data as AvailableDate[];
    },
    enabled: !!gymId,
  });

  const createSchedule = useMutation({
    mutationFn: async (schedule: {
      gym_id: string;
      day_of_week: DayOfWeek;
      start_time: string;
      end_time: string;
      max_hours_per_day: number;
      slot_duration_minutes: number;
    }) => {
      const { data, error } = await supabase
        .from("gym_schedules")
        .insert(schedule)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gym-schedules", gymId] });
      queryClient.invalidateQueries({ queryKey: ["gym-available-dates", gymId] });
      toast.success("Schedule created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create schedule: ${error.message}`);
    },
  });

  const updateSchedule = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<GymSchedule> & { id: string }) => {
      const { data, error } = await supabase
        .from("gym_schedules")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gym-schedules", gymId] });
      queryClient.invalidateQueries({ queryKey: ["gym-available-dates", gymId] });
      toast.success("Schedule updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update schedule: ${error.message}`);
    },
  });

  const deleteSchedule = useMutation({
    mutationFn: async (scheduleId: string) => {
      const { error } = await supabase
        .from("gym_schedules")
        .delete()
        .eq("id", scheduleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gym-schedules", gymId] });
      queryClient.invalidateQueries({ queryKey: ["gym-available-dates", gymId] });
      toast.success("Schedule deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete schedule: ${error.message}`);
    },
  });

  return {
    schedules: schedulesQuery.data ?? [],
    availableDates: availableDatesQuery.data ?? [],
    isLoading: schedulesQuery.isLoading || availableDatesQuery.isLoading,
    isError: schedulesQuery.isError || availableDatesQuery.isError,
    createSchedule,
    updateSchedule,
    deleteSchedule,
  };
}
