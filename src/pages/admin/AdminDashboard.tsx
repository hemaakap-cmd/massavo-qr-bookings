import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Building2, Users, Calendar, Euro, AlertTriangle, Activity, Wifi, TrendingUp, TrendingDown, ArrowRight, Bot, Heart, CheckCircle2, Clock, XCircle, X } from "lucide-react";
import { useBookingEvents } from "@/hooks/useBookingEvents";
import { EventFeed } from "@/components/admin/monitoring/EventFeed";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LiveVisitorWidget } from "@/components/admin/LiveVisitorWidget";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { format, subDays } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useCountryData } from "@/hooks/useCountry";
import { useTranslation } from "react-i18next";
import { useVenueContext } from "@/domain/venue/VenueContext";

interface Stats {
  cities: number;
  gyms: number;
  hotels: number;
  venues: number;
  therapists: number;
  bookings: number;
  revenue: number;
  pendingBookings: number;
}

interface DailyData {
  date: string;
  bookings: number;
  revenue: number;
}

const AdminDashboard = () => {
  const { countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);
  const { t } = useTranslation();
  const { activeType, config: venueConfig } = useVenueContext();

  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [dateFrom, setDateFrom] = useState<string>(format(subDays(new Date(), 29), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const [stats, setStats] = useState<Stats>({
    cities: 0, gyms: 0, hotels: 0, venues: 0, therapists: 0, bookings: 0, revenue: 0, pendingBookings: 0,
  });
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);

  const { events, loading: eventsLoading, realtimeConnected, stats: eventStats } = useBookingEvents({
    limit: 8,
    realtime: true,
    countryId: selectedCountry?.id,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        let citiesQuery = supabase.from("cities").select("id", { count: "exact", head: true });
        let gymsQuery = supabase.from("gyms").select("id", { count: "exact" });
        let hotelsQuery = supabase.from("hotels").select("id", { count: "exact" });

        if (selectedCountry?.id) {
          citiesQuery = citiesQuery.eq("country_id", selectedCountry.id);
          gymsQuery = gymsQuery.eq("country_id", selectedCountry.id);
          hotelsQuery = hotelsQuery.eq("country_id", selectedCountry.id);
        }

        const [citiesRes, gymsRes, hotelsRes] = await Promise.all([citiesQuery, gymsQuery, hotelsQuery]);

        const gymIds = (gymsRes.data || []).map((g) => g.id);
        const hotelIds = (hotelsRes.data || []).map((h) => h.id);
        const includeGyms = activeType === null || activeType === "gym";
        const includeHotels = activeType === null || activeType === "hotel";
        const scopedGymIds = includeGyms ? gymIds : [];
        const scopedHotelIds = includeHotels ? hotelIds : [];

        let therapistsCount = 0;
        let bookings: any[] = [];

        if (selectedCountry?.id && scopedGymIds.length === 0 && scopedHotelIds.length === 0) {
          therapistsCount = 0;
          bookings = [];
        } else {
          let therapistsQuery = supabase.from("therapists").select("id", { count: "exact", head: true });

          if (selectedCountry?.id) {
            therapistsQuery = therapistsQuery.in("gym_id", gymIds);
          }

          // Bookings: include both gym + hotel scoped IDs
          const orParts: string[] = [];
          if (scopedGymIds.length > 0) orParts.push(`gym_id.in.(${scopedGymIds.join(",")})`);
          if (scopedHotelIds.length > 0) orParts.push(`hotel_id.in.(${scopedHotelIds.join(",")})`);
          let bookingsQuery = supabase.from("bookings").select("*");
          if (selectedCountry?.id && orParts.length > 0) {
            bookingsQuery = bookingsQuery.or(orParts.join(","));
          }

          const [therapistsRes, bookingsRes] = await Promise.all([therapistsQuery, bookingsQuery]);
          therapistsCount = therapistsRes.count || 0;
          bookings = bookingsRes.data || [];
        }

        setAllBookings(bookings);

        const revenue = bookings
          .filter((b) => b.payment_status === "paid")
          .reduce((sum, b) => sum + Number(b.total_amount), 0);
        const pendingBookings = bookings.filter((b) => b.status === "pending").length;

        const gymsCount = gymsRes.count || 0;
        const hotelsCount = hotelsRes.count || 0;
        setStats({
          cities: citiesRes.count || 0,
          gyms: gymsCount,
          hotels: hotelsCount,
          venues: gymsCount + hotelsCount,
          therapists: therapistsCount,
          bookings: bookings.length,
          revenue,
          pendingBookings,
        });

        const last14 = Array.from({ length: 14 }, (_, i) => {
          const d = subDays(new Date(), 13 - i);
          const dateStr = format(d, "yyyy-MM-dd");
          const dayBookings = bookings.filter((b) => b.booking_date === dateStr);
          return {
            date: format(d, "dd MMM"),
            bookings: dayBookings.length,
            revenue: dayBookings
              .filter((b) => b.payment_status === "paid")
              .reduce((s, b) => s + Number(b.total_amount), 0),
          };
        });
        setDailyData(last14);
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    const channel = supabase
      .channel("dashboard-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        fetchStats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedCountry?.id, activeType]);

  const currencySymbol = selectedCountry?.currency_symbol || "€";

  // Date-range filtered bookings for status summary
  const filteredBookings = allBookings.filter((b) => {
    if (!b.booking_date) return false;
    if (dateFrom && b.booking_date < dateFrom) return false;
    if (dateTo && b.booking_date > dateTo) return false;
    return true;
  });
  const statusSummary = {
    total: filteredBookings.length,
    confirmed: filteredBookings.filter((b) => b.status === "confirmed").length,
    pending: filteredBookings.filter((b) => b.status === "pending").length,
    canceled: filteredBookings.filter((b) => b.status === "cancelled").length,
  };
  const last7Data = dailyData.slice(-7);
  const resetDates = () => {
    setDateFrom(format(subDays(new Date(), 29), "yyyy-MM-dd"));
    setDateTo(format(new Date(), "yyyy-MM-dd"));
  };

  const statCards = [
    { title: "Total Revenue", value: `${currencySymbol}${stats.revenue.toFixed(0)}`, icon: Euro, trend: "+12%", up: true },
    { title: "Total Bookings", value: stats.bookings, icon: Calendar, trend: "+8%", up: true },
    activeType === "hotel"
      ? { title: "Active Hotels", value: stats.hotels, icon: venueConfig.icon, trend: null, up: null }
      : activeType === "gym"
      ? { title: "Active Gyms", value: stats.gyms, icon: venueConfig.icon, trend: null, up: null }
      : { title: "Active Venues", value: stats.venues, icon: Building2, trend: null, up: null },
    { title: "Therapists", value: stats.therapists, icon: Users, trend: null, up: null },
    { title: "Cities", value: stats.cities, icon: MapPin, trend: null, up: null },
    { title: "Conflicts", value: eventStats.conflicts + eventStats.warnings, icon: AlertTriangle, trend: null, up: null },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-full">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">Dashboard</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              {selectedCountry ? `Live overview — ${selectedCountry.name}` : "Real-time overview of your MASSAVO platform"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LiveVisitorWidget />
            <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-card border border-border">
              <Wifi className={`w-3 h-3 ${realtimeConnected ? "text-success" : "text-destructive"}`} />
              <span className={realtimeConnected ? "text-success" : "text-destructive"}>
                {realtimeConnected ? "Live" : "Offline"}
              </span>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/ai-assistant">
                <Bot className="w-4 h-4 mr-1.5" />
                AI Assistant
              </Link>
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {statCards.map((stat) => (
            <Card key={stat.title} className="relative overflow-hidden min-w-0">
              <CardContent className="p-3 lg:p-4">
                <div className="flex items-center justify-between mb-2">
                  <stat.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  {stat.trend && (
                    <span className={`text-[10px] font-semibold flex items-center gap-0.5 shrink-0 ${stat.up ? "text-success" : "text-destructive"}`}>
                      {stat.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {stat.trend}
                    </span>
                  )}
                </div>
                <div className="text-lg lg:text-xl font-bold text-foreground truncate">
                  {loading ? "—" : stat.value}
                </div>
                <p className="text-[10px] lg:text-[11px] text-muted-foreground mt-0.5 truncate">{stat.title}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Date Range Filter + Status Summary */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="w-4 h-4" />
                {t("dashboard.dateRange")}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("dashboard.from")}</label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 w-[150px]" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("dashboard.to")}</label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 w-[150px]" />
              </div>
              <Button variant="ghost" size="sm" onClick={resetDates} className="h-8">
                <X className="w-3 h-3 mr-1" /> {t("dashboard.clearFilter")}
              </Button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { key: "total", label: t("dashboard.totalBookings"), value: statusSummary.total, icon: Calendar, tone: "text-foreground", bg: "bg-muted/40", ring: "ring-border" },
                { key: "confirmed", label: t("dashboard.confirmedBookings"), value: statusSummary.confirmed, icon: CheckCircle2, tone: "text-success", bg: "bg-success/10", ring: "ring-success/30" },
                { key: "pending", label: t("dashboard.pendingBookings"), value: statusSummary.pending, icon: Clock, tone: "text-warning", bg: "bg-warning/10", ring: "ring-warning/30" },
                { key: "canceled", label: t("dashboard.canceledBookings"), value: statusSummary.canceled, icon: XCircle, tone: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/30" },
              ].map((s) => (
                <div key={s.key} className={`rounded-lg p-3 ring-1 ${s.bg} ${s.ring}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <s.icon className={`w-4 h-4 ${s.tone}`} />
                  </div>
                  <div className={`text-2xl font-bold ${s.tone}`}>{loading ? "—" : s.value}</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{s.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Revenue Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue (14 days)</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number) => [`${currencySymbol}${value.toFixed(0)}`, "Revenue"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#revenueGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Bookings Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Bookings (14 days)</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="bookings" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bookings — Last 7 days */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.bookingsLast7Days")}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7Data}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="bookings" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Clinical Insights Quick Link */}
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Heart className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Smart Recovery Profiles</h3>
                <p className="text-xs text-muted-foreground">Track pain evolution, trends & clinical insights per client</p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/pain-evolution">
                View Insights <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Recent Activity
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs" asChild>
              <Link to="/admin/monitoring">
                View All <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <EventFeed events={events} loading={eventsLoading} />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
