import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { statusForError, messageForError } from "../_shared/auth-errors.ts";


serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    const { data: isAdmin } = await supabaseClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) throw new Error("Unauthorized: admin role required");

    const { messages, country_id } = await req.json();
    if (!country_id) throw new Error("country_id is required");

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch country info
    const { data: countryData } = await serviceClient
      .from("countries")
      .select("name, code, currency_symbol")
      .eq("id", country_id)
      .single();

    const countryName = countryData?.name || "Unknown";
    const currencySymbol = countryData?.currency_symbol || "€";

    // Fetch gyms filtered by country
    const { data: gymsData } = await serviceClient
      .from("gyms")
      .select("id, name, address, commission_percentage, is_active")
      .eq("country_id", country_id);

    const gyms = gymsData || [];
    const gymIds = gyms.map((g) => g.id);

    // Fetch hotels filtered by country
    const { data: hotelsData } = await serviceClient
      .from("hotels")
      .select("id, name, address, commission_percentage, is_active, star_rating")
      .eq("country_id", country_id);

    const hotels = hotelsData || [];
    const hotelIds = hotels.map((h) => h.id);

    let therapists: any[] = [];
    let bookings: any[] = [];
    let hotelBookings: any[] = [];

    if (gymIds.length > 0 || hotelIds.length > 0) {
      const today = new Date().toISOString().split("T")[0];
      const [therapistsRes, bookingsRes, hotelBookingsRes] = await Promise.all([
        serviceClient
          .from("therapists")
          // phone/email are on therapist_private_info, not therapists — selecting
          // them here threw 42703 and broke admin AI chat entirely. They are also
          // PII that should not be placed in a model prompt, so they are dropped.
          .select("id, name, is_available, profession, gym_id")
          .or(gymIds.length ? `gym_id.in.(${gymIds.join(",")})` : "id.is.null"),
        gymIds.length
          ? serviceClient
          .from("bookings")
          .select("id, booking_date, booking_time, status, payment_status, total_amount, customer_name, gym_id")
          .in("gym_id", gymIds)
          .order("created_at", { ascending: false })
          .limit(50)
          : Promise.resolve({ data: [] as any[] }),
        hotelIds.length
          ? serviceClient
              .from("bookings")
              .select("id, booking_date, booking_time, status, payment_status, total_amount, customer_name, hotel_id")
              .in("hotel_id", hotelIds)
              .order("created_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      therapists = therapistsRes.data || [];
      bookings = (bookingsRes as any).data || [];
      hotelBookings = (hotelBookingsRes as any).data || [];
    }

    const today = new Date().toISOString().split("T")[0];
    const allBookings = [...bookings, ...hotelBookings];
    const todayBookings = allBookings.filter((b) => b.booking_date === today);
    const paidRevenue = allBookings
      .filter((b) => b.payment_status === "paid")
      .reduce((s, b) => s + Number(b.total_amount), 0);
    const pendingCount = allBookings.filter((b) => b.status === "pending").length;

    const systemPrompt = `You are the MASSAVO AI Admin Assistant. You help platform administrators manage their massage booking platform.

IMPORTANT: You are currently viewing data ONLY for **${countryName}**. Do not reference data from other countries.

OPERATIONAL MODEL — CRITICAL CONTEXT:
MASSAVO provides massage and therapy services INSIDE partner WELLNESS VENUES — primarily gyms and hotels (and in future, clinics, spas, corporate sites).
- Services are delivered on-site at contracted venues (gyms + hotels).
- Primary clients are gym members, athletes, and hotel guests.
- Peak demand correlates directly with gym training hours (typically early morning, lunch, and evening).
- Therapists travel to assigned venue locations — they are not based in a central office.
- Revenue depends on venue partnerships: each venue has a commission percentage deducted from bookings.

CURRENT PLATFORM DATA for ${countryName} (live snapshot):
- Total Gyms: ${gyms.length} (Active: ${gyms.filter((g) => g.is_active).length})
- Total Hotels: ${hotels.length} (Active: ${hotels.filter((h) => h.is_active).length})
- Total Therapists: ${therapists.length} (Available: ${therapists.filter((t) => t.is_available).length})
- Recent Gym Bookings (last 50): ${bookings.length}
- Recent Hotel Bookings (last 50): ${hotelBookings.length}
- Today's Bookings: ${todayBookings.length}
- Pending Bookings: ${pendingCount}
- Total Revenue (paid): ${currencySymbol}${paidRevenue.toFixed(2)}
- Today's Date: ${today}

GYM DETAILS:
${gyms.map((g) => `- ${g.name}: Commission ${g.commission_percentage}%, Active: ${g.is_active}`).join("\n")}

HOTEL DETAILS:
${hotels.map((h) => `- ${h.name}${h.star_rating ? ` (${h.star_rating}★)` : ""}: Commission ${h.commission_percentage}%, Active: ${h.is_active}`).join("\n") || "No hotels yet."}

THERAPIST DETAILS:
${therapists.map((t) => `- ${t.name}: ${t.profession}, Available: ${t.is_available}`).join("\n")}

TODAY'S SCHEDULE:
${
  todayBookings
    .map((b) => {
      const venue = b.gym_id
        ? gyms.find((g) => g.id === b.gym_id)
        : hotels.find((h) => h.id === b.hotel_id);
      const venueType = b.gym_id ? "Gym" : "Hotel";
      return `- ${b.booking_time} at ${venue?.name || "Unknown"} [${venueType}]: ${b.customer_name || "Anonymous"} (${b.status}, ${b.payment_status})`;
    })
    .join("\n") || "No bookings today."
}

CAPABILITIES:
- Answer questions about bookings, revenue, therapist availability, and venue (gym/hotel) operations
- Provide scheduling insights considering venue hours and therapist travel logistics
- Help with financial analysis including venue commission calculations (gym vs hotel breakdown)
- Suggest operational improvements
- Summarize daily/weekly activity per venue (gym or hotel) location

RULES:
- Be concise and professional
- Use ${currencySymbol} for currency
- Format data clearly with tables when appropriate
- Never reveal raw database IDs to the user
- Mask customer emails/personal data in responses`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("admin-ai-chat error:", e);
    // Auth failures are 401/403, not 500 — see _shared/auth-errors.ts.
    return new Response(JSON.stringify({ error: messageForError(e) }), {
      status: statusForError(e),
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
