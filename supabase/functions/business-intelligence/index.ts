import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { buildCorsHeaders } from "../_shared/cors.ts";


interface BookingRow {
  id: string;
  booking_date: string;
  booking_time: string;
  status: string;
  payment_status: string;
  total_amount: number;
  therapist_id: string | null;
  gym_id: string | null;
  hotel_id?: string | null;
  venue_id?: string;
  venue_type?: "gym" | "hotel";
  service_id: string;
  created_at: string;
}

interface TherapistRow {
  id: string;
  name: string;
  is_available: boolean;
  gym_id: string;
  rating: number;
  profession: string;
}

interface GymRow {
  id: string;
  name: string;
  commission_percentage: number;
  is_active: boolean;
  venue_type?: "gym" | "hotel";
}

interface BodyAreaRow {
  booking_id: string;
  area_code: string;
  pain_intensity: number | null;
  is_focus: boolean;
}

interface AssignmentRow {
  therapist_id: string;
  gym_id: string;
  assignment_date: string;
  status: string;
}

// ── Demand Prediction Engine ──
function computeDemandPrediction(bookings: BookingRow[], gyms: GymRow[]) {
  const now = new Date();
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  // Build historical patterns from last 6 months
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const historical = bookings.filter(b => new Date(b.booking_date) >= sixMonthsAgo && b.status !== "cancelled");

  // Day-of-week density
  const dowCounts: Record<string, number[]> = {};
  dayNames.forEach(d => { dowCounts[d] = []; });

  // Group by week to get per-week counts per DOW
  const weekMap = new Map<string, Map<string, number>>();
  historical.forEach(b => {
    const d = new Date(b.booking_date);
    const weekKey = `${d.getFullYear()}-W${Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7)}-${d.getMonth()}`;
    const dow = dayNames[d.getDay()];
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, new Map());
    const wm = weekMap.get(weekKey)!;
    wm.set(dow, (wm.get(dow) || 0) + 1);
  });
  weekMap.forEach(wm => {
    dayNames.forEach(dow => {
      dowCounts[dow].push(wm.get(dow) || 0);
    });
  });

  const dowAvg: Record<string, number> = {};
  dayNames.forEach(d => {
    const arr = dowCounts[d];
    dowAvg[d] = arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  });

  // Hour-of-day density
  const hourCounts: Record<string, number> = {};
  historical.forEach(b => {
    const h = b.booking_time?.slice(0, 2) || "00";
    hourCounts[h] = (hourCounts[h] || 0) + 1;
  });
  const totalHistorical = historical.length || 1;
  const hourDensity = Object.entries(hourCounts)
    .map(([hour, count]) => ({ hour: `${hour}:00`, density: count / totalHistorical, count }))
    .sort((a, b) => b.count - a.count);

  // Monthly trend (seasonal)
  const monthCounts: number[] = new Array(12).fill(0);
  const monthRevenue: number[] = new Array(12).fill(0);
  historical.forEach(b => {
    const m = new Date(b.booking_date).getMonth();
    monthCounts[m]++;
    if (b.payment_status === "paid") monthRevenue[m] += Number(b.total_amount);
  });
  const avgMonthly = monthCounts.reduce((s, v) => s + v, 0) / 12;
  const seasonalFactors = monthCounts.map(c => avgMonthly > 0 ? c / avgMonthly : 1);

  // Cancellation pattern
  const cancelled = bookings.filter(b => b.status === "cancelled" && new Date(b.booking_date) >= sixMonthsAgo);
  const cancellationRate = historical.length > 0 ? cancelled.length / (historical.length + cancelled.length) : 0;

  // Per-venue demand (gyms + hotels)
  const gymDemand = gyms.filter(g => g.is_active).map(g => {
    const gymBookings = historical.filter(b => (b.venue_id || b.gym_id) === g.id);
    const dailyAvg = gymBookings.length / 180; // ~6 months
    return {
      gym_id: g.id,
      gym_name: g.name,
      venue_type: g.venue_type || "gym",
      total_bookings_6m: gymBookings.length,
      daily_average: Number(dailyAvg.toFixed(2)),
      monthly_average: Number((dailyAvg * 30).toFixed(1)),
    };
  }).sort((a, b) => b.total_bookings_6m - a.total_bookings_6m);

  // Predict next 30 days
  const predictions: { date: string; dow: string; predicted_bookings: number; gym_breakdown: { gym_id: string; predicted: number }[] }[] = [];
  for (let i = 1; i <= 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dow = dayNames[d.getDay()];
    const month = d.getMonth();
    const base = dowAvg[dow] || 0;
    const seasonal = seasonalFactors[month] || 1;
    const predicted = Math.round(base * seasonal * (1 - cancellationRate * 0.3));

    const gymBreakdown = gymDemand.map(g => ({
      gym_id: g.gym_id,
      predicted: Math.round(predicted * (g.total_bookings_6m / (totalHistorical || 1))),
    }));

    predictions.push({
      date: d.toISOString().split("T")[0],
      dow,
      predicted_bookings: predicted,
      gym_breakdown: gymBreakdown,
    });
  }

  // Staffing recommendations
  const avgSessionsPerTherapistPerDay = 5;
  const staffingRecommendations = predictions.map(p => {
    const needed = Math.ceil(p.predicted_bookings / avgSessionsPerTherapistPerDay);
    return { date: p.date, predicted_demand: p.predicted_bookings, therapists_needed: needed };
  });

  // Peak hours prediction
  const peakHours = hourDensity.slice(0, 5).map(h => h.hour);

  return {
    dow_average: dowAvg,
    hour_density: hourDensity.slice(0, 12),
    seasonal_factors: seasonalFactors.map((f, i) => ({
      month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i],
      factor: Number(f.toFixed(2)),
      bookings: monthCounts[i],
      revenue: Number(monthRevenue[i].toFixed(0)),
    })),
    cancellation_rate: Number((cancellationRate * 100).toFixed(1)),
    gym_demand: gymDemand,
    predictions,
    staffing_recommendations: staffingRecommendations,
    peak_hours_predicted: peakHours,
  };
}

