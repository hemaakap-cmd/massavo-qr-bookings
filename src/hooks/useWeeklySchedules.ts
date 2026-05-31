import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DayOfWeek } from "@/types/schedule";
import { invalidateAllBookingSystem } from "@/utils/cacheSync";

export interface TherapistWeeklySchedule {
  id: string;
  therapist_id: string;
  gym_id: string | null;
  hotel_id: string | null;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  therapist_name?: string;
  gym_name?: string;
  hotel_name?: string;
  venue_name?: string;
  venue_type?: "gym" | "hotel";
}

export function useWeeklySchedules() {
  return useQuery({
    queryKey: ["therapist-weekly-schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapist_weekly_schedules")
        .select("*, therapists(name), gyms(name), hotels(name)")
        .eq("is_active", true)
        .order("day_of_week");

      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        therapist_name: s.therapists?.name,
        gym_name: s.gyms?.name,
        hotel_name: s.hotels?.name,
        venue_name: s.hotels?.name || s.gyms?.name,
        venue_type: s.hotel_id ? "hotel" : "gym",
      })) as TherapistWeeklySchedule[];
    },
  });
}

export function useWeeklyScheduleMutations() {
  const queryClient = useQueryClient();

  const createSchedule = useMutation({
    mutationFn: async (params: {
      therapist_id: string;
      gym_id?: string | null;
      hotel_id?: string | null;
      day_of_week: DayOfWeek;
      start_time: string;
      end_time: string;
    }) => {
      const { data, error } = await supabase
        .from("therapist_weekly_schedules")
        .insert(params)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAllBookingSystem(queryClient);
    },
  });

  const updateSchedule = useMutation({
    mutationFn: async (params: { id: string; start_time?: string; end_time?: string; is_active?: boolean }) => {
      const { id, ...updates } = params;
      const { error } = await supabase
        .from("therapist_weekly_schedules")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAllBookingSystem(queryClient);
    },
  });

  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("therapist_weekly_schedules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAllBookingSystem(queryClient);
    },
  });

  return { createSchedule, updateSchedule, deleteSchedule };
}
