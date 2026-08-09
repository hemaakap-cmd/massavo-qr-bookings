import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { buildCorsHeaders } from "../_shared/cors.ts";


interface TherapistData {
  name: string;
  rating: number | null;
  score: number | null;
}

interface TopReview {
  comment: string;
  customer_first_name: string | null;
  avg: number;
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { country_id } = await req.json().catch(() => ({}));

    if (!country_id) {
      return new Response(JSON.stringify({ error: "country_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: gyms, error: gymsError } = await serviceClient
      .from("gyms")
      .select("id")
      .eq("country_id", country_id)
      .eq("is_active", true);

    if (gymsError) throw gymsError;

    const gymIds = (gyms || []).map((gym) => gym.id);

    const { data: hotels, error: hotelsError } = await serviceClient
      .from("hotels")
      .select("id")
      .eq("country_id", country_id)
      .eq("is_active", true);

    if (hotelsError) throw hotelsError;

    const hotelIds = (hotels || []).map((h) => h.id);

    if (gymIds.length === 0 && hotelIds.length === 0) {
      return new Response(JSON.stringify({ therapists: [], topReview: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Therapist filter: by gym (legacy direct) OR by venue assignment to any active gym/hotel in country
    const therapistsQuery = serviceClient
      .from("therapists")
      .select("name, rating")
      .eq("is_available", true);

    if (gymIds.length > 0) {
      therapistsQuery.in("gym_id", gymIds);
    } else {
      // No gyms — return empty therapists for now (hotel-only therapists not in gym_id)
      therapistsQuery.eq("id", "00000000-0000-0000-0000-000000000000");
    }

    // Feedback: union of gym_id IN gyms OR hotel_id IN hotels
    const feedbackOrFilter = [
      gymIds.length > 0 ? `gym_id.in.(${gymIds.join(",")})` : null,
      hotelIds.length > 0 ? `hotel_id.in.(${hotelIds.join(",")})` : null,
    ].filter(Boolean).join(",");

    const [therapistsRes, feedbackRes] = await Promise.all([
      therapistsQuery,
      serviceClient
        .from("booking_feedback")
        .select("therapist_rating, service_rating, comment, customer_first_name")
        .eq("is_submitted", true)
        .eq("is_flagged", false)
        .or(feedbackOrFilter)
        .not("comment", "is", null),
    ]);

    if (therapistsRes.error) throw therapistsRes.error;
    if (feedbackRes.error) throw feedbackRes.error;

    const therapists: TherapistData[] = (therapistsRes.data || [])
      .map((therapist) => ({
        name: therapist.name || "Unknown",
        rating: therapist.rating,
        score: null,
      }))
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

    const topReviewRow = (feedbackRes.data || [])
      .filter((feedback) => feedback.comment && feedback.therapist_rating && feedback.service_rating)
      .map((feedback) => ({
        ...feedback,
        avg: ((feedback.therapist_rating || 0) + (feedback.service_rating || 0)) / 2,
      }))
      .sort((a, b) => b.avg - a.avg)[0];

    const topReview: TopReview | null = topReviewRow
      ? {
          comment: topReviewRow.comment!,
          customer_first_name: topReviewRow.customer_first_name,
          avg: Math.round(topReviewRow.avg * 10) / 10,
        }
      : null;

    return new Response(JSON.stringify({ therapists, topReview }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("get-home-performance error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
