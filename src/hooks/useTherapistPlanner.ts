import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, addDays } from "date-fns";
import { invalidateAllBookingSystem } from "@/utils/cacheSync";

export interface Assignment {
  id: string;
  therapist_id: string;
  gym_id: string;
  assignment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  therapist_name?: string;
  gym_name?: string;
}

export function useWeekAssignments(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6);
  const from = format(weekStart, "yyyy-MM-dd");
  const to = format(weekEnd, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["therapist-assignments", from],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapist_assignments")
        .select("*, therapists(name), gyms(name)")
        .gte("assignment_date", from)
        .lte("assignment_date", to)
        .eq("status", "active")
        .order("assignment_date");

      if (error) throw error;
      return (data || []).map((a: any) => ({
        ...a,
        therapist_name: a.therapists?.name,
        gym_name: a.gyms?.name,
      })) as Assignment[];
    },
  });
}

export function useAssignmentMutations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const createAssignment = useMutation({
    mutationFn: async (params: {
      therapist_id: string;
      gym_id: string;
      assignment_date: string;
      start_time?: string;
      end_time?: string;
    }) => {
      const { data, error } = await supabase
        .from("therapist_assignments")
        .insert({
          therapist_id: params.therapist_id,
          gym_id: params.gym_id,
          assignment_date: params.assignment_date,
          start_time: params.start_time || "09:00",
          end_time: params.end_time || "17:00",
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAllBookingSystem(queryClient);
    },
  });

  const updateAssignment = useMutation({
    mutationFn: async (params: { id: string; gym_id?: string; assignment_date?: string; start_time?: string; end_time?: string }) => {
      const { id, ...updates } = params;
      const { error } = await supabase
        .from("therapist_assignments")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAllBookingSystem(queryClient);
    },
  });

  const deleteAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("therapist_assignments")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAllBookingSystem(queryClient);
    },
  });

  const copyPreviousWeek = useMutation({
    mutationFn: async ({ fromWeekStart, toWeekStart }: { fromWeekStart: Date; toWeekStart: Date }) => {
      const from = format(fromWeekStart, "yyyy-MM-dd");
      const fromEnd = format(addDays(fromWeekStart, 6), "yyyy-MM-dd");
      
      const { data: prevFull, error: fetchErr } = await supabase
        .from("therapist_assignments")
        .select("*")
        .gte("assignment_date", from)
        .lte("assignment_date", fromEnd)
        .eq("status", "active");
      
      if (fetchErr) throw fetchErr;
      if (!prevFull?.length) throw new Error("No assignments to copy");

      const inserts = (prevFull || []).map(a => {
        const origDate = new Date(a.assignment_date + "T00:00:00");
        const dayOfWeek = origDate.getDay();
        const startDay = toWeekStart.getDay();
        const diff = ((dayOfWeek - startDay + 7) % 7);
        const newDate = addDays(toWeekStart, diff);

        return {
          therapist_id: a.therapist_id,
          gym_id: a.gym_id,
          assignment_date: format(newDate, "yyyy-MM-dd"),
          start_time: a.start_time,
          end_time: a.end_time,
          created_by: user?.id,
        };
      });

      // Filter out duplicates
      for (const ins of inserts) {
        await supabase.from("therapist_assignments").upsert(ins, {
          onConflict: "therapist_id,assignment_date",
        });
      }
    },
    onSuccess: () => {
      invalidateAllBookingSystem(queryClient);
    },
  });

  return { createAssignment, updateAssignment, deleteAssignment, copyPreviousWeek };
}
