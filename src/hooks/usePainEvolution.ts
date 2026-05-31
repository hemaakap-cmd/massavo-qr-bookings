import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PainDataPoint {
  date: string;
  bookingId: string;
  serviceName: string;
  therapistName: string;
  gymName: string;
  areas: {
    code: string;
    label: string;
    side: string;
    painIntensity: number;
    isFocus: boolean;
  }[];
}

export interface PainTrend {
  areaCode: string;
  areaLabel: string;
  firstValue: number;
  latestValue: number;
  direction: "improving" | "stable" | "worsening";
  avgPain: number;
  sessionCount: number;
  isHighRisk: boolean;
  isChronic: boolean;
}

export function usePainEvolution(customerEmail: string | null, filters?: {
  areaCode?: string;
  dateFrom?: string;
  dateTo?: string;
  therapistId?: string;
  gymId?: string;
}) {
  return useQuery({
    queryKey: ["pain-evolution", customerEmail, filters],
    enabled: !!customerEmail,
    queryFn: async () => {
      let bookingQuery = supabase
        .from("bookings")
        .select("id, booking_date, booking_time, customer_email, gym_id, therapist_id, gyms(name), services(name), therapists(name)")
        .eq("customer_email", customerEmail!)
        .order("booking_date", { ascending: true });

      if (filters?.gymId) bookingQuery = bookingQuery.eq("gym_id", filters.gymId);
      if (filters?.therapistId) bookingQuery = bookingQuery.eq("therapist_id", filters.therapistId);
      if (filters?.dateFrom) bookingQuery = bookingQuery.gte("booking_date", filters.dateFrom);
      if (filters?.dateTo) bookingQuery = bookingQuery.lte("booking_date", filters.dateTo);

      const { data: bookings, error: bErr } = await bookingQuery;
      if (bErr) throw bErr;
      if (!bookings?.length) return { dataPoints: [], trends: [] };

      const bookingIds = bookings.map(b => b.id);
      let areasQuery = supabase
        .from("booking_body_areas")
        .select("*")
        .in("booking_id", bookingIds);

      if (filters?.areaCode) areasQuery = areasQuery.eq("area_code", filters.areaCode);

      const { data: areas, error: aErr } = await areasQuery;
      if (aErr) throw aErr;

      const dataPoints: PainDataPoint[] = bookings
        .filter(b => (areas || []).some(a => a.booking_id === b.id))
        .map(b => ({
          date: b.booking_date,
          bookingId: b.id,
          serviceName: (b.services as any)?.name || "",
          therapistName: (b.therapists as any)?.name || "",
          gymName: (b.gyms as any)?.name || "",
          areas: (areas || [])
            .filter(a => a.booking_id === b.id)
            .map(a => ({
              code: a.area_code,
              label: a.area_label,
              side: a.side || "front",
              painIntensity: a.pain_intensity || 0,
              isFocus: a.is_focus || false,
            })),
        }));

      // Calculate trends per area
      const areaMap = new Map<string, { label: string; values: number[] }>();
      dataPoints.forEach(dp => {
        dp.areas.forEach(a => {
          if (!areaMap.has(a.code)) areaMap.set(a.code, { label: a.label, values: [] });
          areaMap.get(a.code)!.values.push(a.painIntensity);
        });
      });

      const trends: PainTrend[] = Array.from(areaMap.entries()).map(([code, { label, values }]) => {
        const first = values[0];
        const latest = values[values.length - 1];
        const avg = values.reduce((s, v) => s + v, 0) / values.length;
        const diff = latest - first;
        const direction: PainTrend["direction"] =
          diff <= -1 ? "improving" : diff >= 1 ? "worsening" : "stable";

        // Chronic: 3+ sessions with no improvement
        const last3 = values.slice(-3);
        const isChronic = values.length >= 3 && last3.every(v => v >= first);

        return {
          areaCode: code,
          areaLabel: label,
          firstValue: first,
          latestValue: latest,
          direction,
          avgPain: Math.round(avg * 10) / 10,
          sessionCount: values.length,
          isHighRisk: latest >= 8,
          isChronic,
        };
      });

      return { dataPoints, trends };
    },
  });
}
