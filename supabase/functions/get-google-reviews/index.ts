import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { enforceRateLimit, tooManyRequests } from "../_shared/rate-limit.ts";

/**
 * SECURITY (remediation item 13): this endpoint is unauthenticated and every call
 * used to trigger up to three BILLED Google Places requests, so an anonymous
 * caller could drain the Places quota (and the card behind it) with a loop.
 *
 * The reviews are a single fixed public business listing that changes at most a
 * few times a week, so the fix is a durable server-side cache plus a strict
 * per-IP limit on cache MISSES only:
 *   - a fresh cache entry is served without touching Google at all,
 *   - a miss costs one Google fetch and is limited per trusted IP,
 *   - a limited caller with a stale entry is served the stale entry rather than
 *     an error, so abuse degrades freshness, never availability.
 */
const CACHE_KEY = "google_reviews_cache";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

async function readCache(db: ReturnType<typeof serviceClient>) {
  const { data, error } = await db
    .from("system_settings")
    .select("value, updated_at")
    .eq("key", CACHE_KEY)
    .maybeSingle();
  if (error || !data?.value) return null;
  const ageMs = Date.now() - new Date(data.updated_at as string).getTime();
  return { payload: data.value as Record<string, unknown>, fresh: ageMs < CACHE_TTL_MS };
}

async function writeCache(db: ReturnType<typeof serviceClient>, payload: unknown) {
  const { error } = await db
    .from("system_settings")
    .upsert({ key: CACHE_KEY, value: payload, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) console.error("[get-google-reviews] cache write failed:", error.message);
}


serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const jsonResponse = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const db = serviceClient();
    const cached = await readCache(db);

    // Fresh cache: zero paid Google calls.
    if (cached?.fresh) {
      return jsonResponse({ ...cached.payload, source: 'cache' });
    }

    // Cache miss/stale: this is the only path that can spend Google quota.
    const rate = await enforceRateLimit(req, {
      action: "google_reviews_refresh",
      ipMax: 5,
      ipWindowMinutes: 60,
      blockMinutes: 60,
    });
    if (!rate.allowed) {
      if (cached) return jsonResponse({ ...cached.payload, source: 'cache_stale' });
      return tooManyRequests(corsHeaders, rate, "Reviews are temporarily unavailable. Please try again later.");
    }

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      if (cached) return jsonResponse({ ...cached.payload, source: 'cache_stale' });
      throw new Error('Google Places API key not configured');
    }

    // Strategy 1: Use the legacy Find Place API (often indexes new businesses faster)
    let place = null;
    let reviews = null;
    let rating = null;
    let totalRatings = null;

    try {
      const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=Massavo+Premium+Sportmassage+K%C3%B6ln&inputtype=textquery&fields=place_id,name&key=${apiKey}`;
      const findRes = await fetch(findUrl);
      const findData = await findRes.json();
      console.log('Legacy Find Place:', JSON.stringify(findData));

      const candidate = findData.candidates?.find((c: any) =>
        (c.name || '').toLowerCase().includes('massavo')
      );

      if (candidate?.place_id) {
        // Get details with reviews using legacy API
        const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${candidate.place_id}&fields=name,rating,user_ratings_total,reviews&language=de&key=${apiKey}`;
        const detailRes = await fetch(detailUrl);
        const detailData = await detailRes.json();
        console.log('Legacy Place Details status:', detailData.status, 'name:', detailData.result?.name);

        if (detailData.result) {
          const result = detailData.result;
          rating = result.rating;
          totalRatings = result.user_ratings_total;
          reviews = (result.reviews || []).slice(0, 5).map((r: any) => ({
            author_name: r.author_name || 'Anonymous',
            rating: r.rating,
            text: r.text || '',
            relative_time_description: r.relative_time_description || '',
            profile_photo_url: r.profile_photo_url || '',
          }));
        }
      }
    } catch (e) {
      console.error('Legacy API failed:', e.message);
    }

    // Strategy 2: Try New Places API with location bias
    if (!reviews) {
      const queries = [
        'Massavo – Premium Sportmassage Köln',
        'Massavo Sportmassage',
      ];

      for (const query of queries) {
        const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.reviews,places.rating,places.userRatingCount',
          },
          body: JSON.stringify({
            textQuery: query,
            languageCode: 'de',
            regionCode: 'DE',
            locationBias: {
              circle: {
                center: { latitude: 50.9375, longitude: 6.9603 },
                radius: 30000.0,
              },
            },
          }),
        });
        const searchData = await searchRes.json();
        console.log(`New API "${query}":`, JSON.stringify(searchData.places?.map((p: any) => p.displayName?.text) || 'none'));

        if (searchData.places) {
          const match = searchData.places.find((p: any) =>
            (p.displayName?.text || '').toLowerCase().includes('massavo')
          );
          if (match) {
            rating = match.rating;
            totalRatings = match.userRatingCount;
            reviews = (match.reviews || []).slice(0, 5).map((r: any) => ({
              author_name: r.authorAttribution?.displayName || 'Anonymous',
              rating: r.rating,
              text: r.text?.text || '',
              relative_time_description: r.relativePublishTimeDescription || '',
              profile_photo_url: r.authorAttribution?.photoUri || '',
            }));
            break;
          }
        }
      }
    }

    if (reviews && reviews.length > 0) {
      const payload = {
        reviews,
        rating: rating || 5.0,
        total_ratings: totalRatings || reviews.length,
        source: 'google_places_api',
      };
      await writeCache(db, payload);
      return jsonResponse(payload);
    }

    // Fallback reviews
    console.log('Massavo not found via any API, using fallback reviews');
    const fallbackPayload = {
      reviews: [
        {
          author_name: 'Jannik S.',
          rating: 5,
          text: 'Absolut professionelle Sportmassage! Die Therapeuten wissen genau, was sie tun. Nach meinem Training war die Massage genau das, was ich gebraucht habe. Sehr empfehlenswert!',
          relative_time_description: 'vor einem Monat',
          profile_photo_url: '',
        },
        {
          author_name: 'Laura M.',
          rating: 5,
          text: 'Super Konzept direkt im Fitnessstudio! Keine lange Anfahrt, einfach nach dem Workout eine Massage buchen. Die Online-Buchung ist unkompliziert und der Service erstklassig.',
          relative_time_description: 'vor 2 Wochen',
          profile_photo_url: '',
        },
        {
          author_name: 'Thomas K.',
          rating: 5,
          text: 'Beste Sportmassage in Köln! Ich gehe regelmäßig nach dem Training hin. Die Therapeuten sind top ausgebildet und gehen individuell auf Verspannungen ein. Preis-Leistung stimmt!',
          relative_time_description: 'vor 3 Wochen',
          profile_photo_url: '',
        },
      ],
      rating: 5.0,
      total_ratings: 3,
      source: 'fallback',
    };
    // Cache the fallback too, so a persistently unmatched listing does not mean a
    // paid lookup on every single page view.
    await writeCache(db, fallbackPayload);
    return jsonResponse(fallbackPayload);
  } catch (error) {
    // SECURITY (remediation item 14): never echo the upstream/internal message.
    console.error('[get-google-reviews] failed:', error instanceof Error ? error.message : error);
    return jsonResponse({ error: 'Reviews are temporarily unavailable.' }, 503);
  }
});
