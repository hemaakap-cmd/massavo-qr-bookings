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

/**
 * The home-visit travel fee for a city, resolved city -> country by the server.
 *
 * This is the SAME RPC `create-payment` calls to build the Stripe amount, so
 * the summary the customer reads and the amount they are charged come from one
 * source. Do not re-derive this on the client: the fee is server-authoritative
 * and a local copy would drift the moment a city override is set.
 */
export function useHomeTravelFee(cityId?: string) {
  return useQuery({
    queryKey: ["home-travel-fee", cityId],
    queryFn: async () => {
      if (!cityId) return 0;
      const { data, error } = await sb.rpc("get_home_travel_fee", { _city_id: cityId });
      if (error) return 0;
      const fee = Number(data);
      return Number.isFinite(fee) && fee >= 0 ? fee : 0;
    },
    enabled: !!cityId,
  });
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

/**
 * Slots the whole city pool cannot serve.
 *
 * `durationMinutes` matters: a slot is only bookable if the *entire*
 * session fits, so a 90-minute service blocks out more of the day than a
 * 50-minute one. Omitting it falls back to the server's 60-minute default,
 * which would understate conflicts for longer services.
 */
export function useHomeBookedSlots(cityId?: string, date?: string, durationMinutes?: number) {
  return useQuery({
    queryKey: ["home-booked-slots", cityId, date, durationMinutes],
    queryFn: async () => {
      if (!cityId || !date) return [] as string[];
      const { data, error } = await sb.rpc("get_home_booked_slots", {
        p_city_id: cityId,
        p_date: date,
        ...(durationMinutes ? { p_duration_minutes: durationMinutes } : {}),
      });
      if (error) return [] as string[];
      return ((data as { slot_time: string }[]) || []).map((r) => r.slot_time);
    },
    enabled: !!cityId && !!date,
  });
}
