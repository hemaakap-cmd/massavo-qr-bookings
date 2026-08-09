/**
 * synthetic-monitor — periodic health probe.
 * Hits homepage, public endpoints, edge functions; logs failures to system_incidents.
 * Designed for pg_cron invocation (every 5 min).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { buildCorsHeaders } from "../_shared/cors.ts";


const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const PUBLIC_HOST = Deno.env.get("PUBLIC_SITE_URL") ?? "https://www.massavo.com";

type Probe = { name: string; url: string; method?: string; expectStatus?: number[]; timeoutMs?: number };

const probes: Probe[] = [
  { name: "homepage", url: `${PUBLIC_HOST}/`, expectStatus: [200] },
  { name: "booking_page", url: `${PUBLIC_HOST}/cities`, expectStatus: [200] },
  { name: "edge.get-gyms-public", url: `${SUPABASE_URL}/functions/v1/get-gyms-public`, method: "POST", expectStatus: [200, 400] },
  { name: "edge.get-home-performance", url: `${SUPABASE_URL}/functions/v1/get-home-performance`, method: "POST", expectStatus: [200, 400] },
];

async function runProbe(p: Probe) {
  const start = Date.now();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), p.timeoutMs ?? 10_000);
  try {
    const res = await fetch(p.url, {
      method: p.method ?? "GET",
      signal: controller.signal,
      headers: p.method === "POST"
        ? { "Content-Type": "application/json", apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` }
        : {},
      body: p.method === "POST" ? JSON.stringify({}) : undefined,
    });
    await res.text();
    const ok = (p.expectStatus ?? [200]).includes(res.status);
    return { ok, status: res.status, ms: Date.now() - start };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - start, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const results: Record<string, unknown>[] = [];

  for (const p of probes) {
    const r = await runProbe(p);
    results.push({ name: p.name, ...r });
    if (!r.ok) {
      await admin.rpc("log_system_incident", {
        p_source: "synthetic.probe",
        p_fingerprint: `probe.${p.name}`,
        p_message: `Probe ${p.name} failed (status=${r.status}, ${r.ms}ms)`,
        p_severity: "error",
        p_context: { url: p.url, status: r.status, ms: r.ms } as unknown as Record<string, unknown>,
      });
    } else if (r.ms > 5000) {
      await admin.rpc("log_system_incident", {
        p_source: "synthetic.probe",
        p_fingerprint: `probe.slow.${p.name}`,
        p_message: `Probe ${p.name} slow (${r.ms}ms)`,
        p_severity: "warning",
        p_context: { url: p.url, ms: r.ms } as unknown as Record<string, unknown>,
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});