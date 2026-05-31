/**
 * Batch E.2: provider-agnostic analytics layer.
 * Currently wires Microsoft Clarity. PostHog can be added by implementing
 * the same `AnalyticsProvider` interface and registering it in initAnalytics().
 *
 * Privacy: never pass medical/clinical/PII data. We only forward
 * anonymous funnel events (booking_started, booking_completed, etc.).
 */

export interface AnalyticsProvider {
  init(): void;
  identify(userId?: string): void;
  event(name: string, props?: Record<string, string | number | boolean>): void;
}

const CLARITY_ID = import.meta.env.VITE_CLARITY_PROJECT_ID as string | undefined;

const ClarityProvider: AnalyticsProvider = {
  init() {
    if (!CLARITY_ID || typeof window === "undefined") return;
    if ((window as unknown as { clarity?: unknown }).clarity) return;
    // Official Clarity loader (inline, async).
    /* eslint-disable */
    (function (c: any, l: any, a: any, r: any, i: any) {
      c[a] =
        c[a] ||
        function () {
          (c[a].q = c[a].q || []).push(arguments);
        };
      const t = l.createElement(r);
      t.async = 1;
      t.src = "https://www.clarity.ms/tag/" + i;
      const y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", CLARITY_ID);
    /* eslint-enable */
  },
  identify(userId) {
    const w = window as unknown as { clarity?: (...args: unknown[]) => void };
    if (!w.clarity) return;
    if (userId) w.clarity("identify", userId);
  },
  event(name, props) {
    const w = window as unknown as { clarity?: (...args: unknown[]) => void };
    if (!w.clarity) return;
    w.clarity("event", name);
    if (props) {
      Object.entries(props).forEach(([k, v]) => w.clarity!("set", k, String(v)));
    }
  },
};

const providers: AnalyticsProvider[] = [ClarityProvider];

let initialized = false;
export function initAnalytics() {
  if (initialized) return;
  initialized = true;
  providers.forEach((p) => {
    try {
      p.init();
    } catch {
      /* noop */
    }
  });
}

export function trackEvent(name: string, props?: Record<string, string | number | boolean>) {
  providers.forEach((p) => {
    try {
      p.event(name, props);
    } catch {
      /* noop */
    }
  });
}

export function identifyUser(userId?: string) {
  providers.forEach((p) => {
    try {
      p.identify(userId);
    } catch {
      /* noop */
    }
  });
}