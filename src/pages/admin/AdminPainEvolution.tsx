import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePainEvolution } from "@/hooks/usePainEvolution";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingDown, TrendingUp, Minus, AlertTriangle, Activity, Search } from "lucide-react";

const AdminPainEvolution = () => {
  const [customerEmail, setCustomerEmail] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [gymFilter, setGymFilter] = useState<string>("all");
  const [therapistFilter, setTherapistFilter] = useState<string>("all");
  const [compareMode, setCompareMode] = useState<"none" | "first-vs-latest">("none");

  const { data: gyms } = useQuery({
    queryKey: ["gyms-list"],
    queryFn: async () => {
      const { data } = await supabase.from("gyms").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: therapists } = useQuery({
    queryKey: ["therapists-list"],
    queryFn: async () => {
      const { data } = await supabase.from("therapists").select("id, name").order("name");
      return data || [];
    },
  });

  const { data, isLoading } = usePainEvolution(customerEmail || null, {
    areaCode: areaFilter !== "all" ? areaFilter : undefined,
    gymId: gymFilter !== "all" ? gymFilter : undefined,
    therapistId: therapistFilter !== "all" ? therapistFilter : undefined,
  });

  const { dataPoints = [], trends = [] } = data || {};

  // Get all unique area codes from data
  const availableAreas = useMemo(() => {
    const areas = new Map<string, string>();
    dataPoints.forEach(dp => dp.areas.forEach(a => areas.set(a.code, a.label)));
    return Array.from(areas.entries());
  }, [dataPoints]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!dataPoints.length) return [];

    if (areaFilter !== "all") {
      return dataPoints.map(dp => {
        const area = dp.areas.find(a => a.code === areaFilter);
        return { date: dp.date, pain: area?.painIntensity || 0 };
      });
    }

    // All areas: average pain per session
    return dataPoints.map(dp => {
      const avg = dp.areas.reduce((s, a) => s + a.painIntensity, 0) / (dp.areas.length || 1);
      return { date: dp.date, pain: Math.round(avg * 10) / 10 };
    });
  }, [dataPoints, areaFilter]);

  const handleSearch = () => {
    setCustomerEmail(searchInput.trim());
  };

  const TrendIcon = ({ direction }: { direction: string }) => {
    if (direction === "improving") return <TrendingDown className="w-4 h-4 text-green-500" />;
    if (direction === "worsening") return <TrendingUp className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Pain Evolution</h2>
          <p className="text-muted-foreground text-sm">Track pain intensity trends across sessions</p>
        </div>

        {/* Search + Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex gap-2">
                <Input
                  placeholder="Enter client email..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  className="flex-1"
                />
                <Button onClick={handleSearch} variant="default" size="icon">
                  <Search className="w-4 h-4" />
                </Button>
              </div>

              <Select value={areaFilter} onValueChange={setAreaFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Body Area" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Areas (Avg)</SelectItem>
                  {availableAreas.map(([code, label]) => (
                    <SelectItem key={code} value={code}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={gymFilter} onValueChange={setGymFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Gyms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Gyms</SelectItem>
                  {(gyms || []).map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={therapistFilter} onValueChange={setTherapistFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All Therapists" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Therapists</SelectItem>
                  {(therapists || []).map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {!customerEmail ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Search for a client to view their pain evolution</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Loading...</CardContent></Card>
        ) : (
          <>
            {/* Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pain Intensity Over Time {areaFilter !== "all" && `— ${availableAreas.find(([c]) => c === areaFilter)?.[1]}`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                        <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} className="text-muted-foreground" />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <ReferenceLine y={8} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label={{ value: "High Risk", fontSize: 10, fill: "hsl(var(--destructive))" }} />
                        <Line
                          type="monotone"
                          dataKey="pain"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ fill: "hsl(var(--primary))", r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      No pain data recorded for this client
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Trends Summary */}
            {trends.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Area Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {trends.map(t => (
                      <div key={t.areaCode} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                        <TrendIcon direction={t.direction} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{t.areaLabel}</p>
                          <p className="text-xs text-muted-foreground">
                            {t.firstValue} → {t.latestValue} • Avg: {t.avgPain} • {t.sessionCount} sessions
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {t.isHighRisk && (
                            <Badge variant="destructive" className="text-[10px] px-1.5">≥8</Badge>
                          )}
                          {t.isChronic && (
                            <Badge variant="outline" className="text-[10px] px-1.5 border-amber-500 text-amber-600">
                              <AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> Chronic
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Session Details Table */}
            {dataPoints.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Session History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-3 text-muted-foreground font-medium">Date</th>
                          <th className="text-left py-2 px-3 text-muted-foreground font-medium">Service</th>
                          <th className="text-left py-2 px-3 text-muted-foreground font-medium">Therapist</th>
                          <th className="text-left py-2 px-3 text-muted-foreground font-medium">Gym</th>
                          <th className="text-left py-2 px-3 text-muted-foreground font-medium">Areas</th>
                          <th className="text-right py-2 px-3 text-muted-foreground font-medium">Avg Pain</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataPoints.map(dp => {
                          const avg = dp.areas.reduce((s, a) => s + a.painIntensity, 0) / (dp.areas.length || 1);
                          return (
                            <tr key={dp.bookingId} className="border-b border-border/50 hover:bg-muted/30">
                              <td className="py-2 px-3">{dp.date}</td>
                              <td className="py-2 px-3">{dp.serviceName}</td>
                              <td className="py-2 px-3">{dp.therapistName || "—"}</td>
                              <td className="py-2 px-3">{dp.gymName}</td>
                              <td className="py-2 px-3">{dp.areas.length} areas</td>
                              <td className="py-2 px-3 text-right font-medium">
                                <span className={avg >= 8 ? "text-destructive" : avg >= 5 ? "text-amber-600" : "text-green-600"}>
                                  {avg.toFixed(1)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminPainEvolution;