// ── Revenue Projection Model ──
function computeRevenueProjection(bookings: BookingRow[], gyms: GymRow[], therapists: TherapistRow[]) {
  const now = new Date();
  const paidBookings = bookings.filter(b => b.payment_status === "paid");

  // Monthly revenue for last 12 months
  const monthlyRevenue: { month: string; revenue: number; bookings: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const endD = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const mBookings = paidBookings.filter(b => {
      const bd = new Date(b.booking_date);
      return bd >= d && bd <= endD;
    });
    monthlyRevenue.push({
      month: mStr,
      revenue: mBookings.reduce((s, b) => s + Number(b.total_amount), 0),
      bookings: mBookings.length,
    });
  }

  // Weighted moving average (last 3 months weighted more)
  const recentRevenue = monthlyRevenue.slice(-6).map(m => m.revenue);
  const weights = [0.05, 0.1, 0.15, 0.2, 0.25, 0.25];
  const actualWeights = weights.slice(-recentRevenue.length);
  const wSum = actualWeights.reduce((s, w) => s + w, 0);
  const wma = recentRevenue.reduce((s, r, i) => s + r * (actualWeights[i] || 0), 0) / (wSum || 1);

  // Growth momentum
  const last3 = monthlyRevenue.slice(-3).map(m => m.revenue);
  const prev3 = monthlyRevenue.slice(-6, -3).map(m => m.revenue);
  const last3Avg = last3.reduce((s, v) => s + v, 0) / (last3.length || 1);
  const prev3Avg = prev3.reduce((s, v) => s + v, 0) / (prev3.length || 1);
  const growthMomentum = prev3Avg > 0 ? (last3Avg - prev3Avg) / prev3Avg : 0;

  // Seasonal adjustment
  const currentMonth = now.getMonth();
  const sameMonthLastYear = paidBookings.filter(b => {
    const bd = new Date(b.booking_date);
    return bd.getMonth() === currentMonth && bd.getFullYear() === now.getFullYear() - 1;
  });
  const yearlySeasonalFactor = sameMonthLastYear.length > 0 ? 1.0 : 1.0;

  // Gym performance weighting
  const gymPerformance = gyms.filter(g => g.is_active).map(g => {
    const gBookings = paidBookings.filter(b => (b.venue_id || b.gym_id) === g.id);
    const revenue = gBookings.reduce((s, b) => s + Number(b.total_amount), 0);
    const commission = revenue * (g.commission_percentage / 100);
    return { gym_id: g.id, name: g.name, venue_type: g.venue_type || "gym", revenue, commission, net: revenue - commission, bookings: gBookings.length };
  });

  // Projections for next 6 months
  const projections: { month: string; conservative: number; expected: number; aggressive: number }[] = [];
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const base = wma * yearlySeasonalFactor;
    const conservative = base * (1 + growthMomentum * 0.3);
    const expected = base * (1 + growthMomentum * 0.7);
    const aggressive = base * (1 + growthMomentum * 1.2 + 0.05);
    projections.push({
      month: mStr,
      conservative: Math.round(conservative),
      expected: Math.round(expected),
      aggressive: Math.round(aggressive),
    });
  }

  const totalNet = gymPerformance.reduce((s, g) => s + g.net, 0);
  const totalRevenue = gymPerformance.reduce((s, g) => s + g.revenue, 0);
  const profitMargin = totalRevenue > 0 ? ((totalNet / totalRevenue) * 100) : 0;

  return {
    monthly_history: monthlyRevenue,
    weighted_moving_average: Math.round(wma),
    growth_momentum: Number((growthMomentum * 100).toFixed(1)),
    gym_profitability: gymPerformance.sort((a, b) => b.net - a.net),
    projections,
    profit_margin: Number(profitMargin.toFixed(1)),
    confidence_range: {
      min: Math.round(wma * 0.8),
      max: Math.round(wma * 1.3),
    },
  };
}

