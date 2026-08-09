import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";


Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token, therapist_rating, service_rating, comment } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Token is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!therapist_rating || !service_rating || therapist_rating < 1 || therapist_rating > 5 || service_rating < 1 || service_rating > 5) {
      return new Response(JSON.stringify({ error: "Ratings must be between 1 and 5" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize comment
    const sanitizedComment = comment
      ? String(comment).slice(0, 500).replace(/<[^>]*>/g, "").trim()
      : null;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find feedback by token
    const { data: feedback, error: findErr } = await supabaseAdmin
      .from("booking_feedback")
      .select("id, booking_id, is_submitted")
      .eq("feedback_token", token)
      .single();

    if (findErr || !feedback) {
      return new Response(JSON.stringify({ error: "Invalid or expired feedback link" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (feedback.is_submitted) {
      return new Response(JSON.stringify({ error: "Feedback already submitted" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify booking is completed
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("status")
      .eq("id", feedback.booking_id)
      .single();

    if (!booking || booking.status !== "completed") {
      return new Response(JSON.stringify({ error: "Booking is not completed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Submit feedback
    const { error: updateErr } = await supabaseAdmin
      .from("booking_feedback")
      .update({
        therapist_rating,
        service_rating,
        comment: sanitizedComment,
        is_submitted: true,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", feedback.id);

    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("submit-feedback error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
