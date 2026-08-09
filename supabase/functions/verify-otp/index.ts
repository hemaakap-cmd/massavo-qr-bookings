import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";


const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 10;

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { email, token, allowedRoles } = await req.json();

    if (!email || !token || !allowedRoles) {
      return json({ error: "Email, token, and allowedRoles are required" }, 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // F1: IP-based rate limit on verify attempts (brute-force guard)
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip")
      || req.headers.get("x-real-ip")
      || null;
    const { data: rateCheck } = await supabaseAdmin.rpc("check_otp_rate_limit", {
      p_email: normalizedEmail,
      p_ip_address: ipAddress,
      p_action_type: "verify_otp",
      p_email_max: 8,
      p_email_window_minutes: 10,
      p_ip_max: 30,
      p_ip_window_minutes: 15,
      p_block_minutes: 30,
    });
    if (rateCheck && rateCheck.allowed === false) {
      const masked = normalizedEmail.replace(/(.{2}).*(@.*)/, "$1***$2");
      console.warn("[VERIFY-OTP] Rate limit hit:", masked, rateCheck.reason);
      return json({ error: "Too many attempts. Please try again later." }, 429);
    }

    // Check rate limiting
    const { data: attempts } = await supabaseAdmin
      .from("otp_attempts")
      .select("*")
      .eq("email", normalizedEmail)
      .single();

    if (attempts?.locked_until && new Date(attempts.locked_until) > new Date()) {
      const remainingMinutes = Math.ceil(
        (new Date(attempts.locked_until).getTime() - Date.now()) / 60000
      );
      return json(
        { error: `Account temporarily locked. Try again in ${remainingMinutes} minutes.` },
        429
      );
    }

    // Verify OTP using Supabase Auth
    const { data: authData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
      email: normalizedEmail,
      token,
      type: "magiclink",
    });

    if (verifyError || !authData.session) {
      // Increment failed attempts
      if (attempts) {
        const newCount = (attempts.attempt_count || 0) + 1;
        await supabaseAdmin
          .from("otp_attempts")
          .update({
            attempt_count: newCount,
            last_attempt_at: new Date().toISOString(),
            locked_until:
              newCount >= MAX_ATTEMPTS
                ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60000).toISOString()
                : null,
          })
          .eq("id", attempts.id);

        if (newCount >= MAX_ATTEMPTS) {
          return json(
            { error: `Too many failed attempts. Account locked for ${LOCK_DURATION_MINUTES} minutes.` },
            429
          );
        }
      } else {
        await supabaseAdmin.from("otp_attempts").insert({
          email: normalizedEmail,
          attempt_count: 1,
          last_attempt_at: new Date().toISOString(),
        });
      }

      return json({ error: "Invalid or expired verification code." }, 401);
    }

    // Verify role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role, branch_id")
      .eq("user_id", authData.user!.id);

    const userRoles = roles || [];
    console.log("[VERIFY-OTP] User roles:", JSON.stringify(userRoles), "allowedRoles:", JSON.stringify(allowedRoles));
    // Prioritize highest-privilege role so super_admin lands on /super-admin instead of /admin
    const rolePriority: Record<string, number> = { super_admin: 3, admin: 2, therapist: 1 };
    const matchedRole = userRoles
      .filter((r) => allowedRoles.includes(r.role))
      .sort((a, b) => (rolePriority[b.role] ?? 0) - (rolePriority[a.role] ?? 0))[0];
    console.log("[VERIFY-OTP] Matched role:", matchedRole?.role || "NONE");

    if (!matchedRole) {
      return json(
        { error: "You do not have the required role to access this area." },
        403
      );
    }

    // Reset OTP attempts on success
    if (attempts) {
      await supabaseAdmin
        .from("otp_attempts")
        .update({ attempt_count: 0, locked_until: null })
        .eq("id", attempts.id);
    }

    return json({
      success: true,
      session: authData.session,
      role: matchedRole.role,
      branch_id: matchedRole.branch_id,
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
