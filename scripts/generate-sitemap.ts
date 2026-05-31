// Generates public/sitemap.xml with static + dynamic routes (cities, gyms, hotels).
// Runs before `vite dev` and `vite build` via predev/prebuild hooks.

import { writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://massavo.com";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://lugzhjfguftlfcgjfnbj.supabase.co";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Z3poamZndWZ0bGZjZ2pmbmJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNjY1ODAsImV4cCI6MjA4NDk0MjU4MH0._uP_L7Z_OR_E-m6KqkTbXN_fbXKLDGBF-OUENc4AHHg";

interface Entry {
  path: string;
  changefreq?: string;
  priority?: string;
}

const staticEntries: Entry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/cities", changefreq: "weekly", priority: "0.9" },
  { path: "/hotels", changefreq: "weekly", priority: "0.9" },
  { path: "/services", changefreq: "monthly", priority: "0.9" },
  { path: "/about", changefreq: "monthly", priority: "0.7" },
  { path: "/contact", changefreq: "monthly", priority: "0.7" },
  { path: "/privacy-policy", changefreq: "yearly", priority: "0.4" },
  { path: "/terms-of-service", changefreq: "yearly", priority: "0.4" },
  { path: "/impressum", changefreq: "yearly", priority: "0.4" },
  { path: "/booking-policy", changefreq: "yearly", priority: "0.4" },
  { path: "/cookie-policy", changefreq: "yearly", priority: "0.4" },
];

async function fetchDynamic(): Promise<Entry[]> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const [cities, gyms, hotels] = await Promise.all([
      supabase.from("cities").select("id"),
      supabase.from("gyms_public").select("id, is_active"),
      supabase.from("hotels").select("id, is_active"),
    ]);
    const out: Entry[] = [];
    (cities.data || []).forEach((c: any) => {
      out.push({ path: `/city/${c.id}`, changefreq: "weekly", priority: "0.7" });
      out.push({ path: `/hotels/city/${c.id}`, changefreq: "weekly", priority: "0.6" });
    });
    (gyms.data || []).filter((g: any) => g.is_active !== false).forEach((g: any) => {
      out.push({ path: `/gym/${g.id}`, changefreq: "weekly", priority: "0.8" });
    });
    (hotels.data || []).filter((h: any) => h.is_active !== false).forEach((h: any) => {
      out.push({ path: `/hotel/${h.id}`, changefreq: "weekly", priority: "0.8" });
    });
    return out;
  } catch (err) {
    console.warn("[sitemap] dynamic fetch failed, falling back to static only:", err);
    return [];
  }
}

function render(entries: Entry[]) {
  const urls = entries
    .map((e) =>
      [
        `  <url>`,
        `    <loc>${BASE_URL}${e.path}</loc>`,
        e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
        e.priority ? `    <priority>${e.priority}</priority>` : null,
        `  </url>`,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    urls,
    `</urlset>`,
  ].join("\n");
}

(async () => {
  const dynamic = await fetchDynamic();
  const all = [...staticEntries, ...dynamic];
  writeFileSync(resolve("public/sitemap.xml"), render(all));
  console.log(`sitemap.xml written (${all.length} entries: ${staticEntries.length} static, ${dynamic.length} dynamic)`);
})();