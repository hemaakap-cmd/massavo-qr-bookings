import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, TrendingUp, AlertTriangle, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCountryData } from "@/hooks/useCountry";

const ANALYTICS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/therapist-analytics`;

interface QuickInsight {
  total_therapists: number;
  available_therapists: number;
  total_bookings_30d: number;
  overloaded_count: number;
  underloaded_count: number;
}

export function TherapistAIInsights() {
  const { countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);
  const [insight, setInsight] = useState<QuickInsight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsight = async () => {
      if (!selectedCountry?.id) {
        setInsight(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const resp = await fetch(ANALYTICS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ mode: "data-only", country_id: selectedCountry.id }),
        });
        if (!resp.ok) return;
        const data = await resp.json();
        setInsight({
          total_therapists: data.summary.total_therapists,
          available_therapists: data.summary.available_therapists,
          total_bookings_30d: data.summary.total_bookings_30d,
          overloaded_count: data.workload.overloaded.length,
          underloaded_count: data.workload.underloaded.length,
        });
      } catch {
        // Silently fail for inline widget
      } finally {
        setLoading(false);
      }
    };

    void fetchInsight();
  }, [selectedCountry?.id]);

  if (loading) {
    return (
      <Card className="border-primary/20">
        <CardContent className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading AI insights...
        </CardContent>
      </Card>
    );
  }

  if (!insight) return null;

  const hasAlerts = insight.overloaded_count > 0 || insight.underloaded_count > 0;

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          AI Insights (30 days)
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <span className="text-foreground font-medium">{insight.total_bookings_30d}</span>
            <span className="text-muted-foreground">bookings</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-foreground font-medium">
              {insight.available_therapists}/{insight.total_therapists}
            </span>
            <span className="text-muted-foreground">available</span>
          </div>
          {hasAlerts && (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-warning" />
              {insight.overloaded_count > 0 && (
                <Badge variant="destructive" className="text-[10px] py-0">
                  {insight.overloaded_count} overloaded
                </Badge>
              )}
              {insight.underloaded_count > 0 && (
                <Badge variant="secondary" className="text-[10px] py-0">
                  {insight.underloaded_count} underloaded
                </Badge>
              )}
            </div>
          )}
          <Button variant="ghost" size="sm" className="ml-auto text-xs h-7" asChild>
            <Link to="/admin/therapist-analytics">Full Analysis →</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
