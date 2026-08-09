import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { buildCorsHeaders } from "../_shared/cors.ts";

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
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await supaUser.auth.getClaims(token);
    if (cErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub as string;
    const email = (claims.claims.email as string) || "";

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [profile, bookings, feedback, roles] = await Promise.all([
      admin.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      admin.from("bookings").select("*").or(`user_id.eq.${userId},customer_email.eq.${email}`),
      admin.from("booking_feedback").select("*").in("booking_id",
        ((await admin.from("bookings").select("id").or(`user_id.eq.${userId},customer_email.eq.${email}`)).data || []).map((b: any) => b.id)
      ),
      admin.from("user_roles").select("*").eq("user_id", userId),
    ]);

    const ip = req.headers.get("x-forwarded-for") || "";
    await admin.from("gdpr_audit_log").insert({
      user_id: userId, email, action: "export_delivered",
      ip_address: ip, details: { bookings: bookings.data?.length ?? 0 },
    });

    const payload = {
      generated_at: new Date().toISOString(),
      user: { id: userId, email },
      profile: profile.data,
      bookings: bookings.data,
      feedback: feedback.data,
      roles: roles.data,
    };
    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Content-Disposition": `attachment; filename=massavo-data-${userId}.json` },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});