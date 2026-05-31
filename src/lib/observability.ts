/**
 * Batch E.2: lightweight client-side observability.
 * - Captures global JS errors + unhandled rejections.
 * - Reports Web Vitals (LCP, CLS, INP, TTFB) when degraded.
 * - Sends to log-incident edge function (sendBeacon when possible).
 * - Heavily throttled and PII-free.
 */
import { onCLS, onINP, onLCP, onTTFB, type Metric } from "web-vitals";

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/log-incident`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const sentFingerprints = new Set<string>();
const MAX_SENT = 50;

function fingerprint(parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join("|").slice(0, 128);
}

function send(payload: Record<string, unknown>) {
  try {
    const fp = String(payload.fingerprint || "");
    if (!fp) return;
    if (sentFingerprints.has(fp)) return;
    sentFingerprints.add(fp);
    if (sentFingerprints.size > MAX_SENT) {
      const first = sentFingerprints.values().next().value;
      if (first) sentFingerprints.delete(first);
    }
    const body = JSON.stringify({ ...payload, route: location.pathname });
    if ("sendBeacon" in navigator) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(ENDPOINT, blob);
      return;
    }
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* noop */
  }
}

export function reportClientIncident(opts: {
  source: "client.error_boundary" | "client.window_error" | "client.unhandled_rejection" | "client.realtime";
  message: string;
  fingerprint: string;
  severity?: "info" | "warning" | "error" | "critical";
}) {
  send({
    source: opts.source,
    message: opts.message.slice(0, 500),
    fingerprint: opts.fingerprint.slice(0, 128),
    severity: opts.severity ?? "error",
  });
}

function reportVital(metric: Metric) {
  // Only report degraded metrics to avoid noise.
  if (metric.rating !== "poor") return;
  send({
    source: "client.web_vitals",
    message: `${metric.name} poor: ${Math.round(metric.value)}`,
    fingerprint: fingerprint([metric.name, location.pathname]),
    severity: "warning",
    vital: { name: metric.name, value: metric.value, rating: metric.rating },
  });
}

let initialized = false;
export function initObservability() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  window.addEventListener("error", (e) => {
    const msg = e.message || "window error";
    const file = (e.filename || "").split("/").pop() || "unknown";
    reportClientIncident({
      source: "client.window_error",
      message: msg,
      fingerprint: fingerprint([file, String(e.lineno), msg.slice(0, 64)]),
      severity: "error",
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    const msg =
      typeof reason === "string"
        ? reason
        : reason && typeof reason === "object" && "message" in reason
        ? String((reason as { message: unknown }).message)
        : "unhandled promise rejection";
    reportClientIncident({
      source: "client.unhandled_rejection",
      message: msg,
      fingerprint: fingerprint(["unhandled", msg.slice(0, 80)]),
      severity: "error",
    });
  });

  try {
    onLCP(reportVital);
    onCLS(reportVital);
    onINP(reportVital);
    onTTFB(reportVital);
  } catch {
    /* noop */
  }
}