/**
 * log-incident — public endpoint for client-side error/Web-Vitals reporting.
 * Validates input, masks PII, dedups via fingerprint, writes to system_incidents.
 * Always returns 200 to avoid client retry storms.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { buildCorsHeaders } from "../_shared/cors.ts";


const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ALLOWED_SEVERITY = new Set(["info", "warning", "error", "critical"]);
const ALLOWED_SOURCES = new Set([
  "client.error_boundary",
  "client.window_error",
  "client.unhandled_rejection",
  "client.web_vitals",
  "client.realtime",
]);

function clamp(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.slice(0, max);
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const source = clamp(body.source, 64);
    const fingerprint = clamp(body.fingerprint, 128);
    const message = clamp(body.message, 500);
    const severity = ALLOWED_SEVERITY.has(body.severity) ? body.severity : "warning";

    if (!ALLOWED_SOURCES.has(source) || !fingerprint || !message) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeContext = {
      route: clamp(body.route, 200),
      ua: clamp(req.headers.get("user-agent") || "", 200),
      vital: body.vital && typeof body.vital === "object" ? body.vital : null,
    };

    await admin.rpc("log_system_incident", {
      p_source: source,
      p_fingerprint: fingerprint,
      p_message: message,
      p_severity: severity,
      p_context: safeContext as unknown as Record<string, unknown>,
    });
  } catch (e) {
    console.error("[log-incident]", e);
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});