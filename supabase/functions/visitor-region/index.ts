/**
 * visitor-region
 *
 * First-party replacement for the browser-side IP-geolocation calls that used to
 * hit ipapi.co / ipwho.is from every public page.
 *
 * Privacy design:
 *  - No external geolocation provider is contacted. The approximate region is
 *    derived ONLY from metadata our own infrastructure already receives with the
 *    request (edge network geo headers).
 *  - The visitor IP is never stored, logged or forwarded anywhere.
 *  - When no geo metadata is available the response is simply "Unknown"; the
 *    caller must degrade gracefully.
 */
import { buildCorsHeaders } from "../_shared/cors.ts";

function firstHeader(req: Request, names: string[]): string {
  for (const n of names) {
    const v = req.headers.get(n);
    if (v && v.trim() && v.trim() !== "XX" && v.trim() !== "T1") {
      return decodeURIComponent(v.trim());
    }
  }
  return "";
}

Deno.serve((req) => {
  const cors = buildCorsHeaders(req, { methods: "GET, POST, OPTIONS" });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  // Edge/CDN supplied geo metadata (Cloudflare in front of the platform, plus
  // common equivalents). Nothing here identifies the visitor personally.
  const city = firstHeader(req, ["cf-ipcity", "x-vercel-ip-city", "x-geo-city"]);
  const country = firstHeader(req, [
    "cf-ipcountry",
    "x-vercel-ip-country",
    "x-geo-country",
  ]);

  return new Response(
    JSON.stringify({
      city: city || "Unknown",
      country: country || "",
    }),
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
