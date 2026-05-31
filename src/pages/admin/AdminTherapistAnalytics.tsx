import { useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  TrendingUp,
  Activity,
  AlertTriangle,
  Euro,
  Calendar,
  Sparkles,
  Loader2,
  RefreshCw,
  BarChart3,
  UserCheck,
  UserX,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useTherapistAnalytics } from "@/hooks/useTherapistAnalytics";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/hooks/useAuth";
import { useCountryData } from "@/hooks/useCountry";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
];

const AdminTherapistAnalytics = () => {
  const { countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);
  const { data, aiInsight, loading, aiLoading, error, fetchData, fetchAiInsight } = useTherapistAnalytics(selectedCountry?.id ?? null);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const workloadPieData = data
    ? [
        { name: "Overloaded", value: data.workload.overloaded.length },
        { name: "Balanced", value: data.workload.balanced_count },
        { name: "Underloaded", value: data.workload.underloaded.length },
      ].filter((d) => d.value > 0)
    : [];

  const topPerformers = data?.therapist_details.slice(0, 8) || [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">Therapist Analytics</h2>
              <p className="text-muted-foreground text-sm">AI-powered performance insights (last 30 days)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={fetchAiInsight} disabled={aiLoading || loading}>
              <Sparkles className={`w-4 h-4 mr-1.5 ${aiLoading ? "animate-pulse" : ""}`} />
              {aiLoading ? "Analyzing..." : "AI Analysis"}
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="p-4 text-sm text-destructive">⚠️ {error}</CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : data ? (
          <>
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Total Therapists", value: data.summary.total_therapists, icon: Users },
                { label: "Available", value: data.summary.available_therapists, icon: UserCheck },
                { label: "Unavailable", value: data.summary.unavailable_therapists, icon: UserX },
                { label: "Bookings (30d)", value: data.summary.total_bookings_30d, icon: Calendar },
                { label: "Revenue (30d)", value: `€${data.summary.total_revenue_30d.toFixed(0)}`, icon: Euro },
                { label: "Avg/Therapist", value: data.summary.avg_bookings_per_therapist, icon: TrendingUp },
              ].map((kpi) => (
                <Card key={kpi.label}>
                  <CardContent className="p-4">
                    <kpi.icon className="w-4 h-4 text-muted-foreground mb-2" />
                    <div className="text-xl font-bold text-foreground">{kpi.value}</div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{kpi.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Revenue by Therapist */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Revenue by Therapist</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topPerformers} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                          formatter={(value: number) => [`€${value.toFixed(0)}`, "Revenue"]}
                        />
                        <Bar dataKey="revenue_30d" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Workload Distribution */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Workload Distribution</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-64 flex items-center justify-center">
                    {workloadPieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={workloadPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={4}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {workloadPieData.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Legend />
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-muted-foreground text-sm">No workload data</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Workload Alerts */}
            {(data.workload.overloaded.length > 0 || data.workload.underloaded.length > 0) && (
              <Card className="border-warning/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning" />
                    Workload Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.workload.overloaded.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Overloaded therapists:</p>
                      <div className="flex flex-wrap gap-2">
                        {data.workload.overloaded.map((t) => (
                          <Badge key={t.name} variant="destructive" className="text-xs">
                            {t.name} — {t.bookings} bookings
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.workload.underloaded.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Underloaded therapists:</p>
                      <div className="flex flex-wrap gap-2">
                        {data.workload.underloaded.map((t) => (
                          <Badge key={t.name} variant="secondary" className="text-xs">
                            {t.name} — {t.bookings} bookings
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Therapist Performance Table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Performance Table</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-xs">
                        <th className="text-left py-2 px-3">Therapist</th>
                        <th className="text-left py-2 px-3">Gym</th>
                        <th className="text-center py-2 px-3">Bookings</th>
                        <th className="text-center py-2 px-3">Revenue</th>
                        <th className="text-center py-2 px-3">Cancel %</th>
                        <th className="text-center py-2 px-3">Avg/Day</th>
                        <th className="text-center py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.therapist_details.map((t) => (
                        <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-3 font-medium text-foreground">{t.name}</td>
                          <td className="py-2 px-3 text-muted-foreground">{t.gym_name}</td>
                          <td className="py-2 px-3 text-center">{t.confirmed_bookings}</td>
                          <td className="py-2 px-3 text-center font-medium">€{t.revenue_30d.toFixed(0)}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={parseFloat(t.cancellation_rate) > 20 ? "text-destructive font-medium" : ""}>
                              {t.cancellation_rate}%
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">{t.avg_bookings_per_day}</td>
                          <td className="py-2 px-3 text-center">
                            <Badge variant={t.is_available ? "default" : "secondary"} className="text-[10px]">
                              {t.is_available ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* AI Insight Panel */}
            {aiInsight && (
              <Card className="border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    AI Analysis & Recommendations
                    {aiLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-li:text-foreground/90">
                    <ReactMarkdown>{aiInsight}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
};

export default AdminTherapistAnalytics;
