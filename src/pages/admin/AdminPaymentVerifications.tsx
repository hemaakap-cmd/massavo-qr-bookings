import { useEffect, useState, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Search,
  CreditCard,
  Receipt,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type BookingRow = {
  id: string;
  created_at: string;
  customer_email: string;
  customer_name: string | null;
  booking_date: string;
  booking_time: string;
  total_amount: number;
  status: string | null;
  payment_status: string | null;
  stripe_session_id: string | null;
  gym_id: string | null;
  hotel_id: string | null;
  services: { name: string; duration_minutes: number } | null;
  gyms: { name: string; country_id: string | null } | null;
  hotels: { name: string; country_id: string | null } | null;
};

type PaymentEvent = {
  id: string;
  created_at: string;
  event_type: string;
  severity: string;
  customer_email: string | null;
  customer_name: string | null;
  booking_id: string | null;
  details: Record<string, unknown>;
};

const maskName = (n: string | null) =>
  !n ? "—" : n.charAt(0).toUpperCase() + "***";

const maskEmail = (e: string) => {
  const [u, d] = e.split("@");
  if (!d) return "***@***";
  return `${u.slice(0, 2)}***@${d.charAt(0)}***`;
};

const statusBadge = (s: string | null) => {
  switch (s) {
    case "paid":
      return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Paid</Badge>;
    case "pending":
      return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">Pending</Badge>;
    case "failed":
      return <Badge className="bg-red-500/15 text-red-400 border-red-500/30">Failed</Badge>;
    case "refunded":
      return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30">Refunded</Badge>;
    default:
      return <Badge variant="secondary">{s ?? "—"}</Badge>;
  }
};

const bookingStatusBadge = (s: string | null) => {
  switch (s) {
    case "confirmed":
      return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Confirmed</Badge>;
    case "cancelled":
      return <Badge className="bg-red-500/15 text-red-400 border-red-500/30">Cancelled</Badge>;
    case "rescheduled":
      return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30">Rescheduled</Badge>;
    case "pending":
      return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">Pending</Badge>;
    default:
      return <Badge variant="secondary">{s ?? "—"}</Badge>;
  }
};

const AdminPaymentVerifications = () => {
  const { countryId, isSuperAdmin } = useAuth();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [reverifying, setReverifying] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sinceIso = sevenDaysAgo.toISOString();

      const { data: bookingsData, error: bookingsErr } = await supabase
        .from("bookings")
        .select(
          `id, created_at, customer_email, customer_name, booking_date, booking_time,
           total_amount, status, payment_status, stripe_session_id, gym_id, hotel_id,
           services:service_id ( name, duration_minutes ),
           gyms:gym_id ( name, country_id ),
           hotels:hotel_id ( name, country_id )`
        )
        .not("stripe_session_id", "is", null)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(200);
      if (bookingsErr) throw bookingsErr;

      const filtered = (bookingsData ?? []).filter((b: any) => {
        if (isSuperAdmin) return true;
        if (!countryId) return true;
        const cid = b.gyms?.country_id ?? b.hotels?.country_id ?? null;
        return cid === countryId;
      }) as unknown as BookingRow[];
      setBookings(filtered);

      const { data: eventsData, error: eventsErr } = await supabase
        .from("booking_events")
        .select("id, created_at, event_type, severity, customer_email, customer_name, booking_id, details")
        .in("event_type", ["created", "payment_updated"])
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(200);
      if (eventsErr) throw eventsErr;
      setEvents((eventsData ?? []) as unknown as PaymentEvent[]);
    } catch (e: any) {
      console.error("[AdminPaymentVerifications] fetch error:", e);
      toast.error(e.message || "Failed to load payment verifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId, isSuperAdmin]);

  const stats = useMemo(() => {
    const total = bookings.length;
    const paid = bookings.filter((b) => b.payment_status === "paid").length;
    const pending = bookings.filter((b) => b.payment_status === "pending").length;
    const failed = bookings.filter((b) => b.payment_status === "failed").length;
    const refunded = bookings.filter((b) => b.payment_status === "refunded").length;
    const revenue = bookings
      .filter((b) => b.payment_status === "paid")
      .reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
    return { total, paid, pending, failed, refunded, revenue };
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (statusFilter !== "all" && b.payment_status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        b.stripe_session_id?.toLowerCase().includes(q) ||
        b.customer_email?.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q) ||
        b.services?.name.toLowerCase().includes(q)
      );
    });
  }, [bookings, search, statusFilter]);

  const handleReverify = async (sessionId: string) => {
    setReverifying(sessionId);
    try {
      const { data, error } = await supabase.functions.invoke("verify-payment", {
        body: { session_id: sessionId },
      });
      if (error) throw error;
      toast.success("Re-verification triggered. Refreshing…");
      console.log("[reverify]", data);
      await fetchData();
    } catch (e: any) {
      toast.error(e.message || "Re-verification failed");
    } finally {
      setReverifying(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-primary" />
              Payment Verifications
            </h1>
            <p className="text-sm text-admin-text-secondary mt-1">
              Track Stripe verify-payment outcomes and booking status (last 7 days)
            </p>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatCard label="Total" value={stats.total} icon={Receipt} tone="neutral" />
          <StatCard label="Paid" value={stats.paid} icon={CheckCircle2} tone="success" />
          <StatCard label="Pending" value={stats.pending} icon={Clock} tone="warning" />
          <StatCard label="Failed" value={stats.failed} icon={XCircle} tone="error" />
          <StatCard label="Refunded" value={stats.refunded} icon={AlertTriangle} tone="info" />
          <StatCard label="Revenue" value={`€${stats.revenue.toFixed(0)}`} icon={CreditCard} tone="primary" />
        </div>

        <Tabs defaultValue="bookings" className="space-y-4">
          <TabsList>
            <TabsTrigger value="bookings">Verified Bookings</TabsTrigger>
            <TabsTrigger value="events">Payment Events</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by session_id, email, booking id, service…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {["all", "paid", "pending", "failed", "refunded"].map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={statusFilter === s ? "default" : "outline"}
                        onClick={() => setStatusFilter(s)}
                        className="capitalize"
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Venue</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Booking</TableHead>
                        <TableHead>Session</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            Loading…
                          </TableCell>
                        </TableRow>
                      ) : filteredBookings.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            No payment verifications found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredBookings.map((b) => {
                          const venueName = b.gyms?.name ?? b.hotels?.name ?? "—";
                          const venueType = b.hotel_id ? "Hotel" : "Gym";
                          return (
                            <TableRow key={b.id}>
                              <TableCell className="text-xs whitespace-nowrap">
                                {format(new Date(b.created_at), "dd.MM HH:mm")}
                              </TableCell>
                              <TableCell className="text-xs">
                                <div className="font-medium">{b.services?.name ?? "—"}</div>
                                <div className="text-muted-foreground">
                                  {b.services?.duration_minutes ?? "?"} min
                                </div>
                              </TableCell>
                              <TableCell className="text-xs">
                                <div>{venueName}</div>
                                <div className="text-muted-foreground">{venueType}</div>
                              </TableCell>
                              <TableCell className="text-xs">
                                <div>{maskName(b.customer_name)}</div>
                                <div className="text-muted-foreground">{maskEmail(b.customer_email)}</div>
                              </TableCell>
                              <TableCell className="text-xs font-medium">
                                €{Number(b.total_amount).toFixed(2)}
                              </TableCell>
                              <TableCell>{statusBadge(b.payment_status)}</TableCell>
                              <TableCell>{bookingStatusBadge(b.status)}</TableCell>
                              <TableCell className="text-xs font-mono">
                                {b.stripe_session_id?.slice(0, 16)}…
                              </TableCell>
                              <TableCell className="text-right">
                                {b.stripe_session_id && b.payment_status !== "paid" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleReverify(b.stripe_session_id!)}
                                    disabled={reverifying === b.stripe_session_id}
                                  >
                                    {reverifying === b.stripe_session_id ? (
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : (
                                      "Re-verify"
                                    )}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Booking ID</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No payment events
                          </TableCell>
                        </TableRow>
                      ) : (
                        events.map((ev) => (
                          <TableRow key={ev.id}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {format(new Date(ev.created_at), "dd.MM HH:mm:ss")}
                            </TableCell>
                            <TableCell className="text-xs font-medium capitalize">
                              {ev.event_type.replace("_", " ")}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  ev.severity === "error"
                                    ? "border-red-500/30 text-red-400"
                                    : ev.severity === "warning"
                                    ? "border-amber-500/30 text-amber-400"
                                    : "border-emerald-500/30 text-emerald-400"
                                }
                              >
                                {ev.severity}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {ev.customer_name ?? "—"}
                              <div className="text-muted-foreground">{ev.customer_email}</div>
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {ev.booking_id?.slice(0, 8) ?? "—"}…
                            </TableCell>
                            <TableCell className="text-xs max-w-md">
                              <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-all">
                                {JSON.stringify(ev.details, null, 0)}
                              </pre>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

const StatCard = ({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "success" | "warning" | "error" | "info" | "primary" | "neutral";
}) => {
  const toneClass = {
    success: "text-emerald-400 bg-emerald-500/10",
    warning: "text-amber-400 bg-amber-500/10",
    error: "text-red-400 bg-red-500/10",
    info: "text-blue-400 bg-blue-500/10",
    primary: "text-primary bg-primary/10",
    neutral: "text-foreground bg-muted/40",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${toneClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs text-admin-text-secondary">{label}</div>
          <div className="text-lg font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminPaymentVerifications;