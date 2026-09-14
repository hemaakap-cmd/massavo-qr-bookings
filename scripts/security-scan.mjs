#!/usr/bin/env node
/**
 * MASSAVO LIVE SECURITY SCANNER
 * =============================
 *
 * A "safe to operate?" gate. Run it any time — before you start working on the
 * site, and again after every deploy — to get a plain yes/no on whether the
 * known theft and tampering paths are open in PRODUCTION right now.
 *
 *   node scripts/security-scan.mjs
 *   node scripts/security-scan.mjs --url https://massavo.com
 *
 * It attacks the LIVE site the way a real attacker would, but only ever with:
 *   - reserved example.com addresses (belong to no real person)
 *   - random UUIDs
 *   - rejection / contract paths
 * It never retrieves a real customer's data, never creates a booking, never
 * moves money, never floods anything. Every check is a single request.
 *
 * Each scenario is one concrete question: "can someone steal X / break Y?"
 * Result per scenario:
 *   SAFE        the attack was correctly rejected
 *   VULNERABLE  the attack path is open in production  <-- act on these
 *   INFO        worth knowing, not a direct theft path
 *   NEEDS LOGIN  cannot be judged without a test account (reported, never
 *               counted as safe)
 *
 * Exit code is non-zero if any money/data-theft or tampering scenario is
 * VULNERABLE, so you can wire it into a deploy gate.
 *
 * WHAT THIS DOES NOT COVER (needs test accounts + a staging env):
 *   role escalation, authenticated cross-tenant/RLS, AI tenant boundaries,
 *   completed-payment ownership, real double-booking races, webhook replay
 *   with a valid signature. Those stay untested until credentials exist —
 *   never assume they are safe because they are absent here.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- config ----------------------------------------------------------------
function loadEnv() {
  const out = { ...process.env };
  try {
    const raw = readFileSync(resolve(__dirname, "..", ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      out[line.slice(0, i).trim()] ??= line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch { /* .env optional */ }
  return out;
}

const env = loadEnv();
const argUrl = process.argv.indexOf("--url");
const SITE = (argUrl > -1 ? process.argv[argUrl + 1] : null) || "https://massavo.com";
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !ANON) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (in .env or environment).");
  process.exit(2);
}

const SAFE_EMAIL = "massavo-scanner-no-such-address@example.com";
const RANDOM_UUID = "00000000-0000-4000-8000-000000000000";
const TIMEOUT_MS = 20_000;

// ---- tiny http helpers ------------------------------------------------------
async function fn(name, body, extraHeaders = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json", ...extraHeaders },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* non-json */ }
    return { status: res.status, json, text, acao: res.headers.get("access-control-allow-origin") };
  } finally { clearTimeout(t); }
}

async function rest(path, extraHeaders = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, ...extraHeaders },
      signal: ctl.signal,
    });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* */ }
    return { status: res.status, json, text, range: res.headers.get("content-range") };
  } finally { clearTimeout(t); }
}

async function getText(url, extraHeaders = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: extraHeaders, signal: ctl.signal });
    return { status: res.status, text: await res.text(), headers: res.headers };
  } finally { clearTimeout(t); }
}

// ---- result accumulation ----------------------------------------------------
const results = [];
/** kind: "theft" | "money" | "tamper" | "phish" | "info" | "login" */
function record(id, kind, title, verdict, detail) {
  results.push({ id, kind, title, verdict, detail });
  const tag = { SAFE: "  SAFE     ", VULNERABLE: "! VULNERABLE", INFO: "  INFO     ", "NEEDS LOGIN": "  NEEDS LOGIN" }[verdict] || verdict;
  console.log(`${tag}  ${id.padEnd(6)} ${title}`);
  if (detail) console.log(`             ${detail}`);
}

