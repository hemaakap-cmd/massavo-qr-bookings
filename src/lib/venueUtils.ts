/**
 * Multi-Venue Architecture — shared helpers
 * Supports both gym and hotel bookings without breaking gym-only code paths.
 */
import { supabase } from "@/integrations/supabase/client";

export type VenueType = "gym" | "hotel" | "home";

export interface VenueBooking {
  gym_id?: string | null;
  hotel_id?: string | null;
  home_city_id?: string | null;
  gyms?: { name: string } | null;
  hotels?: { name: string } | null;
  home_cities?: { name: string } | null;
}

/**
 * Returns the venue type of a booking.
 * A home visit has no gym/hotel row — it is identified by home_city_id.
 * Hotel takes precedence, then home, then gym (default).
 */
export function getVenueType(b: VenueBooking | null | undefined): VenueType {
  if (!b) return "gym";
  if (b.hotel_id) return "hotel";
  if (b.home_city_id) return "home";
  return "gym";
}

/** Returns the resolved venue name (hotel → home city → gym → fallback). */
export function getVenueName(b: VenueBooking | null | undefined, fallback = "—"): string {
  if (!b) return fallback;
  return b.hotels?.name || b.home_cities?.name || b.gyms?.name || fallback;
}

/** Returns the venue ID (hotel_id → home_city_id → gym_id). */
export function getVenueId(b: VenueBooking | null | undefined): string | null {
  if (!b) return null;
  return b.hotel_id || b.home_city_id || b.gym_id || null;
}

/** Returns a structured display object for badges/labels. */
export function getVenueDisplay(b: VenueBooking | null | undefined) {
  const type = getVenueType(b);
  const name = getVenueName(b);
  const label = type === "hotel" ? "Hotel" : type === "home" ? "Home Visit" : "Gym";
  return {
    type,
    name,
    id: getVenueId(b),
    label,
  };
}

/**
 * Builds a Supabase `.or(...)` filter string covering both venue types.
 * Pass empty arrays to skip a side. Returns null if both are empty.
 */
export function buildVenueOrFilter(gymIds: string[], hotelIds: string[]): string | null {
  const parts: string[] = [];
  if (gymIds.length > 0) parts.push(`gym_id.in.(${gymIds.join(",")})`);
  if (hotelIds.length > 0) parts.push(`hotel_id.in.(${hotelIds.join(",")})`);
  return parts.length > 0 ? parts.join(",") : null;
}

/** Fetches all gym + hotel IDs for a country in one shot. */
export async function fetchCountryVenueIds(
  countryId: string | null | undefined,
): Promise<{ gymIds: string[]; hotelIds: string[] }> {
  if (!countryId) return { gymIds: [], hotelIds: [] };
  const [{ data: gyms }, { data: hotels }] = await Promise.all([
    supabase.from("gyms").select("id").eq("country_id", countryId),
    supabase.from("hotels").select("id").eq("country_id", countryId),
  ]);
  return {
    gymIds: (gyms || []).map((g) => g.id),
    hotelIds: (hotels || []).map((h) => h.id),
  };
}

/** Standard select string for booking queries that need venue + service + therapist names. */
export const BOOKING_VENUE_SELECT =
  "*, gyms(name), hotels(name), services(name), therapists(name)";
