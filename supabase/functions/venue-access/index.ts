/**
 * venue-access — server-side QR/venue authorization gate (N-2).
 *
 * The general public website must not expose gym/hotel service catalogues,
 * prices or availability. All of that data is served ONLY through this function
 * and only for the exact venue the caller holds a valid QR token for.
 *
 * Actions
 *  - claim        { venueType, venueId? , code? }  -> { token, venue }
 *  - catalogue    { token, venueType, venueId }    -> { services: [...], currency }
 *  - availability { token, venueType, venueId, date?, monthsAhead? }
 *                                                  -> { availableDates, bookedSlots }
 *
 * Security notes
 *  - the token is HMAC signed server-side (see _shared/venue-token.ts)
 *  - every protected action re-checks that the token venue is still active
 *    (venue disabled/deleted => token revoked)
 *  - prices are resolved server-side via get_effective_service_price; a service
 *    without an ACTIVE venue mapping is not returned at all (N-1)
 *  - claim is rate limited per client identity to prevent venue enumeration
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { enforceRateLimit, tooManyRequests } from "../_shared/rate-limit.ts";
import {
  issueVenueToken,
  verifyVenueToken,
  venueStillActive,
  type TokenVenueType,
} from "../_shared/venue-token.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

serve(async (req: Request): Promise<Response> => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const venueType = String(body.venueType ?? "") as TokenVenueType;
    const venueId = typeof body.venueId === "string" ? body.venueId : null;
    const token = typeof body.token === "string" ? body.token : null;

    if (venueType !== "gym" && venueType !== "hotel") {
      return json({ error: "Invalid venue type" }, 400, cors);
    }
    const table = venueType === "hotel" ? "hotels" : "gyms";

    // ---------------------------------------------------------------- claim
    if (action === "claim") {
      const rl = await enforceRateLimit(
        req,
        { action: "venue_qr_claim", ipMax: 60, ipWindowMinutes: 10, blockMinutes: 15 },
        null,
        supabase,
      );
      if (!rl.allowed) return tooManyRequests(cors, rl);

      // H-1: the ONLY accepted authorization for a claim is the venue's physical
      // QR secret (qr_code_id). A bare venue id is NEVER sufficient — knowing or
      // enumerating a public venue id must not yield a venue token.
      const code = typeof body.code === "string" ? body.code.trim() : "";
      if (!code || code.length < 6 || code.length > 128) {
        return json({ error: "QR code required" }, 401, cors);
      }

      // `star_rating` only exists on hotels; hotels have no FK embed to cities,
      // so the city name is resolved with a separate lookup below.
      const columns = venueType === "hotel"
        ? "id, name, address, city_id, rating, review_count, image_url, open_hours, is_active, star_rating"
        : "id, name, address, city_id, rating, review_count, image_url, open_hours, is_active";
      const { data: venue, error: venueErr } = await supabase
        .from(table)
        .select(columns)
        .eq("is_active", true)
        .eq("qr_code_id", code)
        .maybeSingle<Record<string, unknown>>();
      if (venueErr) console.error("venue claim lookup failed", venueErr);
      if (!venue) return json({ error: "Unknown or inactive QR code" }, 404, cors);
      // A QR secret for one venue can never be redirected at another venue id.
      if (venueId && UUID_RE.test(venueId) && venueId !== (venue.id as string)) {
        return json({ error: "QR code does not match this venue" }, 403, cors);
      }

      const { token: issued, expiresAt } = await issueVenueToken(venueType, venue.id as string);
      let cityName: string | null = null;
      if (venue.city_id) {
        const { data: city } = await supabase
          .from("cities")
          .select("name")
          .eq("id", venue.city_id as string)
          .maybeSingle();
        cityName = (city?.name as string) ?? null;
      }
      return json(
        {
          token: issued,
          expiresAt,
          venue: {
            id: venue.id,
            type: venueType,
            name: venue.name,
            address: venue.address,
            city_id: venue.city_id,
            city_name: cityName,
            rating: venue.rating,
            review_count: venue.review_count,
            image_url: venue.image_url,
            open_hours: venue.open_hours,
            star_rating: venue.star_rating ?? null,
          },
        },
        200,
        cors,
      );
    }

    // --------------------------------------------- protected actions (token)
    const verified = await verifyVenueToken(token, { venueType, venueId });
    if (!verified.ok) {
      return json({ error: "Venue authorization required", reason: verified.error }, 403, cors);
    }
    const authorizedVenueId = verified.payload!.v;
    if (!(await venueStillActive(supabase, venueType, authorizedVenueId))) {
      return json({ error: "Venue authorization revoked" }, 403, cors);
    }

    if (action === "catalogue") {
      const mappingTable = venueType === "hotel" ? "hotel_services" : "gym_services";
      const fk = venueType === "hotel" ? "hotel_id" : "gym_id";
      const { data: mappings, error } = await supabase
        .from(mappingTable)
        .select(
          "service_id, promo_label, promo_price, promo_starts_at, promo_ends_at, custom_price, services(id, name, name_ar, description, description_ar, duration_minutes, price, icon, is_active)",
        )
        .eq(fk, authorizedVenueId)
        .eq("is_active", true);
      if (error) {
        console.error("catalogue query failed", error);
        return json({ error: "Failed to load services" }, 500, cors);
      }

      const nowMs = Date.now();
      const services = [] as Array<Record<string, unknown>>;
      for (const m of mappings ?? []) {
        const svc = Array.isArray((m as any).services) ? (m as any).services[0] : (m as any).services;
        if (!svc || svc.is_active !== true) continue;
        // Price is ALWAYS resolved by the server (N-1). The client never supplies it.
        const { data: effective } = await supabase.rpc("get_effective_service_price", {
          _venue_type: venueType,
          _venue_id: authorizedVenueId,
          _service_id: svc.id,
        });
        if (effective === null || effective === undefined) continue;
        const promoActive =
          (m as any).promo_price != null &&
          (!(m as any).promo_starts_at || new Date((m as any).promo_starts_at).getTime() <= nowMs) &&
          (!(m as any).promo_ends_at || new Date((m as any).promo_ends_at).getTime() >= nowMs);
        const listPrice = (m as any).custom_price ?? svc.price;
        services.push({
          id: svc.id,
          name: svc.name,
          name_ar: svc.name_ar,
          description: svc.description,
          description_ar: svc.description_ar,
          duration_minutes: svc.duration_minutes,
          icon: svc.icon,
          price: Number(effective),
          original_price: promoActive ? Number(listPrice) : null,
          promo_label: promoActive ? (m as any).promo_label : null,
        });
      }
      services.sort((a, b) => Number(a.price) - Number(b.price));
      return json({ services }, 200, cors);
    }

    if (action === "availability") {
      const monthsAhead = Math.min(Math.max(Number(body.monthsAhead ?? 3), 1), 6);
      const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;
      const startDate = new Date().toISOString().split("T")[0];

      const datesRpc = venueType === "hotel" ? "get_hotel_available_dates" : "get_gym_available_dates";
      const datesArgs = venueType === "hotel"
        ? { p_hotel_id: authorizedVenueId, p_start_date: startDate, p_months_ahead: monthsAhead }
        : { p_gym_id: authorizedVenueId, p_start_date: startDate, p_months_ahead: monthsAhead };
      const { data: availableDates, error: datesErr } = await supabase.rpc(datesRpc, datesArgs);
      if (datesErr) {
        console.error("available dates failed", datesErr);
        return json({ error: "Failed to load availability" }, 500, cors);
      }

      let bookedSlots: unknown[] = [];
      if (date) {
        const slotsRpc = venueType === "hotel" ? "get_hotel_booked_slots" : "get_booked_slots";
        const slotsArgs = venueType === "hotel"
          ? { p_hotel_id: authorizedVenueId, p_date: date }
          : { p_gym_id: authorizedVenueId, p_date: date };
        const { data: slots, error: slotsErr } = await supabase.rpc(slotsRpc, slotsArgs);
        if (slotsErr) {
          console.error("booked slots failed", slotsErr);
          return json({ error: "Failed to load availability" }, 500, cors);
        }
        bookedSlots = slots ?? [];
      }

      return json({ availableDates: availableDates ?? [], bookedSlots }, 200, cors);
    }

    return json({ error: "Unknown action" }, 400, cors);
  } catch (err) {
    console.error("venue-access error", err);
    return json({ error: "Internal server error" }, 500, cors);
  }
});