// ============================================================================
// SCENARIO GROUP 1 — CUSTOMER DATA THEFT
// ============================================================================
async function group_dataTheft() {
  console.log("\n== Can an attacker STEAL customer data? ==");

  // T1: email alone must not return anyone's bookings.
  try {
    const r = await fn("cancel-booking", { action: "lookup", email: SAFE_EMAIL });
    const leaks = r.json && Object.prototype.hasOwnProperty.call(r.json, "bookings");
    record("T1", "theft", "Booking lookup by email does not return booking data",
      leaks ? "VULNERABLE" : "SAFE",
      leaks
        ? `Endpoint returns a "bookings" array to anyone who types an email. status=${r.status}. Fix: cancel-booking must email the link, not return records.`
        : `Generic response, no booking data. status=${r.status}.`);
  } catch (e) { record("T1", "theft", "Booking lookup by email", "INFO", `probe failed: ${e.message}`); }

  // T2: sensitive tables must be invisible to anonymous callers.
  const sensitive = ["bookings", "profiles", "user_roles", "therapist_private_info",
    "country_financials", "booking_feedback", "booking_body_areas", "admin_audit_log", "gdpr_audit_log"];
  let anyLeak = null;
  for (const tbl of sensitive) {
    const r = await rest(`${tbl}?select=*&limit=1`, { Prefer: "count=exact" });
    const rows = Array.isArray(r.json) ? r.json.length : 0;
    if (r.status >= 200 && r.status < 300 && rows > 0) { anyLeak = tbl; break; }
  }
  record("T2", "theft", "Sensitive tables are not readable anonymously",
    anyLeak ? "VULNERABLE" : "SAFE",
    anyLeak ? `Table "${anyLeak}" returned rows to an anonymous caller.` : "All sensitive tables deny/empty for anon.");

  // T3: CORS must not let a stranger's website read API responses.
  const evilOrigins = ["https://attacker-controlled-app.lovable.app", "https://evil.example.net", "null"];
  const reflected = [];
  for (const o of evilOrigins) {
    const r = await fn("cancel-booking", { action: "lookup", email: SAFE_EMAIL }, { Origin: o });
    if (r.acao && r.acao === o) reflected.push(o);
  }
  record("T3", "theft", "CORS does not trust arbitrary websites",
    reflected.length ? "VULNERABLE" : "SAFE",
    reflected.length
      ? `Access-Control-Allow-Origin reflected: ${reflected.join(", ")}. Those sites can read API responses from a victim's browser.`
      : "No untrusted origin reflected.");

  // Positive control: the real origin SHOULD be allowed (sanity, not a failure).
  const good = await fn("cancel-booking", { action: "lookup", email: SAFE_EMAIL }, { Origin: "https://massavo.com" });
  record("T4", "info", "Production origin is accepted by CORS (sanity check)",
    good.acao === "https://massavo.com" ? "INFO" : "INFO",
    `massavo.com reflected: ${good.acao === "https://massavo.com" ? "yes" : "no"} (expected yes).`);
}

