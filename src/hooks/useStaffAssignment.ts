import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { DayOfWeek } from "@/types/schedule";

export interface StaffAssignment {
  id: string;
  assignment_date: string;
  start_time: string;
  end_time: string;
  day_of_week?: DayOfWeek;
  is_primary?: boolean;
  source: "weekly" | "legacy";
  gym: {
    id: string;
    name: string;
    address: string;
    phone: string | null;
  } | null;
}

const DAY_NAMES: DayOfWeek[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * Fetches staff assignments for a date range by combining:
 * 1. New weekly recurring schedules (therapist_weekly_schedules)
 * 2. Legacy per-date assignments (therapist_assignments) as fallback
 */
export function useStaffAssignment({
  dateFrom,
  dateTo,
}: {
  dateFrom: string;
  dateTo: string;
}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["staff-assignment", user?.id, dateFrom, dateTo],
    enabled: !!user,
    queryFn: async () => {
      // Resolve therapist id
      const { data: therapist, error: tErr } = await supabase
        .from("therapists")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (tErr) throw tErr;
      if (!therapist) return [];

      const results: StaffAssignment[] = [];
      const coveredDates = new Set<string>();

      // 1. Get weekly schedules
      const { data: weeklySchedules } = await supabase
        .from("therapist_weekly_schedules")
        .select("id, day_of_week, start_time, end_time, is_primary, gym_id, gyms:gym_id(id, name, address, phone)")
        .eq("therapist_id", therapist.id)
        .eq("is_active", true);

      // 2. Get schedule exceptions to exclude disabled dates
      const allGymIds = (weeklySchedules || []).map((s: any) => s.gym_id);
      const exceptionDates = new Map<string, Set<string>>(); // gym_id -> Set<date>
      if (allGymIds.length > 0) {
        const { data: exceptions } = await supabase
          .from("schedule_exceptions")
          .select("gym_id, exception_date")
          .in("gym_id", allGymIds)
          .eq("is_disabled", true)
          .gte("exception_date", dateFrom)
          .lte("exception_date", dateTo);

        (exceptions || []).forEach((e: any) => {
          if (!exceptionDates.has(e.gym_id)) exceptionDates.set(e.gym_id, new Set());
          exceptionDates.get(e.gym_id)!.add(e.exception_date);
        });
      }

      if (weeklySchedules && weeklySchedules.length > 0) {
        // Generate assignments for each date in range that matches a weekly schedule
        const [fy, fm, fd] = dateFrom.split("-").map(Number);
        const [ty, tm, td] = dateTo.split("-").map(Number);
        const from = new Date(fy, fm - 1, fd);
        const to = new Date(ty, tm - 1, td);

        for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
          const dayOfWeek = DAY_NAMES[d.getDay()];
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

          const matching = weeklySchedules.filter(s => s.day_of_week === dayOfWeek);
          matching.forEach(s => {
            // Skip if gym has a schedule exception on this date
            const gymExceptions = exceptionDates.get((s as any).gym_id);
            if (gymExceptions?.has(dateStr)) return;

            coveredDates.add(dateStr);
            results.push({
              id: `${s.id}-${dateStr}`,
              assignment_date: dateStr,
              start_time: s.start_time,
              end_time: s.end_time,
              day_of_week: dayOfWeek,
              is_primary: (s as any).is_primary || false,
              source: "weekly",
              gym: s.gyms as any,
            });
          });
        }
      }

      // 2. Fallback: legacy per-date assignments for uncovered dates
      const { data: legacyData } = await supabase
        .from("therapist_assignments")
        .select("id, assignment_date, start_time, end_time, gyms:gym_id(id, name, address, phone)")
        .eq("therapist_id", therapist.id)
        .eq("status", "active")
        .gte("assignment_date", dateFrom)
        .lte("assignment_date", dateTo)
        .order("assignment_date", { ascending: true });

      (legacyData || []).forEach((a: any) => {
        if (!coveredDates.has(a.assignment_date)) {
          results.push({
            ...a,
            source: "legacy",
            gym: a.gyms,
          });
        }
      });

      results.sort((a, b) => a.assignment_date.localeCompare(b.assignment_date));
      return results;
    },
  });
}
