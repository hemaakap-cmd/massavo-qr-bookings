import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { getTrustedClientIp } from "../_shared/client-identity.ts";


const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;

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
    const { email, allowedRoles } = await req.json();

    if (!email || !allowedRoles || !Array.isArray(allowedRoles)) {
      return json({ error: "Email and allowedRoles are required" }, 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 255) {
      return json({ error: "Invalid email format" }, 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Anti-enumeration: always return generic success message
    const genericSuccess = { success: true, message: "If the email is registered, a verification code has been sent." };

    // F1: IP + email rate limiting (allow up to 3 send attempts/email per 10 min,
    // and up to 10 per IP per 15 min; block on the next request)
    // SECURITY (remediation item 12): the LEFTMOST X-Forwarded-For hop is fully
    // attacker-controlled, so the old order let anyone reset their own bucket by
    // sending a random header value. Use the platform-trusted peer address.
    const ipAddress = getTrustedClientIp(req);
    const maskedEmail = normalizedEmail.replace(/(.{2}).*(@.*)/, "$1***$2");
    const { data: rateCheck } = await supabaseAdmin.rpc("check_otp_rate_limit", {
      p_email: normalizedEmail,
      p_ip_address: ipAddress,
      p_action_type: "send_otp",
      p_email_max: 4,
      p_email_window_minutes: 10,
      p_ip_max: 11,
      p_ip_window_minutes: 15,
      p_block_minutes: 30,
    });
    if (rateCheck && rateCheck.allowed === false) {
      console.warn("[SEND-OTP] Rate limit hit:", maskedEmail, rateCheck.reason);
      return json({
        error: "Please wait before requesting another verification code.",
        retryAfterSeconds: rateCheck.retry_after_seconds ?? RESEND_COOLDOWN_SECONDS,
      }, 429);
    }

    // SECURITY (remediation item 7): resolve the account WITHOUT enumerating the
    // whole auth user list (listUsers() is paginated, so it also silently failed
    // for later-registered staff). Every outcome below returns the SAME generic
    // body, so a caller cannot tell "unknown address" from "registered client"
    // from "privileged staff account".
    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (!profileRow?.user_id) {
      return json(genericSuccess);
    }

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", profileRow.user_id);

    const userRoles = roles?.map((r) => r.role) || [];
    const hasAllowedRole = userRoles.some((r) => allowedRoles.includes(r));

    if (!hasAllowedRole) {
      return json(genericSuccess);
    }

    // Per-account resend cooldown. This check depends on account existence, so it
    // must NEVER surface a distinct status/message — when the account is inside
    // the cooldown we simply do not resend and return the generic body.
    const { data: attempts } = await supabaseAdmin
      .from("otp_attempts")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (attempts) {
      if (attempts.locked_until && new Date(attempts.locked_until) > new Date()) {
        console.warn("[SEND-OTP] account locked, suppressing send:", maskedEmail);
        return json(genericSuccess);
      }
      if (attempts.last_attempt_at) {
        const elapsed = (Date.now() - new Date(attempts.last_attempt_at).getTime()) / 1000;
        if (elapsed < RESEND_COOLDOWN_SECONDS) {
          console.warn("[SEND-OTP] resend cooldown, suppressing send:", maskedEmail);
          return json(genericSuccess);
        }
      }
      if (attempts.locked_until && new Date(attempts.locked_until) <= new Date()) {
        await supabaseAdmin
          .from("otp_attempts")
          .update({ attempt_count: 0, locked_until: null, last_attempt_at: new Date().toISOString() })
          .eq("id", attempts.id);
      }
    }

    // Generate OTP link (does NOT send email) — we send it ourselves
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: normalizedEmail,
      options: {
        data: {},
      },
    });

    if (linkError || !linkData) {
      // Do not distinguish backend failure for an existing account from an
      // unknown address — log the detail, return the generic body.
      console.error("generateLink error:", linkError);
      return json(genericSuccess);
    }

    // Extract the 6-digit OTP code
    const otpCode = linkData.properties?.email_otp;
    console.log("[SEND-OTP] Generated OTP for", normalizedEmail, "code length:", otpCode?.length);

    if (!otpCode) {
      console.error("No email_otp in generateLink response");
      return json({ error: "Failed to generate verification code." }, 500);
    }

    // Send OTP email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return json({ error: "Email service not configured." }, 500);
    }

    const emailHtml = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 32px;">
          <img src="https://massavo.com/android-chrome-512x512.png" alt="MASSAVO" width="72" height="72" style="display: block; width: 72px; height: 72px; margin: 0 auto; border: 0; border-radius: 14px;" />
        </div>
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0 0 8px;">Your Verification Code</h1>
          <p style="font-size: 15px; color: #666; margin: 0;">Enter this code to sign in to your account:</p>
        </div>
        <div style="text-align: center; margin: 32px 0;">
          <div style="display: inline-block; background: #f5f5f0; border: 2px solid #e0e0d8; border-radius: 12px; padding: 20px 40px; letter-spacing: 12px; font-size: 36px; font-weight: 700; color: #1a1a1a; font-family: 'Courier New', monospace;">
            ${otpCode}
          </div>
        </div>
        <div style="text-align: center; margin-bottom: 32px;">
          <p style="font-size: 13px; color: #999; margin: 0;">This code expires in <strong>5 minutes</strong>.</p>
          <p style="font-size: 13px; color: #999; margin: 8px 0 0;">If you didn't request this, you can safely ignore this email.</p>
        </div>
        <div style="border-top: 1px solid #eee; padding-top: 20px; text-align: center;">
          <p style="font-size: 11px; color: #bbb; margin: 0;">Never share this code with anyone. MASSAVO will never ask for it.</p>
        </div>
      </div>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "MASSAVO <noreply@massavo.com>",
        to: [normalizedEmail],
        subject: `${otpCode} — Your MASSAVO Verification Code`,
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      console.error("Resend error:", resendError);
      return json({ error: "Failed to send verification email." }, 500);
    }

    console.log("[SEND-OTP] Email sent successfully to", normalizedEmail);

    // Update attempt tracking
    if (attempts) {
      await supabaseAdmin
        .from("otp_attempts")
        .update({
          attempt_count: 0,
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", attempts.id);
    } else {
      await supabaseAdmin.from("otp_attempts").insert({
        email: normalizedEmail,
        attempt_count: 0,
        last_attempt_at: new Date().toISOString(),
      });
    }

    // SECURITY (remediation item 7): `matchedRole` used to be returned here, which
    // told any anonymous caller both that the address was a real account AND that
    // it held admin/super_admin — a ready-made target list. The client learns the
    // role after the code is verified and a session exists, not before.
    return json(genericSuccess);
  } catch (err) {
    console.error("OTP error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
