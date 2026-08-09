import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { buildCorsHeaders } from "../_shared/cors.ts";


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

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");
    const { data: isAdmin } = await supabaseClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) throw new Error("Unauthorized: admin role required");

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload = await req.json().catch(() => ({}));
    const { mode = "data-only", country_id } = payload;

    if (!country_id) {
      throw new Error("country_id is required");
    }

    const { data: hasCountryPermission, error: countryPermError } = await supabaseClient.rpc("has_country_access", {
      _user_id: user.id,
      _country_id: country_id,
    });

    if (countryPermError || !hasCountryPermission) {
      throw new Error("Unauthorized: country access required");
    }

    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

    const { data: gymsData, error: gymsError } = await serviceClient
      .from("gyms")
      .select("id, name, address, commission_percentage, is_active")
      .eq("country_id", country_id);

    if (gymsError) throw gymsError;

    const { data: hotelsData } = await serviceClient
      .from("hotels")
      .select("id, name, address, commission_percentage, is_active")
      .eq("country_id", country_id);

    const gymList = (gymsData || []).map((g: any) => ({ ...g, venue_type: "gym" as const }));
    const hotelList = (hotelsData || []).map((h: any) => ({ ...h, venue_type: "hotel" as const }));
    const gyms: any[] = [...gymList, ...hotelList];
    const gymIds = gymList.map((g) => g.id);
    const hotelIds = hotelList.map((h) => h.id);

    let therapists: any[] = [];
    let bookings: any[] = [];

    if (gymIds.length > 0 || hotelIds.length > 0) {
      const orParts: string[] = [];
      if (gymIds.length > 0) orParts.push(`gym_id.in.(${gymIds.join(",")})`);
      if (hotelIds.length > 0) orParts.push(`hotel_id.in.(${hotelIds.join(",")})`);
      const [therapistsRes, bookingsRes] = await Promise.all([
        gymIds.length > 0
          ? serviceClient
              .from("therapists")
              .select("id, name, phone, email, is_available, profession, gym_id, city_id, rating, education, created_at")
              .in("gym_id", gymIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        serviceClient
          .from("bookings")
          .select("id, booking_date, booking_time, status, payment_status, total_amount, therapist_id, gym_id, hotel_id, service_id, customer_email, created_at")
          .or(orParts.join(","))
          .gte("booking_date", thirtyDaysAgo)
          .order("booking_date", { ascending: false }),
      ]);

      if ((therapistsRes as any).error) throw (therapistsRes as any).error;
      if (bookingsRes.error) throw bookingsRes.error;

      therapists = therapistsRes.data || [];
      bookings = (bookingsRes.data || []).map((b: any) => ({
        ...b,
        venue_id: b.hotel_id || b.gym_id,
        venue_type: b.hotel_id ? "hotel" : "gym",
      }));
    }

    // Compute analytics per therapist
    const therapistAnalytics = therapists.map((t) => {
      const tBookings = bookings.filter((b) => b.therapist_id === t.id);
      const confirmedBookings = tBookings.filter((b) => b.status === "confirmed");
      const paidBookings = tBookings.filter((b) => b.payment_status === "paid");
      const cancelledBookings = tBookings.filter((b) => b.status === "cancelled");
      const revenue = paidBookings.reduce((s, b) => s + Number(b.total_amount), 0);
      const todayBookings = tBookings.filter((b) => b.booking_date === today);
      const gym = gyms.find((g) => g.id === t.gym_id);

      const activeDays = new Set(confirmedBookings.map((b) => b.booking_date)).size;
      const avgBookingsPerDay = activeDays > 0 ? confirmedBookings.length / activeDays : 0;

      return {
        id: t.id,
        name: t.name,
        profession: t.profession,
        is_available: t.is_available,
        rating: t.rating,
        gym_name: gym?.name || "Unassigned",
        total_bookings_30d: tBookings.length,
        confirmed_bookings: confirmedBookings.length,
        cancelled_bookings: cancelledBookings.length,
        cancellation_rate: tBookings.length > 0 ? ((cancelledBookings.length / tBookings.length) * 100).toFixed(1) : "0",
        revenue_30d: revenue,
        today_bookings: todayBookings.length,
        active_days: activeDays,
        avg_bookings_per_day: avgBookingsPerDay.toFixed(1),
      };
    });

    const totalBookings30d = bookings.length;
    const totalRevenue30d = bookings.filter((b) => b.payment_status === "paid").reduce((s, b) => s + Number(b.total_amount), 0);
    const avgBookingsPerTherapist = therapists.length > 0 ? (totalBookings30d / therapists.length).toFixed(1) : "0";
    const availableTherapists = therapists.filter((t) => t.is_available).length;
    const overloadedThreshold = therapists.length > 0 ? (totalBookings30d / therapists.length) * 1.5 : 10;
    const underloadedThreshold = therapists.length > 0 ? (totalBookings30d / therapists.length) * 0.5 : 1;

    const overloaded = therapistAnalytics.filter((t) => t.confirmed_bookings > overloadedThreshold);
    const underloaded = therapistAnalytics.filter((t) => t.confirmed_bookings < underloadedThreshold && t.is_available);
    const balanced = therapistAnalytics.filter(
      (t) => t.confirmed_bookings >= underloadedThreshold && t.confirmed_bookings <= overloadedThreshold,
    );

    const analyticsData = {
      summary: {
        total_therapists: therapists.length,
        available_therapists: availableTherapists,
        unavailable_therapists: therapists.length - availableTherapists,
        total_bookings_30d: totalBookings30d,
        total_revenue_30d: totalRevenue30d,
        avg_bookings_per_therapist: avgBookingsPerTherapist,
      },
      workload: {
        overloaded: overloaded.map((t) => ({ name: t.name, bookings: t.confirmed_bookings })),
        underloaded: underloaded.map((t) => ({ name: t.name, bookings: t.confirmed_bookings })),
        balanced_count: balanced.length,
      },
      therapist_details: therapistAnalytics.sort((a, b) => b.revenue_30d - a.revenue_30d),
    };

    if (mode === "data-only") {
      return new Response(JSON.stringify(analyticsData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // AI analysis mode - stream recommendations
    const analyticsContext = `
THERAPIST ANALYTICS (Last 30 Days):
- Total Therapists: ${analyticsData.summary.total_therapists} (Available: ${analyticsData.summary.available_therapists})
- Total Bookings: ${analyticsData.summary.total_bookings_30d}
- Total Revenue: €${analyticsData.summary.total_revenue_30d.toFixed(2)}
- Avg Bookings/Therapist: ${analyticsData.summary.avg_bookings_per_therapist}

WORKLOAD DISTRIBUTION:
- Overloaded (>${overloadedThreshold.toFixed(0)} bookings): ${overloaded.map(t => `${t.name} (${t.bookings})`).join(", ") || "None"}
- Underloaded (<${underloadedThreshold.toFixed(0)} bookings): ${underloaded.map(t => `${t.name} (${t.bookings})`).join(", ") || "None"}
- Balanced: ${balanced.length} therapists

TOP PERFORMERS (by revenue):
${therapistAnalytics.slice(0, 5).map(t => `- ${t.name}: €${t.revenue_30d.toFixed(0)}, ${t.confirmed_bookings} bookings, ${t.cancellation_rate}% cancellation`).join("\n")}

BOTTOM PERFORMERS:
${therapistAnalytics.slice(-3).map(t => `- ${t.name}: €${t.revenue_30d.toFixed(0)}, ${t.confirmed_bookings} bookings, ${t.cancellation_rate}% cancellation`).join("\n")}

GYM DISTRIBUTION:
${gyms.map((g: any) => {
  const gymTherapists = therapists.filter(t => t.gym_id === g.id);
  const gymBookings = bookings.filter(b => (b.venue_id || b.gym_id) === g.id);
  const label = g.venue_type === "hotel" ? "[Hotel]" : "[Gym]";
  return `- ${label} ${g.name}: ${gymTherapists.length} therapists, ${gymBookings.length} bookings`;
}).join("\n")}
`;

    const systemPrompt = `You are the MASSAVO Therapist Analytics AI. Analyze the provided data and generate actionable recommendations.

OPERATIONAL MODEL — CRITICAL CONTEXT:
MASSAVO provides sports massage and therapy services INSIDE partner gym locations (Köln, Leverkusen, Bergisch Gladbach).
- Therapists are deployed to contracted gyms — they travel between locations.
- Primary clients are gym members and athletes booking around training hours.
- Peak demand correlates with gym training hours (early morning, lunch breaks, evenings).
- Each gym has a commission percentage; net revenue = booking amount minus gym commission.
- Scheduling must respect per-gym daily hour caps and therapist travel between gyms.
- Workload analysis should consider gym assignment distribution, not just raw booking counts.
- An "overloaded" therapist at one gym may indicate that gym needs an additional therapist, not that the therapist should reduce hours.
- Marketing recommendations should focus on gym-member engagement (QR codes on-site, post-workout recovery messaging, athlete-focused campaigns).

${analyticsContext}

Generate a structured analysis with these sections:
1. **Executive Summary** — 2-3 sentence overview of therapist performance across gym locations
2. **Gym-Level Insights** — Performance per gym: which gyms are over/under-served by therapists
3. **Workload Alerts** — Flag overloaded/underloaded therapists with rebalancing suggestions considering gym assignments
4. **Performance Insights** — Top performers, improvement areas, cancellation patterns
5. **Scheduling Recommendations** — Concrete suggestions for optimizing therapist-to-gym allocation and peak-hour coverage
6. **Action Items** — Prioritized list of recommended admin actions (max 5)

RULES:
- Be specific with names and numbers
- Use € for currency
- Frame all insights in terms of gym locations and athlete-focused service delivery
- Prioritize actionable insights over general observations
- Flag any anomalies or concerning patterns
- Keep total response under 500 words
- Use markdown formatting with headers and bullet points`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Analyze the current therapist data and provide your recommendations." },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("therapist-analytics error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
