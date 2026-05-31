import { useState, useMemo } from "react";
import { useBodyAreaHistory } from "@/hooks/useBodyAreas";
import { usePainEvolution } from "@/hooks/usePainEvolution";
import { BodyDiagram, SelectedArea } from "@/components/body-diagram/BodyDiagram";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity, TrendingDown, TrendingUp, Minus, AlertTriangle,
  Layers, ArrowLeftRight, Zap, Shield, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SmartRecoveryProfileProps {
  bookingId: string;
  customerEmail: string;
  currentAreas: SelectedArea[];
  clientGender?: "male" | "female" | null;
  compact?: boolean;
}

function getIntensityColor(intensity: number): string {
  if (intensity <= 3) return "hsl(142, 71%, 45%)";
  if (intensity <= 6) return "hsl(45, 93%, 47%)";
  if (intensity <= 8) return "hsl(25, 95%, 53%)";
  return "hsl(0, 84%, 60%)";
}

function TrendIcon({ direction }: { direction: string }) {
  if (direction === "improving") return <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />;
  if (direction === "worsening") return <TrendingUp className="w-3.5 h-3.5 text-destructive" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
}

function TrendBadge({ direction }: { direction: string }) {
  const config = {
    improving: { label: "Improving", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    worsening: { label: "Worsening", className: "bg-destructive/10 text-destructive border-destructive/20" },
    stable: { label: "Stable", className: "bg-muted text-muted-foreground border-border" },
  };
  const c = config[direction as keyof typeof config] || config.stable;
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 gap-0.5", c.className)}>
      <TrendIcon direction={direction} />
      {c.label}
    </Badge>
  );
}

