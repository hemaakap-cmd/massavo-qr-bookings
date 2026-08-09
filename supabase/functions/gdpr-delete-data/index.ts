import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { buildCorsHeaders } from "../_shared/cors.ts";

/**
 * Right-to-erasure: anonymizes the user's personal data while preserving
 * financial/booking records required for tax law (GoBD, §147 AO 10y retention).
 * - Profiles row deleted
 * - Bookings: customer_name/email/phone/address/dob redacted, user_id nulled
 * - Feedback: customer_first_name/comment redacted
 * - Auth user deleted last (cascades user_roles, therapists.user_id null)
 */
Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supaUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims, error: cErr } = await supaUser.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (cErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    let body: any = {};
    try { body = await req.json(); } catch { /* optional */ }
    if (body?.confirm !== "DELETE_MY_DATA") {
      return new Response(JSON.stringify({ error: "Missing confirmation. Send {\"confirm\":\"DELETE_MY_DATA\"}" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub as string;
    const email = (claims.claims.email as string) || "";
    const ip = req.headers.get("x-forwarded-for") || "";

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    await admin.from("gdpr_audit_log").insert({ user_id: userId, email, action: "delete_requested", ip_address: ip });

    const REDACT = "[REDACTED-GDPR]";
    // Anonymize bookings (legal retention requires keeping financial record)
    await admin.from("bookings").update({
      customer_name: REDACT, customer_email: `redacted+${userId}@gdpr.invalid`,
      client_phone: null, client_address: null, date_of_birth: null,
      user_id: null, notes: null,
    }).or(`user_id.eq.${userId},customer_email.eq.${email}`);

    await admin.from("booking_feedback").update({ customer_first_name: REDACT, comment: null })
      .eq("customer_first_name", email);

    await admin.from("profiles").delete().eq("user_id", userId);
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);

    await admin.from("gdpr_audit_log").insert({
      user_id: userId, email,
      action: delErr ? "delete_failed" : "delete_executed",
      ip_address: ip, details: { error: delErr?.message ?? null },
    });

    if (delErr) {
      return new Response(JSON.stringify({ error: delErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ success: true, anonymized: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});