// ============================================================================
// SCENARIO GROUP 2 — MONEY THEFT / FRAUD
// ============================================================================
async function group_money() {
  console.log("\n== Can an attacker STEAL money / commit fraud? ==");

  // M1: the old email+bookingId cancel action (cancels + refunds a stranger) must be gone.
  const r1 = await fn("cancel-booking", { action: "cancel", email: SAFE_EMAIL, bookingId: RANDOM_UUID });
  // 410 = action removed (fixed). 404 = old action still present, just no matching booking.
  const cancelActionLive = r1.status !== 410;
  record("M1", "money", "No cancel/refund via email + booking id",
    cancelActionLive ? "VULNERABLE" : "SAFE",
    cancelActionLive
      ? `The "cancel" action still exists (status=${r1.status}, not 410). Combined with T1 it lets a stranger cancel a booking and trigger a refund. Fix: remove it; cancellation must require the secret token.`
      : `Action removed (410). Cancellation requires the secret token.`);

  // M2: the client cannot dictate the price.
  const r2 = await fn("create-payment", {
    serviceId: RANDOM_UUID, customerEmail: SAFE_EMAIL, gymId: RANDOM_UUID,
    price: 0.01, basePrice: 0.01, finalPrice: 0.01, total_amount: 1, currency: "xxx",
    bookingDate: "2099-01-01", timeSlot: "10:00",
  });
  // Server must reject: it should refuse an unknown service rather than price it.
  const acceptedClientPrice = r2.json && (r2.json.url || /session/i.test(r2.text));
  record("M2", "money", "Server ignores client-supplied price/currency",
    acceptedClientPrice ? "VULNERABLE" : "SAFE",
    acceptedClientPrice
      ? "A checkout session was produced from a client-priced request. Fix: derive price from the DB service only."
      : `Client price/currency ignored; unknown service rejected. status=${r2.status}.`);

  // M3: anonymous callers cannot mint a booking directly through the atomic RPCs.
  const rpcs = [
    ["create_booking_atomic", { p_gym_id: RANDOM_UUID, p_service_id: RANDOM_UUID, p_booking_date: "2099-01-01", p_booking_time: "10:00", p_customer_email: SAFE_EMAIL }],
    ["create_home_booking_atomic", { p_service_id: RANDOM_UUID, p_booking_date: "2099-01-01", p_booking_time: "10:00", p_customer_email: SAFE_EMAIL, p_home_city_id: RANDOM_UUID, p_home_country_id: RANDOM_UUID }],
  ];
  let rpcOpen = null;
  for (const [name, args] of rpcs) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
        method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify(args), signal: ctl.signal,
      });
      if (res.status !== 401 && res.status !== 403 && res.status !== 404) rpcOpen = `${name} (status ${res.status})`;
    } catch { /* ignore */ } finally { clearTimeout(t); }
  }
  record("M3", "money", "Booking-creation RPCs are locked to the server",
    rpcOpen ? "VULNERABLE" : "SAFE",
    rpcOpen ? `Anon could invoke ${rpcOpen}. Booking without payment may be possible.` : "Atomic booking RPCs denied to anon.");

  // M4: the Stripe webhook must reject an unsigned event (no forged "paid").
  const r4 = await fn("stripe-webhook", { type: "checkout.session.completed", data: { object: { payment_status: "paid" } } });
  record("M4", "money", "Payment webhook rejects unsigned events",
    r4.status === 400 || r4.status === 401 ? "SAFE" : "VULNERABLE",
    r4.status === 400 || r4.status === 401
      ? `Unsigned webhook rejected (status=${r4.status}).`
      : `Unsigned webhook was NOT rejected (status=${r4.status}). A forged "paid" event may confirm bookings.`);
}

// ============================================================================
// SCENARIO GROUP 3 — TAMPERING / THREAT TO DATA INTEGRITY
// ============================================================================
async function group_tamper() {
  console.log("\n== Can an attacker TAMPER with bookings / health data? ==");

  // Tp1: health-data write must require the secret token, before any lookup.
  const r1 = await fn("save-body-areas", { bookingId: RANDOM_UUID, communicationPreference: "silent" });
  // Fixed: 401 "token required". Vulnerable: 404 "not found or not paid" (gate is exists+paid only).
  const tokenEnforced = r1.status === 401;
  record("Tp1", "tamper", "Health-data write requires the booking's secret token",
    tokenEnforced ? "SAFE" : "VULNERABLE",
    tokenEnforced
      ? "Missing token rejected with 401 before any lookup."
      : `No token required (status=${r1.status}). With a known booking id, health data + comms preference can be overwritten. Fix: require cancellation_token.`);

  // Tp2: reschedule must be token-gated (a random token is rejected).
  const r2 = await fn("respond-to-reschedule", { token: RANDOM_UUID, action: "select_alternative", selectedDate: "2099-01-01", selectedTime: "10:00" });
  record("Tp2", "tamper", "Reschedule is token-gated",
    r2.status === 404 || r2.status === 400 || r2.status === 403 ? "SAFE" : "VULNERABLE",
    `Random reschedule token -> status=${r2.status} (expect rejection).`);

  // Tp3: privileged admin / role / GDPR functions reject anonymous callers.
  const adminFns = ["manage-roles", "manage-admin-role", "admin-force-booking", "gdpr-export-data", "gdpr-delete-data", "admin-ai-chat", "business-intelligence"];
  const open = [];
  for (const name of adminFns) {
    const r = await fn(name, name.includes("gdpr") ? { confirm: "DELETE_MY_DATA" } : { action: "list_users", country_id: RANDOM_UUID, messages: [] });
    if (r.status !== 401 && r.status !== 403) open.push(`${name}:${r.status}`);
  }
  record("Tp3", "tamper", "Admin / role / GDPR functions reject anonymous callers",
    open.length ? "VULNERABLE" : "SAFE",
    open.length ? `Reachable without auth: ${open.join(", ")}` : "All privileged functions returned 401/403 to anon.");
}