// ── Therapist Scoring Engine 2.0 ──
function computeTherapistScores(
  bookings: BookingRow[],
  therapists: TherapistRow[],
  gyms: GymRow[],
  bodyAreas: BodyAreaRow[],
  assignments: AssignmentRow[]
) {
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  return therapists.map(t => {
    const tBookings = bookings.filter(b => b.therapist_id === t.id);
    const recent = tBookings.filter(b => new Date(b.booking_date) >= threeMonthsAgo);
    const lastMonth = tBookings.filter(b => new Date(b.booking_date) >= oneMonthAgo);
    const paid = recent.filter(b => b.payment_status === "paid");
    const cancelled = recent.filter(b => b.status === "cancelled");
    const completed = recent.filter(b => b.status === "completed" || b.status === "confirmed");

    // Revenue Efficiency (0-25)
    const revenue = paid.reduce((s, b) => s + Number(b.total_amount), 0);
    const activeDays = new Set(completed.map(b => b.booking_date)).size;
    const revenuePerDay = activeDays > 0 ? revenue / activeDays : 0;
    const revenueScore = Math.min(25, (revenuePerDay / 200) * 25); // €200/day = max

    // Clinical Impact (0-25)
    const tBodyAreas = bodyAreas.filter(ba => tBookings.some(b => b.id === ba.booking_id));
    const avgPain = tBodyAreas.length > 0 ? tBodyAreas.reduce((s, a) => s + (a.pain_intensity || 0), 0) / tBodyAreas.length : 5;
    const highRiskHandled = tBodyAreas.filter(a => (a.pain_intensity || 0) >= 8).length;
    const painReductionRate = avgPain < 5 ? 1 : avgPain < 7 ? 0.7 : 0.4;
    const clinicalScore = Math.min(25, (painReductionRate * 15) + Math.min(10, highRiskHandled * 2));

    // Client Metrics (0-25)
    const uniqueClients = new Set(tBookings.map(b => b.id)).size; // simplified
    const repeatBookings = Math.max(0, tBookings.length - uniqueClients);
    const repeatRatio = tBookings.length > 0 ? repeatBookings / tBookings.length : 0;
    const noShowPenalty = cancelled.length * 2;
    const clientScore = Math.min(25, (repeatRatio * 20) + 5 - Math.min(5, noShowPenalty));

    // Operational (0-25)
    const tAssignments = assignments.filter(a => a.therapist_id === t.id);
    const assignmentConsistency = tAssignments.length > 0 ? tAssignments.filter(a => a.status === "active").length / tAssignments.length : 0.5;
    const cancellationRate = recent.length > 0 ? cancelled.length / recent.length : 0;
    const operationalScore = Math.min(25, (assignmentConsistency * 15) + ((1 - cancellationRate) * 10));

    const totalScore = Math.round(Math.max(0, Math.min(100, revenueScore + clinicalScore + clientScore + operationalScore)));

    // Trend: compare last month vs previous 2 months
    const lastMonthPaid = lastMonth.filter(b => b.payment_status === "paid");
    const lastMonthRev = lastMonthPaid.reduce((s, b) => s + Number(b.total_amount), 0);
    const prevRev = revenue - lastMonthRev;
    const prevMonths = 2;
    const prevAvg = prevMonths > 0 ? prevRev / prevMonths : 0;
    const growth = prevAvg > 0 ? ((lastMonthRev - prevAvg) / prevAvg * 100) : 0;

    const gym = gyms.find(g => g.id === t.gym_id);

    return {
      id: t.id,
      name: t.name,
      gym_name: gym?.name || "Unassigned",
      profession: t.profession,
      total_score: totalScore,
      revenue_score: Math.round(revenueScore),
      clinical_score: Math.round(clinicalScore),
      client_score: Math.round(clientScore),
      operational_score: Math.round(operationalScore),
      revenue_3m: Math.round(revenue),
      sessions_3m: completed.length,
      cancellation_rate: Number((cancellationRate * 100).toFixed(1)),
      growth_pct: Number(growth.toFixed(1)),
      trend: growth > 5 ? "rising" : growth < -5 ? "declining" : "stable",
      risk_flag: totalScore < 40 || growth < -15,
    };
  }).sort((a, b) => b.total_score - a.total_score);
}

