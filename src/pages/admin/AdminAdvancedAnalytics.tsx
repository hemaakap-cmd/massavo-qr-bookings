import { useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Euro, Calendar, Activity, Users, Building2, TrendingUp, AlertTriangle, Clock } from "lucide-react";
import { format, subDays, subMonths } from "date-fns";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(142, 71%, 45%)",
  "hsl(200, 70%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 70%, 55%)",
];

const AdminAdvancedAnalytics = () => {
  // Fetch all bookings
  const { data: bookings = [] } = useQuery({
    queryKey: ["analytics-bookings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*, gyms(name), services(name), therapists(name)")
        .order("booking_date", { ascending: false });
      return data || [];
    },
  });

  // Fetch body areas for clinical metrics
  const { data: bodyAreas = [] } = useQuery({
    queryKey: ["analytics-body-areas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("booking_body_areas")
        .select("area_code, area_label, pain_intensity, is_focus, booking_id");
      return data || [];
    },
  });

  // Revenue metrics
  const revenueMetrics = useMemo(() => {
    const paid = bookings.filter(b => b.payment_status === "paid");
    const totalRevenue = paid.reduce((s, b) => s + Number(b.total_amount), 0);
    const thisMonth = paid.filter(b => {
      const d = new Date(b.booking_date);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const monthlyRevenue = thisMonth.reduce((s, b) => s + Number(b.total_amount), 0);

    // Revenue per gym
    const gymMap = new Map<string, { name: string; revenue: number; count: number }>();
    paid.forEach(b => {
      const name = (b.gyms as any)?.name || "Unknown";
      const entry = gymMap.get(b.gym_id) || { name, revenue: 0, count: 0 };
      entry.revenue += Number(b.total_amount);
      entry.count++;
      gymMap.set(b.gym_id, entry);
    });

    // Revenue per therapist
    const therapistMap = new Map<string, { name: string; revenue: number; count: number }>();
    paid.filter(b => b.therapist_id).forEach(b => {
      const name = (b.therapists as any)?.name || "Unknown";
      const entry = therapistMap.get(b.therapist_id!) || { name, revenue: 0, count: 0 };
      entry.revenue += Number(b.total_amount);
      entry.count++;
      therapistMap.set(b.therapist_id!, entry);
    });

    return {
      totalRevenue,
      monthlyRevenue,
      gymRevenue: Array.from(gymMap.values()).sort((a, b) => b.revenue - a.revenue),
      therapistRevenue: Array.from(therapistMap.values()).sort((a, b) => b.revenue - a.revenue),
    };
  }, [bookings]);

  // Booking metrics
  const bookingMetrics = useMemo(() => {
    const total = bookings.length;
    const completed = bookings.filter(b => b.status === "completed").length;
    const cancelled = bookings.filter(b => b.status === "cancelled").length;
    const noShow = 0; // Would need specific status
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : "0";
    const cancellationRate = total > 0 ? ((cancelled / total) * 100).toFixed(1) : "0";

    // Peak hours
    const hourMap = new Map<string, number>();
    bookings.forEach(b => {
      const hour = b.booking_time?.slice(0, 5) || "00:00";
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    });
    const peakHours = Array.from(hourMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([hour, count]) => ({ hour, count }));

    // Daily trend (last 30 days)
    const dailyTrend = Array.from({ length: 30 }, (_, i) => {
      const d = subDays(new Date(), 29 - i);
      const dateStr = format(d, "yyyy-MM-dd");
      const dayBookings = bookings.filter(b => b.booking_date === dateStr);
      return {
        date: format(d, "dd MMM"),
        count: dayBookings.length,
        revenue: dayBookings.filter(b => b.payment_status === "paid").reduce((s, b) => s + Number(b.total_amount), 0),
      };
    });

    return { total, completed, cancelled, completionRate, cancellationRate, peakHours, dailyTrend };
  }, [bookings]);

  // Clinical metrics
  const clinicalMetrics = useMemo(() => {
    // Most common pain areas
    const areaMap = new Map<string, { label: string; count: number; totalPain: number }>();
    bodyAreas.forEach(a => {
      const entry = areaMap.get(a.area_code) || { label: a.area_label, count: 0, totalPain: 0 };
      entry.count++;
      entry.totalPain += a.pain_intensity || 0;
      areaMap.set(a.area_code, entry);
    });

    const commonAreas = Array.from(areaMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map(a => ({ ...a, avgPain: (a.totalPain / a.count).toFixed(1) }));

    const highRisk = bodyAreas.filter(a => (a.pain_intensity || 0) >= 8).length;
    const avgPain = bodyAreas.length > 0
      ? (bodyAreas.reduce((s, a) => s + (a.pain_intensity || 0), 0) / bodyAreas.length).toFixed(1)
      : "0";

    return { commonAreas, highRisk, avgPain };
  }, [bodyAreas]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Advanced Analytics</h2>
          <p className="text-muted-foreground text-sm">Executive performance overview</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <Euro className="w-4 h-4 text-muted-foreground mb-2" />
            <p className="text-xl font-bold">€{revenueMetrics.totalRevenue.toFixed(0)}</p>
            <p className="text-[11px] text-muted-foreground">Total Revenue</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <Calendar className="w-4 h-4 text-muted-foreground mb-2" />
            <p className="text-xl font-bold">{bookingMetrics.total}</p>
            <p className="text-[11px] text-muted-foreground">Total Bookings</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <TrendingUp className="w-4 h-4 text-muted-foreground mb-2" />
            <p className="text-xl font-bold">{bookingMetrics.completionRate}%</p>
            <p className="text-[11px] text-muted-foreground">Completion Rate</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <AlertTriangle className="w-4 h-4 text-muted-foreground mb-2" />
            <p className="text-xl font-bold">{clinicalMetrics.highRisk}</p>
            <p className="text-[11px] text-muted-foreground">High-Risk Records</p>
          </CardContent></Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Revenue Trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue & Bookings (30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bookingMetrics.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} className="text-muted-foreground" interval={4} />
                    <YAxis yAxisId="left" tick={{ fontSize: 9 }} className="text-muted-foreground" />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} className="text-muted-foreground" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                    <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Revenue (€)" />
                    <Line yAxisId="right" type="monotone" dataKey="count" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} name="Bookings" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Peak Hours */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Peak Booking Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bookingMetrics.peakHours}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                    <Bar dataKey="count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Bookings" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Rankings Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Gym Performance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Gym Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {revenueMetrics.gymRevenue.map((g, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                      <span className="text-sm font-medium text-foreground">{g.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-foreground">€{g.revenue.toFixed(0)}</span>
                      <span className="text-xs text-muted-foreground ml-2">{g.count} bookings</span>
                    </div>
                  </div>
                ))}
                {revenueMetrics.gymRevenue.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Therapist Performance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" /> Therapist Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {revenueMetrics.therapistRevenue.map((t, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                      <span className="text-sm font-medium text-foreground">{t.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-foreground">€{t.revenue.toFixed(0)}</span>
                      <span className="text-xs text-muted-foreground ml-2">{t.count} sessions</span>
                    </div>
                  </div>
                ))}
                {revenueMetrics.therapistRevenue.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Clinical Metrics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="w-4 h-4" /> Most Common Pain Areas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              {clinicalMetrics.commonAreas.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={clinicalMetrics.commonAreas} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <YAxis dataKey="label" type="category" tick={{ fontSize: 10 }} className="text-muted-foreground" width={100} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Occurrences" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No clinical data</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bottom Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4 text-center">
            <p className="text-lg font-bold text-foreground">{clinicalMetrics.avgPain}</p>
            <p className="text-[11px] text-muted-foreground">Avg Pain Intensity</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-lg font-bold text-foreground">{bookingMetrics.cancellationRate}%</p>
            <p className="text-[11px] text-muted-foreground">Cancellation Rate</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-lg font-bold text-foreground">€{revenueMetrics.monthlyRevenue.toFixed(0)}</p>
            <p className="text-[11px] text-muted-foreground">This Month Revenue</p>
          </CardContent></Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAdvancedAnalytics;