// ============================================================================
// SCENARIO GROUP 4 — PHISHING / SESSION (frontend)
// ============================================================================
async function group_phishing() {
  console.log("\n== Can an attacker PHISH via the site (redirect / framing)? ==");

  // Ph1: the deployed login bundle must use an on-origin redirect guard.
  // The Login chunk name is not in the HTML — it is referenced from the main
  // index bundle (lazy import), so follow that trail.
  try {
    const home = (await getText(`${SITE}/`)).text;
    const candidates = new Set();
    const direct = home.match(/(?:\/assets\/)?Login-[A-Za-z0-9_-]+\.js/g) || [];
    direct.forEach((c) => candidates.add(c));
    if (candidates.size === 0) {
      const indexChunk = (home.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/) || [])[0];
      if (indexChunk) {
        const idx = (await getText(`${SITE}${indexChunk}`)).text;
        (idx.match(/Login-[A-Za-z0-9_-]+\.js/g) || []).forEach((c) => candidates.add(c));
      }
    }
    // Prefer the customer Login chunk (exclude AdminLogin / StaffLogin / OTPLoginPage).
    const chunk = [...candidates].find((c) => /(^|\/)Login-/.test(c) && !/Admin|Staff|OTP/.test(c)) || [...candidates][0];
    if (!chunk) {
      record("Ph1", "phish", "Login redirect stays on-origin", "INFO", "Could not locate the Login chunk to inspect.");
    } else {
      const url = chunk.startsWith("/") ? `${SITE}${chunk}` : `${SITE}/assets/${chunk}`;
      const js = (await getText(url)).text;
      // Vulnerable guard: /^\/(?!\/)/ (accepts "/\evil" -> off-origin).
      const hasVulnGuard = js.includes("/^\\/(?!\\/)/") || /\/\^\\\/\(\?!\\\/\)\//.test(js);
      const hasSafeGuard = js.includes("resolved.origin") || js.includes(".origin!==") || js.includes(".origin !==");
      const vulnerable = hasVulnGuard && !hasSafeGuard;
      record("Ph1", "phish", "Login redirect stays on-origin (no backslash bypass)",
        vulnerable ? "VULNERABLE" : (hasSafeGuard ? "SAFE" : "INFO"),
        vulnerable
          ? `Deployed Login chunk (${chunk}) uses the bypassable guard /^\\/(?!\\/)/ — "/\\evil.example" resolves off-origin. Fix: compare resolved origin to window.location.origin.`
          : hasSafeGuard ? `Login (${chunk}) uses an origin-comparison guard.` : `Could not classify the guard in ${chunk}; inspect manually.`);
    }
  } catch (e) { record("Ph1", "phish", "Login redirect stays on-origin", "INFO", `probe failed: ${e.message}`); }

  // Ph2: production must send a real anti-framing header (clickjacking).
  try {
    const h = (await getText(`${SITE}/`)).headers;
    const csp = h.get("content-security-policy") || "";
    const xfo = h.get("x-frame-options") || "";
    const framed = !/frame-ancestors/i.test(csp) && !xfo;
    record("Ph2", "phish", "Pages cannot be framed (clickjacking protection)",
      framed ? "VULNERABLE" : "SAFE",
      framed
        ? "No frame-ancestors CSP header and no X-Frame-Options. Admin/manage-booking pages are frameable. Fix: set the header at the host (a <meta> CSP does not count)."
        : `Frame protection present (${xfo ? "X-Frame-Options" : "frame-ancestors"}).`);
  } catch (e) { record("Ph2", "phish", "Clickjacking protection", "INFO", `probe failed: ${e.message}`); }
}

