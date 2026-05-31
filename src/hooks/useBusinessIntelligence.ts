import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const BI_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/business-intelligence`;

export interface DemandPrediction {
  dow_average: Record<string, number>;
  hour_density: { hour: string; density: number; count: number }[];
  seasonal_factors: { month: string; factor: number; bookings: number; revenue: number }[];
  cancellation_rate: number;
  gym_demand: { gym_id: string; gym_name: string; total_bookings_6m: number; daily_average: number; monthly_average: number }[];
  predictions: { date: string; dow: string; predicted_bookings: number; gym_breakdown: { gym_id: string; predicted: number }[] }[];
  staffing_recommendations: { date: string; predicted_demand: number; therapists_needed: number }[];
  peak_hours_predicted: string[];
}

export interface RevenueProjection {
  monthly_history: { month: string; revenue: number; bookings: number }[];
  weighted_moving_average: number;
  growth_momentum: number;
  gym_profitability: { gym_id: string; name: string; revenue: number; commission: number; net: number; bookings: number }[];
  projections: { month: string; conservative: number; expected: number; aggressive: number }[];
  profit_margin: number;
  confidence_range: { min: number; max: number };
}

export interface TherapistScore {
  id: string;
  name: string;
  gym_name: string;
  profession: string;
  total_score: number;
  revenue_score: number;
  clinical_score: number;
  client_score: number;
  operational_score: number;
  revenue_3m: number;
  sessions_3m: number;
  cancellation_rate: number;
  growth_pct: number;
  trend: "rising" | "stable" | "declining";
  risk_flag: boolean;
}

export interface BonusEntry {
  therapist_id: string;
  therapist_name: string;
  total_score: number;
  revenue_3m: number;
  applied_bonuses: { rule: string; bonus_pct: number; bonus_amount: number }[];
  total_bonus_pct: number;
  total_bonus_amount: number;
  net_payout: number;
}

export interface BIData {
  demand?: DemandPrediction;
  revenue?: RevenueProjection;
  scores?: TherapistScore[];
  bonuses?: BonusEntry[];
}

export function useBusinessIntelligence(countryId?: string | null) {
  const [data, setData] = useState<BIData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSection = useCallback(async (section: "demand" | "revenue" | "scores" | "bonuses" | "all") => {
    if (!countryId) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const resp = await fetch(BI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ section, country_id: countryId }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${resp.status})`);
      }

      const result = await resp.json();
      setData(prev => ({ ...prev, ...result }));
      return result;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [countryId]);

  return { data, loading, error, fetchSection };
}
