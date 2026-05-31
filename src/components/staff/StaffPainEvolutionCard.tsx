import { usePainEvolution } from "@/hooks/usePainEvolution";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

function getIntensityColor(intensity: number): string {
  if (intensity <= 3) return "hsl(142, 71%, 45%)";
  if (intensity <= 6) return "hsl(45, 93%, 47%)";
  if (intensity <= 8) return "hsl(25, 95%, 53%)";
  return "hsl(0, 84%, 60%)";
}

function MiniChart({ values }: { values: number[] }) {
  const max = 10;
  const pts = values.slice(-8);
  if (pts.length < 2) return null;
  
  const width = 120;
  const height = 40;
  const stepX = width / (pts.length - 1);
  
  const pathD = pts
    .map((v, i) => `${i === 0 ? "M" : "L"} ${i * stepX} ${height - (v / max) * height}`)
    .join(" ");

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <path d={pathD} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((v, i) => (
        <circle
          key={i}
          cx={i * stepX}
          cy={height - (v / max) * height}
          r={2.5}
          fill={getIntensityColor(v)}
          stroke="white"
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}

interface Props {
  customerEmail: string;
}

export function StaffPainEvolutionCard({ customerEmail }: Props) {
  const { t } = useTranslation();
  const { data: evolution, isLoading } = usePainEvolution(customerEmail);
  
  const { dataPoints = [], trends = [] } = evolution || {};
  
  if (isLoading || dataPoints.length < 2 || trends.length === 0) return null;

  // Show top trend (most sessions or most improved)
  const topTrend = [...trends].sort((a, b) => b.sessionCount - a.sessionCount)[0];
  if (!topTrend) return null;

  const changePercent = topTrend.firstValue > 0
    ? Math.round(((topTrend.latestValue - topTrend.firstValue) / topTrend.firstValue) * 100)
    : 0;

  const chartValues = dataPoints
    .map(dp => dp.areas.find(a => a.code === topTrend.areaCode)?.painIntensity)
    .filter((v): v is number => v !== undefined);

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("staff.pain.title")}</h3>
            <p className="text-[11px] text-muted-foreground">
              {topTrend.areaLabel} · {topTrend.sessionCount} {t("staff.pain.sessions")}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <MiniChart values={chartValues} />
          {changePercent !== 0 && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs gap-1",
                changePercent < 0
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                  : "bg-destructive/10 text-destructive border-destructive/20"
              )}
            >
              {changePercent < 0 ? (
                <TrendingDown className="w-3.5 h-3.5" />
              ) : (
                <TrendingUp className="w-3.5 h-3.5" />
              )}
              {changePercent > 0 ? "+" : ""}{changePercent}%
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between text-xs border-t border-border/40 pt-3">
          <div className="text-muted-foreground">
            {t("staff.pain.intensity")}:{" "}
            <span className="font-mono font-bold" style={{ color: getIntensityColor(topTrend.firstValue) }}>
              {topTrend.firstValue}
            </span>
            {" → "}
            <span className="font-mono font-bold" style={{ color: getIntensityColor(topTrend.latestValue) }}>
              {topTrend.latestValue}
            </span>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] gap-1",
              topTrend.direction === "improving"
                ? "text-emerald-600 border-emerald-500/20"
                : topTrend.direction === "worsening"
                ? "text-destructive border-destructive/20"
                : "text-muted-foreground border-border"
            )}
          >
            {topTrend.direction === "improving" ? (
              <TrendingDown className="w-3 h-3" />
            ) : topTrend.direction === "worsening" ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
            {topTrend.direction === "improving"
              ? t("staff.pain.improving")
              : topTrend.direction === "worsening"
              ? t("staff.pain.worsening")
              : t("staff.pain.stable")}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}