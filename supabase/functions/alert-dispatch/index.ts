/**
 * alert-dispatch — central alert router.
 *
 * Channels (in priority order):
 *   1. Telegram (via Lovable connector gateway)
 *   2. Discord (via webhook URL secret)
 *   3. Email fallback (Resend, only for severity=critical or when both above fail)
 *
 * Cooldown is enforced by the DB trigger (alert_allowed) before we're called.
 * We additionally re-check inside this function as a safety net.
 * Every send attempt is recorded in alert_dispatch_log.
 *
 * Triggered by: trigger_incident_alert() on system_incidents.
 * Body: { fingerprint, severity, source, message, occurrences, context }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { buildCorsHeaders } from "../_shared/cors.ts";


const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_ALERT_CHAT_ID");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const DISCORD_WEBHOOK_URL = Deno.env.get("DISCORD_ALERT_WEBHOOK_URL");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ALERT_EMAIL_TO = Deno.env.get("ALERT_EMAIL_TO") ?? "noreply@massavo.com";

const SEVERITY_EMOJI: Record<string, string> = {
  info: "ℹ️", warning: "⚠️", error: "🚨", critical: "🔥",
};

type AlertPayload = {
  fingerprint: string;
  severity: "info" | "warning" | "error" | "critical";
  source?: string;
  message?: string;
  occurrences?: number;
  context?: Record<string, unknown>;
};

function formatMessage(p: AlertPayload): string {
  const emoji = SEVERITY_EMOJI[p.severity] ?? "•";
  const lines = [
    `${emoji} *MASSAVO ${p.severity.toUpperCase()}*`,
    `*Source:* ${p.source ?? "unknown"}`,
    `*Message:* ${(p.message ?? "").slice(0, 400)}`,
    p.occurrences ? `*Occurrences:* ${p.occurrences}` : "",
    `*Time:* ${new Date().toISOString()}`,
  ].filter(Boolean);
  return lines.join("\n");
}

async function logDispatch(channel: string, p: AlertPayload, delivered: boolean, err?: string) {
  await admin.from("alert_dispatch_log").insert({
    fingerprint: p.fingerprint,
    channel,
    severity: p.severity,
    source: p.source ?? null,
    message: (p.message ?? "").slice(0, 500),
    context: (p.context ?? {}) as unknown as Record<string, unknown>,
    delivered,
    delivery_error: err ?? null,
  });
}

async function sendTelegram(p: AlertPayload): Promise<{ ok: boolean; error?: string }> {
  if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY || !TELEGRAM_CHAT_ID) {
    return { ok: false, error: "telegram_not_configured" };
  }
  try {
    const res = await fetch("https://connector-gateway.lovable.dev/telegram/sendMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: formatMessage(p),
        parse_mode: "Markdown",
      }),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `telegram_${res.status}: ${text.slice(0, 200)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function sendDiscord(p: AlertPayload): Promise<{ ok: boolean; error?: string }> {
  if (!DISCORD_WEBHOOK_URL) return { ok: false, error: "discord_not_configured" };
  const color = p.severity === "critical" ? 0xff0033 : p.severity === "error" ? 0xff8800 : 0xffcc00;
  try {
    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "MASSAVO Monitor",
        embeds: [{
          title: `${SEVERITY_EMOJI[p.severity] ?? "•"} ${p.severity.toUpperCase()} — ${p.source ?? ""}`,
          description: (p.message ?? "").slice(0, 1500),
          color,
          fields: [
            { name: "Occurrences", value: String(p.occurrences ?? 1), inline: true },
            { name: "Fingerprint", value: `\`${p.fingerprint.slice(0, 80)}\``, inline: true },
          ],
          timestamp: new Date().toISOString(),
        }],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `discord_${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function sendEmail(p: AlertPayload): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: "email_not_configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "MASSAVO Monitor <noreply@massavo.com>",
        to: [ALERT_EMAIL_TO],
        subject: `[${p.severity.toUpperCase()}] ${p.source ?? "system"} — ${(p.message ?? "").slice(0, 80)}`,
        text: formatMessage(p).replace(/\*/g, ""),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `email_${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  let payload: AlertPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!payload?.fingerprint || !payload?.severity) {
    return new Response(JSON.stringify({ ok: false, error: "missing_fields" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Safety-net cooldown re-check (DB trigger already filters, but be defensive)
  const { data: allowed } = await admin.rpc("alert_allowed", {
    p_fingerprint: payload.fingerprint,
    p_cooldown_minutes: 30,
  });
  if (allowed === false) {
    return new Response(JSON.stringify({ ok: true, suppressed: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Telegram primary
  const tg = await sendTelegram(payload);
  await logDispatch("telegram", payload, tg.ok, tg.error);

  // 2. Discord secondary
  const dc = await sendDiscord(payload);
  await logDispatch("discord", payload, dc.ok, dc.error);

  // 3. Email fallback only when both above failed OR severity=critical
  let em: { ok: boolean; error?: string } = { ok: false, error: "skipped" };
  if ((!tg.ok && !dc.ok) || payload.severity === "critical") {
    em = await sendEmail(payload);
    await logDispatch("email", payload, em.ok, em.error);
  }

  return new Response(
    JSON.stringify({ ok: true, telegram: tg.ok, discord: dc.ok, email: em.ok }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});