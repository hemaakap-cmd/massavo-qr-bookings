import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

// Simple in-memory rate limiter
// Note: In production with multiple instances, use Redis or similar
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute

function getClientIP(req: Request): string {
  // Try various headers for client IP
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  
  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }
  
  // Fallback to a hash of user-agent + accept-language as fingerprint
  const ua = req.headers.get("user-agent") || "";
  const lang = req.headers.get("accept-language") || "";
  return `fingerprint:${btoa(ua + lang).slice(0, 32)}`;
}

function isRateLimited(clientIP: string): { limited: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = rateLimitStore.get(clientIP);
  
  if (!record || now > record.resetTime) {
    // New window
    rateLimitStore.set(clientIP, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
    return { limited: false, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }
  
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { 
      limited: true, 
      remaining: 0, 
      resetIn: record.resetTime - now 
    };
  }
  
  record.count++;
  return { 
    limited: false, 
    remaining: RATE_LIMIT_MAX_REQUESTS - record.count, 
    resetIn: record.resetTime - now 
  };
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientIP = getClientIP(req);
    const rateLimit = isRateLimited(clientIP);
    
    // Add rate limit headers
    const rateLimitHeaders = {
      ...corsHeaders,
      "X-RateLimit-Limit": RATE_LIMIT_MAX_REQUESTS.toString(),
      "X-RateLimit-Remaining": rateLimit.remaining.toString(),
      "X-RateLimit-Reset": Math.ceil(rateLimit.resetIn / 1000).toString(),
    };
    
    if (rateLimit.limited) {
      return new Response(
        JSON.stringify({ 
          error: "Too many requests. Please try again later.",
          retryAfter: Math.ceil(rateLimit.resetIn / 1000)
        }),
        {
          status: 429,
          headers: { ...rateLimitHeaders, "Content-Type": "application/json", "Retry-After": Math.ceil(rateLimit.resetIn / 1000).toString() },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Parse query parameters
    const url = new URL(req.url);
    const cityId = url.searchParams.get("city_id");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100); // Max 100
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Build query
    let query = supabase
      .from("gyms_public")
      .select("id, name, address, city_id, rating, review_count, image_url, open_hours, is_active")
      .eq("is_active", true)
      .range(offset, offset + limit - 1)
      .order("rating", { ascending: false });

    if (cityId) {
      query = query.eq("city_id", cityId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching gyms:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch gyms" }),
        {
          status: 500,
          headers: { ...rateLimitHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        data, 
        pagination: { 
          limit, 
          offset, 
          count: data?.length || 0 
        } 
      }),
      {
        status: 200,
        headers: { ...rateLimitHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error in get-gyms-public:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