// ── Bonus Engine ──
function computeBonuses(scores: ReturnType<typeof computeTherapistScores>, gyms: GymRow[], bookings: BookingRow[]) {
  const bonusRules = [
    { name: "High Performer Bonus", condition: (s: any) => s.total_score > 85, bonus_pct: 5 },
    { name: "Top 3 Monthly", condition: (_: any, rank: number) => rank < 3, bonus_pct: 3 },
    { name: "Clinical Excellence", condition: (s: any) => s.clinical_score >= 22, bonus_pct: 2 },
  ];

  return scores.map((s, idx) => {
    const appliedBonuses: { rule: string; bonus_pct: number; bonus_amount: number }[] = [];
    let totalBonusPct = 0;

    bonusRules.forEach(rule => {
      if (rule.condition(s, idx)) {
        const bonusAmount = Math.round(s.revenue_3m * (rule.bonus_pct / 100));
        appliedBonuses.push({ rule: rule.name, bonus_pct: rule.bonus_pct, bonus_amount: bonusAmount });
        totalBonusPct += rule.bonus_pct;
      }
    });

    const totalBonus = appliedBonuses.reduce((sum, b) => sum + b.bonus_amount, 0);

    return {
      therapist_id: s.id,
      therapist_name: s.name,
      total_score: s.total_score,
      revenue_3m: s.revenue_3m,
      applied_bonuses: appliedBonuses,
      total_bonus_pct: totalBonusPct,
      total_bonus_amount: totalBonus,
      net_payout: s.revenue_3m + totalBonus,
    };
  });
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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
    const { data: isSuperAdmin } = await supabaseClient.rpc("has_role", { _user_id: user.id, _role: "super_admin" });
    if (!isAdmin && !isSuperAdmin) throw new Error("Unauthorized: admin or super_admin role required");

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { section, country_id } = body; // "demand" | "revenue" | "scores" | "bonuses" | "all"

    if (!country_id) throw new Error("country_id is required");

    // Fetch gyms + hotels for this country (treat both as venues)
    const { data: countryGyms } = await serviceClient
      .from("gyms")
      .select("id, name, commission_percentage, is_active")
      .eq("country_id", country_id);
    const { data: countryHotels } = await serviceClient
      .from("hotels")
      .select("id, name, commission_percentage, is_active")
      .eq("country_id", country_id);

    const gymList: GymRow[] = (countryGyms || []).map((g: any) => ({ ...g, venue_type: "gym" as const }));
    const hotelList: GymRow[] = (countryHotels || []).map((h: any) => ({ ...h, venue_type: "hotel" as const }));
    const gyms: GymRow[] = [...gymList, ...hotelList];
    const gymIds = gymList.map((g) => g.id);
    const hotelIds = hotelList.map((h) => h.id);

    let bookings: BookingRow[] = [];
    let therapists: TherapistRow[] = [];
    let bodyAreas: BodyAreaRow[] = [];
    let assignments: AssignmentRow[] = [];

    if (gymIds.length > 0 || hotelIds.length > 0) {
      const oneYearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split("T")[0];
      const orParts: string[] = [];
      if (gymIds.length > 0) orParts.push(`gym_id.in.(${gymIds.join(",")})`);
      if (hotelIds.length > 0) orParts.push(`hotel_id.in.(${hotelIds.join(",")})`);
      const [bookingsRes, therapistsRes, bodyAreasRes, assignmentsRes] = await Promise.all([
        serviceClient.from("bookings").select("id, booking_date, booking_time, status, payment_status, total_amount, therapist_id, gym_id, hotel_id, service_id, created_at").or(orParts.join(",")).gte("booking_date", oneYearAgo).order("booking_date", { ascending: false }).limit(5000),
        gymIds.length > 0
          ? serviceClient.from("therapists").select("id, name, is_available, gym_id, rating, profession").in("gym_id", gymIds)
          : Promise.resolve({ data: [] as any[] }),
        serviceClient.from("booking_body_areas").select("booking_id, area_code, pain_intensity, is_focus"),
        gymIds.length > 0
          ? serviceClient.from("therapist_assignments").select("therapist_id, gym_id, assignment_date, status").in("gym_id", gymIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      bookings = (bookingsRes.data || []) as BookingRow[];
      // Annotate venue_id for downstream computations
      bookings = bookings.map((b) => ({
        ...b,
        venue_id: b.hotel_id || b.gym_id || undefined,
        venue_type: b.hotel_id ? "hotel" : "gym",
      }));
      therapists = (therapistsRes.data || []) as TherapistRow[];
      bodyAreas = (bodyAreasRes.data || []) as BodyAreaRow[];
      assignments = (assignmentsRes.data || []) as AssignmentRow[];

      // Filter body areas to only include those from country bookings
      const bookingIds = new Set(bookings.map((b) => b.id));
      bodyAreas = bodyAreas.filter((ba) => bookingIds.has(ba.booking_id));
    }

    const result: Record<string, unknown> = {};

    if (section === "demand" || section === "all") {
      result.demand = computeDemandPrediction(bookings, gyms);
    }
    if (section === "revenue" || section === "all") {
      result.revenue = computeRevenueProjection(bookings, gyms, therapists);
    }
    if (section === "scores" || section === "all") {
      result.scores = computeTherapistScores(bookings, therapists, gyms, bodyAreas, assignments);
    }
    if (section === "bonuses" || section === "all") {
      const scores = computeTherapistScores(bookings, therapists, gyms, bodyAreas, assignments);
      result.bonuses = computeBonuses(scores, gyms, bookings);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("business-intelligence error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
