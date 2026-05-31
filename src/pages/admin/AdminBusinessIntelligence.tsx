import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCountryData } from "@/hooks/useCountry";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useBusinessIntelligence, type TherapistScore, type BonusEntry, type DemandPrediction, type RevenueProjection } from "@/hooks/useBusinessIntelligence";
import { applyScenario, type ScenarioParams } from "@/utils/forecastEngine";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  TrendingUp, TrendingDown, Minus, Brain, Euro, Users,
  Building2, AlertTriangle, Award, Zap, Download, BarChart3,
  Flame, Target, Shield, Activity,
} from "lucide-react";
import { format } from "date-fns";

const CHART_TOOLTIP = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "11px",
    color: "hsl(var(--foreground))",
  },
};

// ── Demand Tab ──
function DemandTab({ demand }: { demand: DemandPrediction }) {
  const avgDemand = demand.predictions.reduce((s, p) => s + p.predicted_bookings, 0) / demand.predictions.length;
  const peakDay = demand.predictions.reduce((max, p) => p.predicted_bookings > max.predicted_bookings ? p : max, demand.predictions[0]);

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <Brain className="w-4 h-4 text-primary mb-2" />
          <p className="text-xl font-bold text-foreground">{avgDemand.toFixed(0)}</p>
          <p className="text-[11px] text-muted-foreground">Avg Daily Demand</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <Flame className="w-4 h-4 text-destructive mb-2" />
          <p className="text-xl font-bold text-foreground">{peakDay?.predicted_bookings || 0}</p>
          <p className="text-[11px] text-muted-foreground">Peak Day ({peakDay?.dow})</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <AlertTriangle className="w-4 h-4 text-yellow-500 mb-2" />
          <p className="text-xl font-bold text-foreground">{demand.cancellation_rate}%</p>
          <p className="text-[11px] text-muted-foreground">Cancel Rate (6M)</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <Target className="w-4 h-4 text-accent mb-2" />
          <p className="text-xl font-bold text-foreground">{demand.peak_hours_predicted[0] || "—"}</p>
          <p className="text-[11px] text-muted-foreground">Peak Hour</p>
        </CardContent></Card>
      </div>

      {/* 30-Day Demand Forecast */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Predicted Demand (Next 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={demand.predictions}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} className="text-muted-foreground" interval={4}
                  tickFormatter={v => format(new Date(v), "dd MMM")} />
                <YAxis tick={{ fontSize: 9 }} className="text-muted-foreground" allowDecimals={false} />
                <Tooltip {...CHART_TOOLTIP} labelFormatter={v => format(new Date(v as string), "EEE dd MMM")} />
                <Area type="monotone" dataKey="predicted_bookings" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} name="Predicted Bookings" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hour Density */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Booking Hour Density</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={demand.hour_density}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="hour" tick={{ fontSize: 9 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 9 }} className="text-muted-foreground" />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Bar dataKey="count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Bookings" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Seasonal Pattern */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Seasonal Pattern</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={demand.seasonal_factors}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 9 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 9 }} className="text-muted-foreground" />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Bar dataKey="bookings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Bookings" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staffing Alerts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Users className="w-4 h-4" /> Staffing Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
            {demand.staffing_recommendations.slice(0, 14).map(s => (
              <div key={s.date} className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                <span className="text-xs text-foreground">{format(new Date(s.date), "EEE dd MMM")}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{s.predicted_demand} bookings</span>
                  <Badge variant={s.therapists_needed > 3 ? "destructive" : "secondary"} className="text-[10px]">
                    {s.therapists_needed} therapists
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Gym Demand */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Gym Demand Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {demand.gym_demand.map((g, i) => (
              <div key={g.gym_id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                  <span className="text-sm font-medium text-foreground">{g.gym_name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{g.daily_average}/day</span>
                  <span>{g.monthly_average}/month</span>
                  <Badge variant="secondary" className="text-[10px]">{g.total_bookings_6m} total</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Revenue Tab ──
function RevenueTab({ revenue }: { revenue: RevenueProjection }) {
  const [scenario, setScenario] = useState<ScenarioParams>({
    priceChangePct: 0, capacityChangePct: 0, addGyms: 0, removeGymIds: [],
  });
  const adjustedProjections = applyScenario(revenue, scenario);

  // Chart data is constructed inline in the AreaChart below

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <Euro className="w-4 h-4 text-primary mb-2" />
          <p className="text-xl font-bold text-foreground">€{revenue.weighted_moving_average}</p>
          <p className="text-[11px] text-muted-foreground">Monthly Avg (WMA)</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          {revenue.growth_momentum > 0
            ? <TrendingUp className="w-4 h-4 text-green-500 mb-2" />
            : <TrendingDown className="w-4 h-4 text-destructive mb-2" />}
          <p className="text-xl font-bold text-foreground">{revenue.growth_momentum > 0 ? "+" : ""}{revenue.growth_momentum}%</p>
          <p className="text-[11px] text-muted-foreground">Growth Momentum</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <Shield className="w-4 h-4 text-accent mb-2" />
          <p className="text-xl font-bold text-foreground">{revenue.profit_margin}%</p>
          <p className="text-[11px] text-muted-foreground">Profit Margin</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <Activity className="w-4 h-4 text-muted-foreground mb-2" />
          <p className="text-sm font-bold text-foreground">€{revenue.confidence_range.min}–€{revenue.confidence_range.max}</p>
          <p className="text-[11px] text-muted-foreground">Confidence Range</p>
        </CardContent></Card>
      </div>

      {/* Revenue Forecast Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Revenue History & Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[
                ...revenue.monthly_history.map(m => ({ month: m.month.slice(5), actual: m.revenue })),
                ...adjustedProjections.map(p => ({
                  month: p.month.slice(5),
                  conservative: p.conservative,
                  expected: p.expected,
                  aggressive: p.aggressive,
                })),
              ]}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 9 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 9 }} className="text-muted-foreground" tickFormatter={v => `€${v}`} />
                <Tooltip {...CHART_TOOLTIP} formatter={(v: number) => `€${v}`} />
                <Area type="monotone" dataKey="actual" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" strokeWidth={2} name="Actual" />
                <Area type="monotone" dataKey="aggressive" stroke="hsl(142, 71%, 45%)" fill="hsl(142, 71%, 45%, 0.08)" strokeWidth={1} strokeDasharray="4 4" name="Aggressive" />
                <Area type="monotone" dataKey="expected" stroke="hsl(var(--accent))" fill="hsl(var(--accent) / 0.15)" strokeWidth={2} name="Expected" />
                <Area type="monotone" dataKey="conservative" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.08)" strokeWidth={1} strokeDasharray="4 4" name="Conservative" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Scenario Controls */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Zap className="w-4 h-4" /> Scenario Simulator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Price Change: {scenario.priceChangePct > 0 ? "+" : ""}{scenario.priceChangePct}%</label>
              <Slider value={[scenario.priceChangePct]} min={-30} max={30} step={5}
                onValueChange={([v]) => setScenario(s => ({ ...s, priceChangePct: v }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Capacity Change: {scenario.capacityChangePct > 0 ? "+" : ""}{scenario.capacityChangePct}%</label>
              <Slider value={[scenario.capacityChangePct]} min={-30} max={50} step={5}
                onValueChange={([v]) => setScenario(s => ({ ...s, capacityChangePct: v }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Add Gyms: +{scenario.addGyms}</label>
              <Slider value={[scenario.addGyms]} min={0} max={5} step={1}
                onValueChange={([v]) => setScenario(s => ({ ...s, addGyms: v }))} />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setScenario({ priceChangePct: 0, capacityChangePct: 0, addGyms: 0, removeGymIds: [] })}>
            Reset Scenario
          </Button>
        </CardContent>
      </Card>

      {/* Gym Profitability */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Gym Profitability Index
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {revenue.gym_profitability.map((g, i) => (
              <div key={g.gym_id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                  <span className="text-sm font-medium text-foreground">{g.name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">Rev: €{g.revenue.toFixed(0)}</span>
                  <span className="text-destructive">Comm: €{g.commission.toFixed(0)}</span>
                  <Badge variant={g.net > 0 ? "default" : "destructive"} className="text-[10px]">
                    Net: €{g.net.toFixed(0)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Scores Tab ──
function ScoresTab({ scores }: { scores: TherapistScore[] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <Award className="w-4 h-4 text-primary mb-2" />
          <p className="text-xl font-bold text-foreground">{scores[0]?.total_score || 0}</p>
          <p className="text-[11px] text-muted-foreground">Top Score</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <Users className="w-4 h-4 text-muted-foreground mb-2" />
          <p className="text-xl font-bold text-foreground">{scores.length}</p>
          <p className="text-[11px] text-muted-foreground">Therapists Scored</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <TrendingUp className="w-4 h-4 text-green-500 mb-2" />
          <p className="text-xl font-bold text-foreground">{scores.filter(s => s.trend === "rising").length}</p>
          <p className="text-[11px] text-muted-foreground">Rising</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <AlertTriangle className="w-4 h-4 text-destructive mb-2" />
          <p className="text-xl font-bold text-foreground">{scores.filter(s => s.risk_flag).length}</p>
          <p className="text-[11px] text-muted-foreground">At Risk</p>
        </CardContent></Card>
      </div>

      {/* Score Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Performance Scores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scores} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9 }} className="text-muted-foreground" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} className="text-muted-foreground" width={100} />
                <Tooltip {...CHART_TOOLTIP} />
                <Bar dataKey="total_score" radius={[0, 4, 4, 0]} name="Score">
                  {scores.map((s, i) => (
                    <Cell key={i} fill={s.total_score >= 70 ? "hsl(142, 71%, 45%)" : s.total_score >= 40 ? "hsl(var(--accent))" : "hsl(var(--destructive))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Score Breakdown */}
      <div className="space-y-2">
        {scores.map(s => (
          <Card key={s.id}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{s.name}</span>
                  <Badge variant="outline" className="text-[10px]">{s.gym_name}</Badge>
                  {s.risk_flag && <Badge variant="destructive" className="text-[10px]">AT RISK</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  {s.trend === "rising" && <TrendingUp className="w-3 h-3 text-green-500" />}
                  {s.trend === "declining" && <TrendingDown className="w-3 h-3 text-destructive" />}
                  {s.trend === "stable" && <Minus className="w-3 h-3 text-muted-foreground" />}
                  <span className={`text-xs ${s.growth_pct > 0 ? "text-green-500" : s.growth_pct < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {s.growth_pct > 0 ? "+" : ""}{s.growth_pct}%
                  </span>
                  <span className="text-lg font-bold text-foreground">{s.total_score}</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center p-1.5 rounded bg-muted/40">
                  <p className="text-xs font-bold text-foreground">{s.revenue_score}/25</p>
                  <p className="text-[10px] text-muted-foreground">Revenue</p>
                </div>
                <div className="text-center p-1.5 rounded bg-muted/40">
                  <p className="text-xs font-bold text-foreground">{s.clinical_score}/25</p>
                  <p className="text-[10px] text-muted-foreground">Clinical</p>
                </div>
                <div className="text-center p-1.5 rounded bg-muted/40">
                  <p className="text-xs font-bold text-foreground">{s.client_score}/25</p>
                  <p className="text-[10px] text-muted-foreground">Client</p>
                </div>
                <div className="text-center p-1.5 rounded bg-muted/40">
                  <p className="text-xs font-bold text-foreground">{s.operational_score}/25</p>
                  <p className="text-[10px] text-muted-foreground">Operations</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                <span>€{s.revenue_3m} rev (3M)</span>
                <span>{s.sessions_3m} sessions</span>
                <span>{s.cancellation_rate}% cancel</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Bonuses Tab ──
function BonusesTab({ bonuses }: { bonuses: BonusEntry[] }) {
  const totalBonuses = bonuses.reduce((s, b) => s + b.total_bonus_amount, 0);
  const totalPayout = bonuses.reduce((s, b) => s + b.net_payout, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <Award className="w-4 h-4 text-primary mb-2" />
          <p className="text-xl font-bold text-foreground">€{totalBonuses}</p>
          <p className="text-[11px] text-muted-foreground">Total Bonuses</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <Euro className="w-4 h-4 text-muted-foreground mb-2" />
          <p className="text-xl font-bold text-foreground">€{totalPayout}</p>
          <p className="text-[11px] text-muted-foreground">Total Net Payout</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <Users className="w-4 h-4 text-accent mb-2" />
          <p className="text-xl font-bold text-foreground">{bonuses.filter(b => b.applied_bonuses.length > 0).length}</p>
          <p className="text-[11px] text-muted-foreground">Bonus Recipients</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Bonus Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 p-2 rounded bg-muted/40">
            <Badge className="text-[10px]">Score &gt; 85</Badge>
            <span className="text-xs text-muted-foreground">+5% commission bonus</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-muted/40">
            <Badge variant="secondary" className="text-[10px]">Top 3 Monthly</Badge>
            <span className="text-xs text-muted-foreground">+3% performance bonus</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-muted/40">
            <Badge variant="outline" className="text-[10px]">Clinical Excellence ≥22</Badge>
            <span className="text-xs text-muted-foreground">+2% clinical bonus</span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {bonuses.map(b => (
          <Card key={b.therapist_id}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-foreground">{b.therapist_name}</span>
                <span className="text-sm font-bold text-foreground">€{b.net_payout}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1">
                <span>Score: {b.total_score}</span>
                <span>Base: €{b.revenue_3m}</span>
                {b.total_bonus_pct > 0 && <Badge variant="default" className="text-[10px]">+{b.total_bonus_pct}%</Badge>}
              </div>
              {b.applied_bonuses.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {b.applied_bonuses.map((ab, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">{ab.rule}: €{ab.bonus_amount}</Badge>
                  ))}
                </div>
              )}
              {b.applied_bonuses.length === 0 && (
                <p className="text-[10px] text-muted-foreground italic">No bonuses earned</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Main Dashboard ──
const AdminBusinessIntelligence = () => {
  const { countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);
  const { data, loading, error, fetchSection } = useBusinessIntelligence(selectedCountry?.id ?? null);
  const [activeTab, setActiveTab] = useState("demand");

  useEffect(() => {
    fetchSection("all");
  }, [fetchSection]);

  const handleExportCSV = () => {
    if (!data?.scores) return;
    const headers = "Name,Gym,Score,Revenue,Clinical,Client,Operational,Growth%,Trend,Risk\n";
    const rows = data.scores.map(s =>
      `"${s.name}","${s.gym_name}",${s.total_score},${s.revenue_score},${s.clinical_score},${s.client_score},${s.operational_score},${s.growth_pct},${s.trend},${s.risk_flag}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bi-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
              <Brain className="w-6 h-6 text-primary" /> Enterprise BI
            </h2>
            <p className="text-muted-foreground text-sm">AI-Enhanced Business Intelligence Engine</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!data?.scores}>
              <Download className="w-4 h-4 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => fetchSection("all")} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="p-3">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="demand" className="text-xs"><Brain className="w-3 h-3 mr-1" />Demand</TabsTrigger>
            <TabsTrigger value="revenue" className="text-xs"><Euro className="w-3 h-3 mr-1" />Revenue</TabsTrigger>
            <TabsTrigger value="scores" className="text-xs"><Award className="w-3 h-3 mr-1" />Scores</TabsTrigger>
            <TabsTrigger value="bonuses" className="text-xs"><Zap className="w-3 h-3 mr-1" />Bonuses</TabsTrigger>
            <TabsTrigger value="overview" className="text-xs"><BarChart3 className="w-3 h-3 mr-1" />Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="demand">
            {data?.demand ? <DemandTab demand={data.demand} /> : (
              <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">
                {loading ? "Computing demand predictions…" : "No demand data loaded"}
              </CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="revenue">
            {data?.revenue ? <RevenueTab revenue={data.revenue} /> : (
              <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">
                {loading ? "Computing revenue projections…" : "No revenue data loaded"}
              </CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="scores">
            {data?.scores ? <ScoresTab scores={data.scores} /> : (
              <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">
                {loading ? "Computing therapist scores…" : "No score data loaded"}
              </CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="bonuses">
            {data?.bonuses ? <BonusesTab bonuses={data.bonuses} /> : (
              <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">
                {loading ? "Computing bonus calculations…" : "No bonus data loaded"}
              </CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="overview">
            {data ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card><CardContent className="p-4">
                    <Euro className="w-4 h-4 text-primary mb-2" />
                    <p className="text-xl font-bold text-foreground">€{data.revenue?.weighted_moving_average || 0}</p>
                    <p className="text-[11px] text-muted-foreground">Monthly Revenue (WMA)</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-4">
                    <TrendingUp className="w-4 h-4 text-green-500 mb-2" />
                    <p className="text-xl font-bold text-foreground">{data.revenue?.growth_momentum || 0}%</p>
                    <p className="text-[11px] text-muted-foreground">Growth Momentum</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-4">
                    <Award className="w-4 h-4 text-accent mb-2" />
                    <p className="text-xl font-bold text-foreground">{data.scores?.[0]?.name || "—"}</p>
                    <p className="text-[11px] text-muted-foreground">Top Therapist</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-4">
                    <Shield className="w-4 h-4 text-muted-foreground mb-2" />
                    <p className="text-xl font-bold text-foreground">{data.revenue?.profit_margin || 0}%</p>
                    <p className="text-[11px] text-muted-foreground">Profit Margin</p>
                  </CardContent></Card>
                </div>

                {/* Growth Trajectory */}
                {data.revenue && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Growth Trajectory</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={data.revenue.monthly_history}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="month" tick={{ fontSize: 9 }} className="text-muted-foreground" tickFormatter={v => v.slice(5)} />
                            <YAxis tick={{ fontSize: 9 }} className="text-muted-foreground" tickFormatter={v => `€${v}`} />
                            <Tooltip {...CHART_TOOLTIP} formatter={(v: number) => `€${v}`} />
                            <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Revenue" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Capacity Utilization */}
                {data.demand && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Capacity Utilization (Next 14 Days)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data.demand.staffing_recommendations.slice(0, 14)}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="date" tick={{ fontSize: 8 }} className="text-muted-foreground"
                              tickFormatter={v => format(new Date(v), "dd")} />
                            <YAxis tick={{ fontSize: 9 }} className="text-muted-foreground" />
                            <Tooltip {...CHART_TOOLTIP} labelFormatter={v => format(new Date(v as string), "EEE dd MMM")} />
                            <Bar dataKey="predicted_demand" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Predicted Demand" />
                            <Bar dataKey="therapists_needed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Therapists Needed" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">
                {loading ? "Loading executive overview…" : "Click Refresh to load data"}
              </CardContent></Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminBusinessIntelligence;