/** Session comparison: last vs current */
function SessionComparison({ previousAreas, currentAreas }: {
  previousAreas: { code: string; label: string; painIntensity: number; isFocus: boolean }[];
  currentAreas: SelectedArea[];
}) {
  const allCodes = new Set([
    ...previousAreas.map(a => a.code),
    ...currentAreas.map(a => a.code),
  ]);

  if (allCodes.size === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
        <ArrowLeftRight className="w-3.5 h-3.5" />
        <span className="font-medium uppercase tracking-wider">Last Session → Current</span>
      </div>
      <div className="space-y-1.5">
        {Array.from(allCodes).map(code => {
          const prev = previousAreas.find(a => a.code === code);
          const curr = currentAreas.find(a => a.code === code);
          const diff = (curr?.painIntensity || 0) - (prev?.painIntensity || 0);
          const label = prev?.label || curr?.label || code;

          return (
            <div key={code} className="flex items-center gap-2 text-xs">
              <span className="min-w-[90px] text-foreground font-medium truncate">{label}</span>
              <div className="flex items-center gap-1.5 flex-1">
                {prev ? (
                  <span className="w-6 text-center font-mono font-bold" style={{ color: getIntensityColor(prev.painIntensity) }}>
                    {prev.painIntensity}
                  </span>
                ) : (
                  <span className="w-6 text-center text-muted-foreground">—</span>
                )}
                <span className="text-muted-foreground">→</span>
                {curr ? (
                  <span className="w-6 text-center font-mono font-bold" style={{ color: getIntensityColor(curr.painIntensity) }}>
                    {curr.painIntensity}
                  </span>
                ) : (
                  <span className="w-6 text-center text-muted-foreground">—</span>
                )}
                {prev && curr && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] px-1 py-0 h-4 ml-1",
                      diff < 0 ? "text-emerald-600 border-emerald-500/20" :
                      diff > 0 ? "text-destructive border-destructive/20" :
                      "text-muted-foreground border-border"
                    )}
                  >
                    {diff > 0 ? `+${diff}` : diff === 0 ? "=" : diff}
                  </Badge>
                )}
                {!prev && curr && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 ml-1 text-blue-600 border-blue-500/20">NEW</Badge>
                )}
                {prev && !curr && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 ml-1 text-muted-foreground border-border">GONE</Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Inline mini heatmap bar chart */
function MiniTrendChart({ values }: { values: number[] }) {
  const max = 10;
  return (
    <div className="flex items-end gap-px h-6">
      {values.slice(-8).map((v, i) => (
        <div
          key={i}
          className="w-2 rounded-t-sm transition-all"
          style={{
            height: `${(v / max) * 100}%`,
            backgroundColor: getIntensityColor(v),
            opacity: 0.7 + (i / values.length) * 0.3,
          }}
        />
      ))}
    </div>
  );
}

export function SmartRecoveryProfile({
  bookingId,
  customerEmail,
  currentAreas,
  clientGender,
  compact = false,
}: SmartRecoveryProfileProps) {
  const [expanded, setExpanded] = useState(!compact);

  const { data: history } = useBodyAreaHistory(customerEmail, bookingId);
  const { data: evolution } = usePainEvolution(customerEmail);

  const { dataPoints = [], trends = [] } = evolution || {};
  const sessionCount = dataPoints.length;

  // Previous session areas (the one right before current)
  const previousSession = useMemo(() => {
    if (!history || history.length < 2) return null;
    const sorted = history.filter(h => !h.isCurrent).sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0] || null;
  }, [history]);

  // Summary stats
  const improvingCount = trends.filter(t => t.direction === "improving").length;
  const worseningCount = trends.filter(t => t.direction === "worsening").length;
  const highRiskCount = trends.filter(t => t.isHighRisk).length;
  const chronicCount = trends.filter(t => t.isChronic).length;

  // Find the latest session with areas from history (fallback when current is empty)
  const latestSessionWithAreas = useMemo(() => {
    if (!history) return null;
    const sorted = history
      .filter(h => !h.isCurrent && h.areas.length > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0] || null;
  }, [history]);

  const hasAnyData = currentAreas.length > 0 || sessionCount > 0 || (history && history.some(h => h.areas.length > 0));

  if (!hasAnyData) {
    return (
      <Card className="border-dashed border-border/50">
        <CardContent className="py-8 text-center">
          <Shield className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No recovery profile data yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-border/60">
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-5 py-3 bg-gradient-to-r from-primary/5 to-transparent cursor-pointer",
          compact && "py-2"
        )}
        onClick={() => compact && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Smart Recovery Profile</h3>
            {sessionCount > 0 && (
              <p className="text-[11px] text-muted-foreground">{sessionCount} session{sessionCount !== 1 ? "s" : ""} tracked</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Quick stat badges */}
          {improvingCount > 0 && (
            <Badge variant="outline" className="text-[10px] bg-emerald-500/5 text-emerald-600 border-emerald-500/20 gap-0.5">
              <TrendingDown className="w-3 h-3" /> {improvingCount}
            </Badge>
          )}
          {worseningCount > 0 && (
            <Badge variant="outline" className="text-[10px] bg-destructive/5 text-destructive border-destructive/20 gap-0.5">
              <TrendingUp className="w-3 h-3" /> {worseningCount}
            </Badge>
          )}
          {highRiskCount > 0 && (
            <Badge variant="destructive" className="text-[10px] gap-0.5">
              <Zap className="w-3 h-3" /> {highRiskCount} High
            </Badge>
          )}
          {chronicCount > 0 && (
            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 gap-0.5">
              <AlertTriangle className="w-3 h-3" /> {chronicCount} Chronic
            </Badge>
          )}
          {compact && (expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />)}
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <CardContent className="p-0">
          <Tabs defaultValue="current" className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent h-9 px-5">
              <TabsTrigger value="current" className="text-xs data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                Current Session
              </TabsTrigger>
              <TabsTrigger value="trends" className="text-xs data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                Trends
              </TabsTrigger>
              {previousSession && (
                <TabsTrigger value="compare" className="text-xs data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                  <ArrowLeftRight className="w-3 h-3 mr-1" /> Compare
                </TabsTrigger>
              )}
            </TabsList>

            {/* Current Session Tab */}
            <TabsContent value="current" className="p-5 pt-4 m-0">
              {currentAreas.length > 0 ? (
                <BodyDiagram selectedAreas={currentAreas} readOnly heatmapMode clientGender={clientGender} />
              ) : latestSessionWithAreas ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="text-xs text-amber-700">
                      No areas marked for this session — showing last session ({latestSessionWithAreas.date}) as reference
                    </span>
                  </div>
                  <BodyDiagram
                    selectedAreas={latestSessionWithAreas.areas.map(a => ({
                      ...a,
                      side: a.side as "front" | "back",
                    }))}
                    readOnly
                    heatmapMode
                    clientGender={clientGender}
                  />
                </div>
              ) : (
                <div className="text-center py-8">
                  <Shield className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No body areas marked yet</p>
                </div>
              )}
            </TabsContent>

            {/* Trends Tab */}
            <TabsContent value="trends" className="p-5 pt-4 m-0 space-y-4">
              {trends.length > 0 ? (
                <div className="space-y-2.5">
                  {trends.map(t => (
                    <div key={t.areaCode} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 bg-card hover:bg-muted/20 transition-colors">
                      <TrendIcon direction={t.direction} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{t.areaLabel}</span>
                          <TrendBadge direction={t.direction} />
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                          <span>
                            <span className="font-mono font-bold" style={{ color: getIntensityColor(t.firstValue) }}>{t.firstValue}</span>
                            {" → "}
                            <span className="font-mono font-bold" style={{ color: getIntensityColor(t.latestValue) }}>{t.latestValue}</span>
                          </span>
                          <span>Avg: {t.avgPain}</span>
                          <span>{t.sessionCount} sessions</span>
                        </div>
                      </div>
                      <MiniTrendChart values={
                        dataPoints
                          .map(dp => dp.areas.find(a => a.code === t.areaCode)?.painIntensity)
                          .filter((v): v is number => v !== undefined)
                      } />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Layers className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Need at least 2 sessions for trends</p>
                </div>
              )}
            </TabsContent>

            {/* Compare Tab */}
            {previousSession && (
              <TabsContent value="compare" className="p-5 pt-4 m-0">
                <SessionComparison
                  previousAreas={previousSession.areas}
                  currentAreas={currentAreas}
                />
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}
