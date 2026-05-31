import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, TrendingUp, MessageSquare, Award, Zap, Calendar, Users, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const STAR_THRESHOLDS = [
  { stars: 0.5, points: 50 },
  { stars: 1.0, points: 120 },
  { stars: 1.5, points: 200 },
  { stars: 2.0, points: 300 },
  { stars: 2.5, points: 420 },
  { stars: 3.0, points: 560 },
  { stars: 3.5, points: 720 },
  { stars: 4.0, points: 900 },
  { stars: 4.5, points: 1100 },
  { stars: 5.0, points: 1350 },
  { stars: 5.5, points: 1650 },
  { stars: 6.0, points: 2000 },
];

function getNextThreshold(currentScore: number) {
  for (const t of STAR_THRESHOLDS) {
    if (currentScore < t.points) return t;
  }
  return null;
}

export function StaffPerformanceCard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["staff-performance-v2", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: therapist, error: tErr } = await supabase
        .from("therapists")
        .select("id, name, rating, score")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (tErr) throw tErr;
      if (!therapist) return null;

      const { data: scoreData, error: sErr } = await supabase
        .rpc("calculate_therapist_score", { p_therapist_id: therapist.id });
      if (sErr) throw sErr;

      const score = scoreData?.[0] ?? {
        total_score: therapist.score || 0,
        star_rating: therapist.rating || 0,
        review_points: 0,
        session_points: 0,
        experience_points: 0,
        retention_points: 0,
      };

      const { data: feedback } = await (supabase as any)
        .from("booking_feedback")
        .select("therapist_rating, comment, customer_first_name, submitted_at")
        .eq("therapist_id", therapist.id)
        .eq("is_submitted", true)
        .order("submitted_at", { ascending: false })
        .limit(3);

      const recentComments = (feedback || []).filter(
        (f: any) => f.comment && f.comment.trim().length > 0
      );

      const { count } = await supabase
        .from("booking_feedback")
        .select("id", { count: "exact", head: true })
        .eq("therapist_id", therapist.id)
        .eq("is_submitted", true)
        .eq("is_flagged", false)
        .not("therapist_rating", "is", null);

      return {
        name: therapist.name,
        totalScore: score.total_score,
        starRating: score.star_rating,
        reviewPoints: score.review_points,
        sessionPoints: score.session_points,
        experiencePoints: score.experience_points,
        retentionPoints: score.retention_points,
        totalReviews: count || 0,
        recentComments,
      };
    },
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="border-primary/20">
        <CardContent className="p-4">
          <Skeleton className="h-16 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const nextThreshold = getNextThreshold(data.totalScore);
  const currentThresholdIdx = STAR_THRESHOLDS.findIndex(t => t.points > data.totalScore);
  const prevThreshold = currentThresholdIdx > 0 ? STAR_THRESHOLDS[currentThresholdIdx - 1] : null;
  const fromPoints = prevThreshold?.points ?? 0;
  const progressInRange = nextThreshold
    ? Math.min(((data.totalScore - fromPoints) / (nextThreshold.points - fromPoints)) * 100, 100)
    : 100;

  return (
    <div className="space-y-3">
      <Card
        className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
        onClick={() => setExpanded(!expanded)}
      >
        <CardContent className="p-4">
          {/* Collapsed: compact summary row */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-black tabular-nums text-foreground">
                {Number(data.starRating).toFixed(1)}
              </span>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5, 6].map(i => {
                  const filled = i <= Math.floor(Number(data.starRating));
                  const half = !filled && i - 0.5 <= Number(data.starRating);
                  return (
                    <Star
                      key={i}
                      className={`w-2.5 h-2.5 ${
                        filled ? "text-amber-400 fill-amber-400"
                          : half ? "text-amber-400 fill-amber-400/50"
                          : "text-muted-foreground/20"
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              {nextThreshold ? (
                <div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-amber-400 transition-all duration-700"
                      style={{ width: `${progressInRange}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {data.totalScore}/{nextThreshold.points} → {nextThreshold.stars}★
                  </p>
                </div>
              ) : (
                <span className="text-[10px] font-bold text-amber-500">🏆 {t("staff.performance.max")}</span>
              )}
            </div>

            <div className="bg-accent/10 border border-accent/20 rounded-full px-2.5 py-0.5 shrink-0">
              <span className="text-xs font-bold text-accent tabular-nums">{data.totalScore} {t("staff.performance.points")}</span>
            </div>

            <ChevronDown className={cn(
              "w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0",
              expanded && "rotate-180"
            )} />
          </div>

          {/* Expanded: full details */}
          <div className={cn(
            "grid transition-all duration-300 ease-in-out",
            expanded ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0 mt-0"
          )}>
            <div className="overflow-hidden">
              {/* Score breakdown */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <ScoreFactor icon={MessageSquare} value={data.reviewPoints} label={t("staff.performance.ratings")} color="text-primary" />
                <ScoreFactor icon={Zap} value={data.sessionPoints} label={t("staff.performance.sessions")} color="text-accent" />
                <ScoreFactor icon={Calendar} value={data.experiencePoints} label={t("staff.performance.experience")} color="text-primary" />
                <ScoreFactor icon={Users} value={data.retentionPoints} label={t("staff.performance.regulars")} color="text-accent" />
              </div>

              {/* How points work */}
              <div className="pt-3 border-t border-border/50">
                <h4 className="text-[11px] font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3 text-primary" />
                  {t("staff.performance.howToEarn")}
                </h4>
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <PointRule label={t("staff.performance.fiveStarReview")} value="+10" positive />
                  <PointRule label={t("staff.performance.fourStarReview")} value="+5" positive />
                  <PointRule label={t("staff.performance.session")} value="+3" positive />
                  <PointRule label={t("staff.performance.regularClient")} value="+12" positive />
                  <PointRule label={t("staff.performance.perMonth")} value="+8" positive />
                  <PointRule label={t("staff.performance.oneStarReview")} value="-10" positive={false} />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent comments - only when expanded */}
      {expanded && data.recentComments.length > 0 && (
        <Card className="border-border/50 animate-in fade-in slide-in-from-top-2 duration-200">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              <h4 className="text-xs font-semibold text-foreground">{t("staff.performance.recentComments")}</h4>
            </div>
            {data.recentComments.map((c: any, i: number) => (
              <div key={i} className="bg-muted/50 rounded-lg p-2.5 text-sm">
                <p className="text-foreground/80 italic leading-relaxed text-xs">"{c.comment}"</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  — {c.customer_first_name || t("staff.performance.customer")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScoreFactor({ icon: Icon, value, label, color }: { icon: any; value: number; label: string; color: string }) {
  return (
    <div className="bg-background/60 rounded-lg p-2 text-center border border-border/30">
      <Icon className={`w-3 h-3 ${color} mx-auto mb-0.5`} />
      <span className="text-sm font-bold text-foreground block tabular-nums">
        {value >= 0 ? `+${value}` : value}
      </span>
      <span className="text-[9px] text-muted-foreground leading-tight">{label}</span>
    </div>
  );
}

function PointRule({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div className="bg-muted/50 rounded-md px-2 py-1.5 flex items-center justify-between">
      <span className="font-medium text-foreground">{label}</span>
      <span className={positive ? "text-accent font-semibold" : "text-destructive font-semibold"}>{value}</span>
    </div>
  );
}
