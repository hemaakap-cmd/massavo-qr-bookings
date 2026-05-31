import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const ANALYTICS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/therapist-analytics`;

interface TherapistDetail {
  id: string;
  name: string;
  profession: string;
  is_available: boolean;
  rating: number;
  gym_name: string;
  total_bookings_30d: number;
  confirmed_bookings: number;
  cancelled_bookings: number;
  cancellation_rate: string;
  revenue_30d: number;
  today_bookings: number;
  active_days: number;
  avg_bookings_per_day: string;
}

interface AnalyticsData {
  summary: {
    total_therapists: number;
    available_therapists: number;
    unavailable_therapists: number;
    total_bookings_30d: number;
    total_revenue_30d: number;
    avg_bookings_per_therapist: string;
  };
  workload: {
    overloaded: { name: string; bookings: number }[];
    underloaded: { name: string; bookings: number }[];
    balanced_count: number;
  };
  therapist_details: TherapistDetail[];
}

export function useTherapistAnalytics(countryId?: string | null) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [aiInsight, setAiInsight] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!countryId) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const resp = await fetch(ANALYTICS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ mode: "data-only", country_id: countryId }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${resp.status})`);
      }
      const result = await resp.json();
      setData(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [countryId]);

  const fetchAiInsight = useCallback(async () => {
    if (!countryId) {
      setAiInsight("⚠️ Error: Country is not selected");
      return;
    }

    setAiLoading(true);
    setAiInsight("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const resp = await fetch(ANALYTICS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ mode: "ai-analysis", country_id: countryId }),
      });
      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${resp.status})`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              accumulated += content;
              setAiInsight(accumulated);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e: any) {
      setAiInsight(`⚠️ Error: ${e.message}`);
    } finally {
      setAiLoading(false);
    }
  }, [countryId]);

  return { data, aiInsight, loading, aiLoading, error, fetchData, fetchAiInsight };
}
