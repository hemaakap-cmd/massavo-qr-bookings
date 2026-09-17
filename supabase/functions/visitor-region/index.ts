/**
 * visitor-region
 *
 * First-party replacement for the browser-side IP-geolocation calls that used to
 * run on every public page (ipapi.co / ipwho.is fetched directly by the client).
 *
 * Privacy design:
 *  1. Preferred path: the approximate region is taken from geo metadata our own
 *     edge network already attaches to the request. No external service at all.
 *  2. Fallback path: if that metadata is absent, this function performs the
 *     lookup server-side. The visitor's browser never talks to the provider,
 *     the IP is never stored or logged here, and the result is cached in memory
 *     so repeat visitors do not trigger new lookups.
 *  3. If everything fails the response is "Unknown" and the caller degrades
 *     gracefully.
 */
import { buildCorsHeaders } from "../_shared/cors.ts";
import { getTrustedClientIp } from "../_shared/client-identity.ts";

interface Region {
  city: string;
  country: string;
}

function firstHeader(req: Request, names: string[]): string {
  for (const n of names) {
    const v = req.headers.get(n);
    if (v && v.trim() && v.trim() !== "XX" && v.trim() !== "T1") {
      return decodeURIComponent(v.trim());
    }
  }
  return "";
}

/** IP -> region cache, kept only in this instance's memory (30 min). */
const cache = new Map<string, { at: number; region: Region }>();
const TTL_MS = 30 * 60 * 1000;

async function lookup(ip: string): Promise<Region> {
  const hit = cache.get(ip);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.region;

  let region: Region = { city: "Unknown", country: "" };
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { "User-Agent": "massavo-visitor-region" },
    });
    if (res.ok) {
      const d = (await res.json()) as { city?: string; country_name?: string };
      if (d.city) region = { city: d.city, country: d.country_name ?? "" };
    }
  } catch {
    // Provider unreachable — stay "Unknown".
  }

  if (region.city !== "Unknown") cache.set(ip, { at: Date.now(), region });
  return region;
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req, { methods: "GET, POST, OPTIONS" });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  // 1. Edge/CDN geo metadata (no third party involved).
  let city = firstHeader(req, ["cf-ipcity", "x-vercel-ip-city", "x-geo-city"]);
  let country = firstHeader(req, [
    "cf-ipcountry",
    "x-vercel-ip-country",
    "x-geo-country",
  ]);

  // 2. Server-side fallback lookup, never exposing the visitor to the provider.
  if (!city) {
    const ip = getTrustedClientIp(req);
    if (ip && ip !== "unknown" && !ip.startsWith("127.") && ip !== "::1") {
      const region = await lookup(ip);
      city = region.city === "Unknown" ? "" : region.city;
      country = country || region.country;
    }
  }

  return new Response(
    JSON.stringify({ city: city || "Unknown", country: country || "" }),
    {
      headers: {
        ...cors,
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=300",
      },
      status: 200,
    },
  );
});