// ============================================================================
// SCENARIO GROUP 5 — INFO / HARDENING (not direct theft)
// ============================================================================
async function group_info() {
  console.log("\n== Hardening / cost-abuse (lower priority) ==");
  const quota = ["get-google-reviews", "get-home-performance", "synthetic-monitor"];
  const reachable = [];
  for (const name of quota) {
    const r = await fn(name, {});
    if (r.status === 200) reachable.push(name);
  }
  record("H1", "info", "Unauthenticated cost/quota endpoints",
    reachable.length ? "INFO" : "INFO",
    reachable.length ? `Anon-reachable (may consume paid third-party/LLM/quota): ${reachable.join(", ")}` : "None reachable.");
}

// ============================================================================
// AUTHENTICATED SURFACE — DECLARED, NOT TESTED
// ============================================================================
function group_needsLogin() {
  console.log("\n== Needs test accounts — NOT judged here ==");
  const items = [
    ["NL1", "Role escalation (client -> therapist -> admin -> super_admin)"],
    ["NL2", "Authenticated RLS / cross-user data access"],
    ["NL3", "Cross-country / tenant isolation (incl. admin-ai-chat, business-intelligence)"],
    ["NL4", "Authenticated payment / refund abuse with a real session"],
    ["NL5", "OTP replay, session reuse, password reset"],
    ["NL6", "25-way double-booking race on a disposable slot"],
    ["NL7", "Stripe webhook replay with a valid signature"],
  ];
  for (const [id, title] of items) record(id, "login", title, "NEEDS LOGIN",
    "Provide role test accounts / staging / Stripe test keys to close this.");
}

// ---- run --------------------------------------------------------------------
(async () => {
  console.log("MASSAVO LIVE SECURITY SCAN");
  console.log(`site:     ${SITE}`);
  console.log(`api:      ${SUPABASE_URL}`);
  console.log(`time:     ${new Date().toISOString()}`);
  console.log("mode:     synthetic data only — no real data read, no money moved");

  await group_dataTheft();
  await group_money();
  await group_tamper();
  await group_phishing();
  await group_info();
  group_needsLogin();

  // ---- verdict --------------------------------------------------------------
  const blocking = results.filter((r) => ["theft", "money", "tamper", "phish"].includes(r.kind) && r.verdict === "VULNERABLE");
  const needsLogin = results.filter((r) => r.verdict === "NEEDS LOGIN");
  console.log("\n" + "=".repeat(70));
  if (blocking.length === 0) {
    console.log("VERDICT: no OPEN theft/tampering/phishing path found in the tests run.");
    console.log("         (This is NOT a full clearance — see NEEDS LOGIN items below.)");
  } else {
    console.log(`VERDICT: NOT SAFE TO OPERATE — ${blocking.length} open path(s) that enable`);
    console.log("         data theft, fraud, tampering or phishing:");
    for (const b of blocking) console.log(`           - ${b.id}  ${b.title}`);
  }
  console.log(`\nStill UNTESTED (need accounts, never assume safe): ${needsLogin.length} scenarios (NL1-NL7).`);
  console.log("=".repeat(70));

  // Non-zero exit if any theft/money/tamper path is open (money+theft+tamper are
  // hard-blocking; phishing is reported but does not fail the gate on its own).
  const hardBlock = results.filter((r) => ["theft", "money", "tamper"].includes(r.kind) && r.verdict === "VULNERABLE");
  process.exit(hardBlock.length ? 1 : 0);
})().catch((e) => { console.error("scanner error:", e); process.exit(2); });
