/**
 * save-body-areas — persists the client's selected body areas / pain intensities
 * and their communication preference after a successful payment.
 *
 * SECURITY (remediation item 2): this endpoint previously accepted a bare
 * `bookingId` with NO proof of ownership. Booking ids appear in URLs, emails and
 * admin exports, so anybody holding (or guessing) one could write arbitrary
 * health data and flip communication preferences on someone else's appointment.
 *
 * Now: authorization happens FIRST. The caller must present the booking's
 * unguessable `cancellation_token` (returned to the paying customer by
 * verify-payment and embedded in their management link). The booking row is
 * looked up BY TOKEN — the client-supplied `bookingId` is never used to select
 * a row, only cross-checked, so a mismatched id cannot widen access.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { clientErrorResponse, safeErrorResponse } from "../_shared/safe-error.ts";
import { enforceRateLimit, tooManyRequests } from "../_shared/rate-limit.ts";

/** Tokens are UUIDs / long random hex. Reject anything obviously not a token. */
const TOKEN_MIN_LENGTH = 20;

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return clientErrorResponse(corsHeaders, "Invalid request.");
    }
    const { bookingId, token, areas, communicationPreference } = body as Record<string, unknown>;

    // ---- 1. AUTHORIZATION FIRST -------------------------------------------
    // No token → no access, regardless of what else the request contains.
    if (typeof token !== "string" || token.trim().length < TOKEN_MIN_LENGTH) {
      return clientErrorResponse(
        corsHeaders,
        "A valid booking access token is required.",
        401,
      );
    }
    const accessToken = token.trim();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Throttle token guessing (durable, trusted-IP keyed).
    const limit = await enforceRateLimit(
      req,
      { action: "save_body_areas", subjectMax: 10, subjectWindowMinutes: 60, ipMax: 30, ipWindowMinutes: 60, blockMinutes: 60 },
      accessToken.slice(0, 24),
      supabaseAdmin,
    );
    if (!limit.allowed) return tooManyRequests(corsHeaders, limit);

    // Row is selected BY TOKEN — the client cannot point us at another booking.
    const { data: booking, error: bErr } = await supabaseAdmin
      .from("bookings")
      .select("id, payment_status, status")
      .eq("cancellation_token", accessToken)
      .maybeSingle();

    if (bErr) {
      return safeErrorResponse(corsHeaders, "save-body-areas.lookup", bErr, "Unable to verify booking access.");
    }
    // Identical response for "no such token" and "token belongs to an unpaid
    // booking" so the endpoint is not a booking-state oracle.
    if (!booking || booking.payment_status !== "paid") {
      return clientErrorResponse(corsHeaders, "Booking access could not be verified.", 403);
    }
    // Defence in depth: if the client also sent an id, it must be the same row.
    if (typeof bookingId === "string" && bookingId && bookingId !== booking.id) {
      return clientErrorResponse(corsHeaders, "Booking access could not be verified.", 403);
    }
    const authorizedBookingId = booking.id;

    // ---- 2. INPUT VALIDATION ----------------------------------------------
    const hasAreas = Array.isArray(areas) && areas.length > 0;
    const hasCommPref =
      typeof communicationPreference === "string" &&
      ["silent", "light_talk", "normal"].includes(communicationPreference);

    if (!hasAreas && !hasCommPref) {
      return clientErrorResponse(corsHeaders, "areas[] or communicationPreference required");
    }
    if (hasAreas && (areas as unknown[]).length > 30) {
      return clientErrorResponse(corsHeaders, "Too many areas");
    }

    // ---- 3. WRITES (only reachable after authorization) --------------------
    if (hasCommPref) {
      const { error: commErr } = await supabaseAdmin
        .from("bookings")
        .update({ communication_preference: communicationPreference })
        .eq("id", authorizedBookingId);
      if (commErr) {
        console.error("[save-body-areas] communication preference save error:", commErr.message);
      }
    }

    if (!hasAreas) {
      return new Response(
        JSON.stringify({ success: true, message: "Communication preference saved" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // HARDCODED PERMANENT SAFETY CHECK — genital/pubic always blocked
    const PERMANENTLY_BLOCKED = ["genital", "pubic", "chest", "abdomen"];
    const areaList = areas as Array<Record<string, unknown>>;
    const areaCodes = areaList.map((a) => String(a.code).slice(0, 50));
    const hardBlocked = areaCodes.filter((c) => PERMANENTLY_BLOCKED.includes(c));
    if (hardBlocked.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Prohibited body areas selected", disallowed_areas: hardBlocked }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 },
      );
    }

    // SERVER-SIDE VALIDATION: Check body area restrictions from DB
    const { data: restrictions, error: rErr } = await supabaseAdmin
      .from("body_area_restrictions")
      .select("area_code, is_allowed")
      .in("area_code", areaCodes)
      .eq("is_allowed", false);

    if (rErr) {
      return safeErrorResponse(
        corsHeaders,
        "save-body-areas.restrictions",
        rErr,
        "Failed to validate body areas",
      );
    }

    if (restrictions && restrictions.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Prohibited body areas selected",
          disallowed_areas: restrictions.map((r) => r.area_code),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 },
      );
    }

    // Idempotent: never append a second set for the same booking.
    const { count } = await supabaseAdmin
      .from("booking_body_areas")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", authorizedBookingId);

    if (count && count > 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Areas already saved" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rows = areaList.map((a) => ({
      booking_id: authorizedBookingId,
      area_code: String(a.code).slice(0, 50),
      area_label: String(a.label).slice(0, 100),
      side: a.side === "back" ? "back" : "front",
      pain_intensity: Math.min(10, Math.max(1, Number(a.painIntensity) || 5)),
      is_focus: Boolean(a.isFocus),
    }));

    const { error: insertErr } = await supabaseAdmin.from("booking_body_areas").insert(rows);

    if (insertErr) {
      return safeErrorResponse(
        corsHeaders,
        "save-body-areas.insert",
        insertErr,
        "Failed to save body areas",
      );
    }

    return new Response(
      JSON.stringify({ success: true, count: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return safeErrorResponse(corsHeaders, "save-body-areas", err);
  }
});
