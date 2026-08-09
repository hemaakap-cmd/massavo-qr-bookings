/**
 * Shared venue resolver for multi-venue (gym + hotel) booking lifecycle.
 * Use this in every edge function that needs venue info from a booking row.
 */
import type { EmailLang } from "./email-i18n.ts";

export type VenueType = "gym" | "hotel";

export interface VenueInfo {
  type: VenueType;
  id: string;
  name: string;
  address: string;
  country_id: string | null;
  language: EmailLang;
}

function pickLang(raw: unknown): EmailLang {
  if (raw === "ar" || raw === "en" || raw === "de") return raw;
  return "de";
}

/** Resolve venue info for a booking row that has gym_id OR hotel_id. */
export async function resolveVenue(
  supabase: any,
  booking: { gym_id?: string | null; hotel_id?: string | null },
): Promise<VenueInfo | null> {
  if (booking.hotel_id) {
    const { data } = await supabase
      .from("hotels")
      .select("id, name, address, country_id, country:countries(default_language)")
      .eq("id", booking.hotel_id)
      .maybeSingle();
    if (!data) return null;
    const c = Array.isArray(data.country) ? data.country[0] : data.country;
    return {
      type: "hotel",
      id: data.id,
      name: data.name,
      address: data.address || "",
      country_id: data.country_id,
      language: pickLang(c?.default_language),
    };
  }
  if (booking.gym_id) {
    const { data } = await supabase
      .from("gyms")
      .select("id, name, address, country_id, country:countries(default_language)")
      .eq("id", booking.gym_id)
      .maybeSingle();
    if (!data) return null;
    const c = Array.isArray(data.country) ? data.country[0] : data.country;
    return {
      type: "gym",
      id: data.id,
      name: data.name,
      address: data.address || "",
      country_id: data.country_id,
      language: pickLang(c?.default_language),
    };
  }
  return null;
}

/** Pick the right slot-availability RPC based on venue type. */
export async function checkVenueSlotAvailability(
  supabase: any,
  venue: { type: VenueType; id: string },
  date: string,
  time: string,
  durationMinutes: number,
): Promise<boolean> {
  if (venue.type === "hotel") {
    const { data, error } = await supabase.rpc("check_hotel_slot_availability", {
      p_hotel_id: venue.id,
      p_date: date,
      p_time: time,
      p_duration_minutes: durationMinutes,
    });
    if (error) return false;
    return !!data;
  }
  const { data, error } = await supabase.rpc("check_slot_availability", {
    p_gym_id: venue.id,
    p_date: date,
    p_time: time,
    p_duration_minutes: durationMinutes,
  });
  if (error) return false;
  return !!data;
}