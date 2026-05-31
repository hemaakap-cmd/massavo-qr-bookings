import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { HotelSchedule, DayOfWeek, AvailableDate } from "@/types/schedule";

export function useHotelSchedules(hotelId?: string) {
  const queryClient = useQueryClient();

  const schedulesQuery = useQuery({
    queryKey: ["hotel-schedules", hotelId],
    queryFn: async () => {
      if (!hotelId) return [];
      
      const { data, error } = await supabase
        .from("hotel_schedules")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("day_of_week");

      if (error) throw error;
      return data as HotelSchedule[];
    },
    enabled: !!hotelId,
  });

  const availableDatesQuery = useQuery({
    queryKey: ["hotel-available-dates", hotelId],
    queryFn: async () => {
      if (!hotelId) return [];
      
      const { data, error } = await supabase
        .rpc("get_hotel_available_dates", {
          p_hotel_id: hotelId,
          p_start_date: new Date().toISOString().split("T")[0],
          p_months_ahead: 3,
        });

      if (error) throw error;
      return data as AvailableDate[];
    },
    enabled: !!hotelId,
  });

  const createSchedule = useMutation({
    mutationFn: async (schedule: {
      hotel_id: string;
      day_of_week: DayOfWeek;
      start_time: string;
      end_time: string;
      max_hours_per_day: number;
      slot_duration_minutes: number;
    }) => {
      const { data, error } = await supabase
        .from("hotel_schedules")
        .insert(schedule)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hotel-schedules", hotelId] });
      queryClient.invalidateQueries({ queryKey: ["hotel-available-dates", hotelId] });
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
    }: Partial<HotelSchedule> & { id: string }) => {
      const { data, error } = await supabase
        .from("hotel_schedules")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hotel-schedules", hotelId] });
      queryClient.invalidateQueries({ queryKey: ["hotel-available-dates", hotelId] });
      toast.success("Schedule updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update schedule: ${error.message}`);
    },
  });

  const deleteSchedule = useMutation({
    mutationFn: async (scheduleId: string) => {
      const { error } = await supabase
        .from("hotel_schedules")
        .delete()
        .eq("id", scheduleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hotel-schedules", hotelId] });
      queryClient.invalidateQueries({ queryKey: ["hotel-available-dates", hotelId] });
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
