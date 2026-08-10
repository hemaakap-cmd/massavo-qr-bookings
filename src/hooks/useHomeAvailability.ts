import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Home-visit availability — driven by the therapist-city pool, not a venue
 * schedule. Mirrors the shape of useGymSchedules so the booking UI can consume
 * it identically.
 *
 * The RPCs (get_home_available_dates / get_home_booked_slots) are added by the
 * home-visit migration. Until that migration is deployed they don't exist in
 * the generated types, so the calls are made through an untyped client and the
 * queries degrade to empty results (the UI shows "no availability") instead of
 * crashing.
 */
const sb = supabase as unknown as {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

export interface HomeAvailableDate {
  available_date: string;
}

export function useHomeAvailableDates(cityId?: string) {
  return useQuery({
    queryKey: ["home-available-dates", cityId],
    queryFn: async () => {
      if (!cityId) return [] as string[];
      const { data, error } = await sb.rpc("get_home_available_dates", {
        p_city_id: cityId,
        p_start_date: new Date().toISOString().split("T")[0],
        p_months_ahead: 3,
      });
      if (error) return [] as string[];
      return ((data as HomeAvailableDate[]) || []).map((r) => r.available_date);
    },
    enabled: !!cityId,
  });
}

export function useHomeBookedSlots(cityId?: string, date?: string) {
  return useQuery({
    queryKey: ["home-booked-slots", cityId, date],
    queryFn: async () => {
      if (!cityId || !date) return [] as string[];
      const { data, error } = await sb.rpc("get_home_booked_slots", {
        p_city_id: cityId,
        p_date: date,
      });
      if (error) return [] as string[];
      return ((data as { slot_time: string }[]) || []).map((r) => r.slot_time);
    },
    enabled: !!cityId && !!date,
  });
}
