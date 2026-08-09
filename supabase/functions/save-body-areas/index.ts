import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { buildCorsHeaders } from "../_shared/cors.ts";


serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId, areas, communicationPreference } = await req.json();

    if (!bookingId) {
      return new Response(
        JSON.stringify({ error: "bookingId required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Allow empty areas if only saving communication preference
    const hasAreas = Array.isArray(areas) && areas.length > 0;
    const hasCommPref = typeof communicationPreference === "string" && 
      ["silent", "light_talk", "normal"].includes(communicationPreference);

    if (!hasAreas && !hasCommPref) {
      return new Response(
        JSON.stringify({ error: "areas[] or communicationPreference required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (hasAreas && areas.length > 30) {
      return new Response(
        JSON.stringify({ error: "Too many areas" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify the booking exists and has paid status (security check)
    const { data: booking, error: bErr } = await supabaseAdmin
      .from("bookings")
      .select("id, payment_status")
      .eq("id", bookingId)
      .single();

    if (bErr || !booking || booking.payment_status !== "paid") {
      return new Response(
        JSON.stringify({ error: "Booking not found or not paid" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Save communication preference if provided
    if (hasCommPref) {
      const { error: commErr } = await supabaseAdmin
        .from("bookings")
        .update({ communication_preference: communicationPreference })
        .eq("id", bookingId);
      if (commErr) {
        console.error("Communication preference save error:", commErr);
      }
    }

    // If no areas, we're done (only comm pref was saved)
    if (!hasAreas) {
      return new Response(
        JSON.stringify({ success: true, message: "Communication preference saved" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // HARDCODED PERMANENT SAFETY CHECK — genital/pubic always blocked
    const PERMANENTLY_BLOCKED = ["genital", "pubic", "chest", "abdomen"];
    const areaCodes = areas.map((a: any) => String(a.code).slice(0, 50));
    const hardBlocked = areaCodes.filter((c: string) => PERMANENTLY_BLOCKED.includes(c));
    if (hardBlocked.length > 0) {
      return new Response(
        JSON.stringify({ error: "Prohibited body areas selected", disallowed_areas: hardBlocked }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // SERVER-SIDE VALIDATION: Check body area restrictions from DB
    const { data: restrictions, error: rErr } = await supabaseAdmin
      .from("body_area_restrictions")
      .select("area_code, is_allowed")
      .in("area_code", areaCodes)
      .eq("is_allowed", false);

    if (rErr) {
      console.error("Restriction check error:", rErr);
      return new Response(
        JSON.stringify({ error: "Failed to validate body areas" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    if (restrictions && restrictions.length > 0) {
      const disallowed = restrictions.map((r: any) => r.area_code);
      return new Response(
        JSON.stringify({ 
          error: "Prohibited body areas selected", 
          disallowed_areas: disallowed 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Check if areas already saved for this booking
    const { count } = await supabaseAdmin
      .from("booking_body_areas")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", bookingId);

    if (count && count > 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Areas already saved" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rows = areas.map((a: any) => ({
      booking_id: bookingId,
      area_code: String(a.code).slice(0, 50),
      area_label: String(a.label).slice(0, 100),
      side: a.side === "back" ? "back" : "front",
      pain_intensity: Math.min(10, Math.max(1, Number(a.painIntensity) || 5)),
      is_focus: Boolean(a.isFocus),
    }));

    const { error: insertErr } = await supabaseAdmin
      .from("booking_body_areas")
      .insert(rows);

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(
        JSON.stringify({ error: "Failed to save body areas" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, count: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("save-body-areas error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
