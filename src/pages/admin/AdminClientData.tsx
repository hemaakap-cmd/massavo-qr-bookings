import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StaffPainEvolutionCard } from "@/components/staff/StaffPainEvolutionCard";
import { SmartRecoveryProfile } from "@/components/clinical/SmartRecoveryProfile";
import EnterpriseReportLayout from "@/components/print/EnterpriseReportLayout";
import EnterpriseSummaryCard from "@/components/print/EnterpriseSummaryCard";
import ReportSection from "@/components/print/ReportSection";
import type { SelectedArea } from "@/components/body-diagram/BodyDiagram";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Users, Search, Calendar, Download, Printer, Loader2,
  ChevronLeft, ChevronRight, Eye, FileSpreadsheet, Filter,
  TrendingUp, UserCheck, Clock, Stethoscope, MessageCircle,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, differenceInYears } from "date-fns";
import { de } from "date-fns/locale";
import PrintableContainer from "@/components/print/PrintableContainer";
import { useAuth } from "@/hooks/useAuth";
import { useCountryData } from "@/hooks/useCountry";
import { fetchCountryVenueIds, buildVenueOrFilter, getVenueName, getVenueType } from "@/lib/venueUtils";
import { VenueBadge } from "@/components/shared/VenueBadge";

interface ClientRow {
  customer_email: string;
  customer_name: string | null;
  gender: string | null;
  client_phone: string | null;
  client_address: string | null;
  date_of_birth: string | null;
  visit_count: number;
  first_visit: string;
  last_visit: string;
  total_spent: number;
  last_service: string | null;
  last_venue: string | null;
  last_venue_type: "gym" | "hotel";
  last_therapist: string | null;
  last_status: string | null;
  therapist_advice: string | null;
  avg_rating: number | null;
  communication_preference: string | null;
  pregnancy_status: string | null;
  bookings: any[];
}

type DatePreset = "today" | "week" | "month" | "custom";

/** Calculate age from ISO date string */
function calcAge(dob: string | null): number | null {
  if (!dob) return null;
  try {
    return differenceInYears(new Date(), parseISO(dob));
  } catch { return null; }
}

/** Extract city from address (last part after PLZ pattern or last comma-separated segment) */
function extractCity(address: string | null): string {
  if (!address) return "—";
  // Pattern: "Straße Nr, PLZ Stadt" or "Straße Nr, PLZ Stadt, ..."
  const plzMatch = address.match(/\b(\d{5})\s+(.+?)(?:,|$)/);
  if (plzMatch) return plzMatch[2].trim();
  // Fallback: last comma segment
  const parts = address.split(",").map(s => s.trim());
  return parts[parts.length - 1] || "—";
}

function formatDob(dob: string | null): string {
  if (!dob) return "—";
  try { return format(parseISO(dob), "dd.MM.yyyy"); } catch { return "—"; }
}

export default function AdminClientData() {
  const { countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);
  const [datePreset, setDatePreset] = useState<DatePreset>("month");
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const PAGE_SIZE = 50;

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    switch (preset) {
      case "today":
        setDateFrom(format(now, "yyyy-MM-dd"));
        setDateTo(format(now, "yyyy-MM-dd"));
        break;
      case "week":
        setDateFrom(format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"));
        setDateTo(format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"));
        break;
      case "month":
        setDateFrom(format(startOfMonth(now), "yyyy-MM-dd"));
        setDateTo(format(endOfMonth(now), "yyyy-MM-dd"));
        break;
      case "custom": break;
    }
    setPage(0);
  };

  const { data: clientRows = [], isLoading } = useQuery({
    queryKey: ["admin-client-data", dateFrom, dateTo, selectedCountry?.id],
    queryFn: async () => {
      // Fetch all venue IDs for the selected country, then OR-filter bookings
      const { gymIds, hotelIds } = await fetchCountryVenueIds(selectedCountry?.id);
      const orFilter = buildVenueOrFilter(gymIds, hotelIds);

      let bookingsQuery = (supabase as any)
        .from("bookings")
        .select(`
          id, booking_date, booking_time, customer_name, customer_email,
          status, payment_status, total_amount, notes, communication_preference,
          therapist_id, gym_id, hotel_id, service_id, gender, pregnancy_status,
          client_phone, client_address, date_of_birth, salutation,
          services:service_id(name, duration_minutes),
          gyms:gym_id(name, country_id),
          hotels:hotel_id(name, country_id),
          therapists:therapist_id(name)
        `)
        .gte("booking_date", dateFrom)
        .lte("booking_date", dateTo)
        .neq("status", "cancelled")
        .order("booking_date", { ascending: false })
        .order("booking_time", { ascending: false });

      if (selectedCountry?.id && orFilter) {
        bookingsQuery = bookingsQuery.or(orFilter);
      } else if (selectedCountry?.id && !orFilter) {
        // No venues in this country → return empty
        return [];
      }

      const { data: bookings, error } = await bookingsQuery;

      if (error) throw error;

      const bookingIds = (bookings || []).map((b: any) => b.id);
      let feedbackMap: Record<string, any> = {};
      if (bookingIds.length > 0) {
        for (let i = 0; i < bookingIds.length; i += 100) {
          const chunk = bookingIds.slice(i, i + 100);
          const { data: fb } = await supabase
            .from("booking_feedback")
            .select("booking_id, therapist_advice, therapist_rating, service_rating, comment")
            .in("booking_id", chunk);
          (fb || []).forEach((f: any) => { feedbackMap[f.booking_id] = f; });
        }
      }

      const emailMap = new Map<string, ClientRow>();
      (bookings || []).forEach((b: any) => {
        const email = b.customer_email;
        const fb = feedbackMap[b.id];
        const venueName = getVenueName(b, "—");
        const venueType = getVenueType(b);
        if (!emailMap.has(email)) {
          emailMap.set(email, {
            customer_email: email,
            customer_name: b.customer_name,
            gender: b.gender,
            client_phone: b.client_phone,
            client_address: b.client_address,
            date_of_birth: b.date_of_birth,
            visit_count: 0,
            first_visit: b.booking_date,
            last_visit: b.booking_date,
            total_spent: 0,
            last_service: b.services?.name || null,
            last_venue: venueName,
            last_venue_type: venueType,
            last_therapist: b.therapists?.name || null,
            last_status: b.status,
            therapist_advice: fb?.therapist_advice || null,
            avg_rating: null,
            communication_preference: b.communication_preference,
            pregnancy_status: b.pregnancy_status,
            bookings: [],
          });
        }
        const row = emailMap.get(email)!;
        row.visit_count++;
        row.total_spent += b.total_amount || 0;
        if (b.booking_date < row.first_visit) row.first_visit = b.booking_date;
        if (b.booking_date > row.last_visit) {
          row.last_visit = b.booking_date;
          row.customer_name = b.customer_name || row.customer_name;
          row.gender = b.gender || row.gender;
          row.client_phone = b.client_phone || row.client_phone;
          row.client_address = b.client_address || row.client_address;
          row.date_of_birth = b.date_of_birth || row.date_of_birth;
          row.last_service = b.services?.name || row.last_service;
          row.last_venue = venueName;
          row.last_venue_type = venueType;
          row.last_therapist = b.therapists?.name || row.last_therapist;
          row.last_status = b.status;
          row.communication_preference = b.communication_preference || row.communication_preference;
          row.pregnancy_status = b.pregnancy_status || row.pregnancy_status;
        }
        if (fb?.therapist_advice) row.therapist_advice = fb.therapist_advice;
        row.bookings.push({
          ...b,
          service_name: b.services?.name,
          venue_name: venueName,
          venue_type: venueType,
          therapist_name: b.therapists?.name,
          feedback: fb,
        });
      });

      emailMap.forEach((row) => {
        const ratings = row.bookings
          .filter((b: any) => b.feedback?.therapist_rating)
          .map((b: any) => b.feedback.therapist_rating);
        if (ratings.length > 0) {
          row.avg_rating = ratings.reduce((s: number, r: number) => s + r, 0) / ratings.length;
        }
      });

      return Array.from(emailMap.values()).sort((a, b) => b.visit_count - a.visit_count);
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return clientRows;
    const q = search.toLowerCase();
    return clientRows.filter(
      (c) =>
        c.customer_email.toLowerCase().includes(q) ||
        (c.customer_name || "").toLowerCase().includes(q) ||
        (c.client_phone || "").includes(q) ||
        (c.client_address || "").toLowerCase().includes(q)
    );
  }, [clientRows, search]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const stats = useMemo(() => ({
    totalClients: filtered.length,
    totalVisits: filtered.reduce((s, c) => s + c.visit_count, 0),
    totalRevenue: filtered.reduce((s, c) => s + c.total_spent, 0),
    returningClients: filtered.filter((c) => c.visit_count > 1).length,
  }), [filtered]);

  // ── Excel Export ──
  const handleExcelExport = () => {
    const venueGroups = new Map<string, typeof filtered>();
    filtered.forEach((c) => {
      const label = c.last_venue
        ? `${c.last_venue_type === "hotel" ? "🏨 " : "🏋️ "}${c.last_venue}`
        : "Ohne Zuordnung";
      if (!venueGroups.has(label)) venueGroups.set(label, []);
      venueGroups.get(label)!.push(c);
    });

    const headers = [
      "Nr.", "Kundenname", "Geschlecht", "Alter", "Geburtsdatum",
      "Email", "Telefon", "Stadt", "Adresse",
      "Besuche", "Gesamtumsatz (€)", "Erster Besuch", "Letzter Besuch",
      "Letzter Service", "Letzter Therapeut", "Standort", "Typ",
    ];

    const rows: (string | number)[][] = [];
    const sortedVenues = Array.from(venueGroups.entries()).sort((a, b) => {
      if (a[0] === "Ohne Zuordnung") return 1;
      if (b[0] === "Ohne Zuordnung") return -1;
      return a[0].localeCompare(b[0]);
    });

    let globalIdx = 0;
    sortedVenues.forEach(([venueLabel, venueClients]) => {
      venueClients.forEach((c) => {
        globalIdx++;
        const age = calcAge(c.date_of_birth);
        rows.push([
          globalIdx,
          c.customer_name || "",
          c.gender === "male" ? "Männlich" : c.gender === "female" ? "Weiblich" : "",
          age !== null ? age : "",
          c.date_of_birth ? format(parseISO(c.date_of_birth), "dd.MM.yyyy") : "",
          c.customer_email,
          c.client_phone || "",
          extractCity(c.client_address),
          c.client_address || "",
          c.visit_count,
          c.total_spent.toFixed(2),
          format(parseISO(c.first_visit), "dd.MM.yyyy"),
          format(parseISO(c.last_visit), "dd.MM.yyyy"),
          c.last_service || "",
          c.last_therapist || "",
          venueLabel,
          c.last_venue_type === "hotel" ? "Hotel" : "Gym",
        ]);
      });
    });

    const BOM = "\uFEFF";
    const csvContent = BOM + "sep=;\n" + [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `MASSAVO-Kundendaten_${dateFrom}_${dateTo}.csv`;
    link.click();
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Kundendaten</h1>
              <p className="text-xs text-muted-foreground">
                {selectedCountry ? `${selectedCountry.name} · ` : ""}
                {format(parseISO(dateFrom), "dd.MM.yyyy")} – {format(parseISO(dateTo), "dd.MM.yyyy")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExcelExport} disabled={filtered.length === 0}>
              <Download className="w-4 h-4" />
              Excel
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsPrintOpen(true)} disabled={filtered.length === 0}>
              <Printer className="w-4 h-4" />
              Drucken
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Filter & Zeitraum</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Select value={datePreset} onValueChange={(v) => handlePresetChange(v as DatePreset)}>
                <SelectTrigger><SelectValue placeholder="Zeitraum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Heute</SelectItem>
                  <SelectItem value="week">Diese Woche</SelectItem>
                  <SelectItem value="month">Dieser Monat</SelectItem>
                  <SelectItem value="custom">Benutzerdefiniert</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setDatePreset("custom"); setPage(0); }} />
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setDatePreset("custom"); setPage(0); }} />
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Name, Email, Telefon oder Stadt suchen..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Users} label="Kunden" value={stats.totalClients} color="text-primary" />
          <StatCard icon={Calendar} label="Besuche" value={stats.totalVisits} color="text-blue-500" />
          <StatCard icon={TrendingUp} label="Umsatz" value={`€${stats.totalRevenue.toFixed(0)}`} color="text-emerald-500" />
          <StatCard icon={UserCheck} label="Stammkunden" value={stats.returningClients} color="text-amber-500" />
        </div>

        {/* Data Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">Keine Kundendaten für diesen Zeitraum</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold text-xs w-[40px]">#</TableHead>
                    <TableHead className="font-semibold text-xs min-w-[140px]">Kundenname</TableHead>
                    <TableHead className="font-semibold text-xs min-w-[50px] text-center">Alter</TableHead>
                    <TableHead className="font-semibold text-xs min-w-[90px]">Geb.datum</TableHead>
                    <TableHead className="font-semibold text-xs min-w-[170px]">Email</TableHead>
                    <TableHead className="font-semibold text-xs min-w-[110px]">Telefon</TableHead>
                    <TableHead className="font-semibold text-xs min-w-[100px]">Stadt</TableHead>
                    <TableHead className="font-semibold text-xs min-w-[60px] text-center">Besuche</TableHead>
                    <TableHead className="font-semibold text-xs min-w-[70px] text-right">Umsatz</TableHead>
                    <TableHead className="font-semibold text-xs min-w-[100px]">Standort</TableHead>
                    <TableHead className="font-semibold text-xs min-w-[50px] text-center">Info</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((client, idx) => {
                    const age = calcAge(client.date_of_birth);
                    return (
                      <TableRow
                        key={client.customer_email}
                        className="hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => setSelectedClient(client)}
                      >
                        <TableCell className="text-xs text-muted-foreground">{page * PAGE_SIZE + idx + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-foreground truncate max-w-[140px]">
                              {client.customer_name || "—"}
                            </span>
                            {client.gender && (
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {client.gender === "male" ? "♂" : client.gender === "female" ? "♀" : ""}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {age !== null ? (
                            <span className="text-xs font-semibold text-foreground">{age}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDob(client.date_of_birth)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[170px]">{client.customer_email}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{client.client_phone || "—"}</TableCell>
                        <TableCell className="text-xs text-foreground font-medium truncate max-w-[100px]">{extractCity(client.client_address)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={client.visit_count > 3 ? "default" : "secondary"} className="text-xs">
                            {client.visit_count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-foreground text-right">€{client.total_spent.toFixed(0)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">
                          <VenueBadge
                            booking={{
                              gym_id: client.last_venue_type === "gym" ? "x" : null,
                              hotel_id: client.last_venue_type === "hotel" ? "x" : null,
                              gyms: client.last_venue_type === "gym" ? { name: client.last_venue || "—" } : null,
                              hotels: client.last_venue_type === "hotel" ? { name: client.last_venue || "—" } : null,
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setSelectedClient(client); }}>
                            <Eye className="w-3.5 h-3.5 text-primary" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} von {filtered.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground px-2">{page + 1} / {totalPages}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      <ClientDetailDialog client={selectedClient} onClose={() => setSelectedClient(null)} />

      <PrintableContainer
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        filename={`MASSAVO-Kundendaten-${dateFrom}-${dateTo}.pdf`}
        title="Kundendaten-Bericht"
      >
        <PrintableClientReport clients={filtered} dateFrom={dateFrom} dateTo={dateTo} stats={stats} />
      </PrintableContainer>
    </AdminLayout>
  );
}

// ── Stats Card ──
function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-2.5">
        <Icon className={`w-4 h-4 ${color}`} />
        <div>
          <div className="text-lg font-bold text-foreground leading-tight">{value}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Client Detail Dialog ──
function ClientDetailDialog({ client, onClose }: { client: ClientRow | null; onClose: () => void }) {
  if (!client) return null;
  const latestBookingId = client.bookings[0]?.id;
  const age = calcAge(client.date_of_birth);

  const { data: bodyAreas = [] } = useQuery({
    queryKey: ["admin-client-body-areas", latestBookingId],
    enabled: !!latestBookingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_body_areas")
        .select("*")
        .eq("booking_id", latestBookingId);
      if (error) throw error;
      return (data || []).map((a: any) => ({
        code: a.area_code, label: a.area_label, side: a.side as "front" | "back",
        painIntensity: a.pain_intensity || 5, isFocus: a.is_focus || false, notes: a.notes || "",
      })) as SelectedArea[];
    },
  });

  return (
    <Dialog open={!!client} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            {client.customer_name || "Unbekannt"} – Kundenprofil
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-sm">
                <InfoItem label="Name" value={client.customer_name || "—"} />
                <InfoItem label="Email" value={client.customer_email} />
                <InfoItem label="Telefon" value={client.client_phone || "—"} />
                <InfoItem label="Geschlecht" value={client.gender === "male" ? "Männlich" : client.gender === "female" ? "Weiblich" : "—"} />
                <InfoItem label="Alter" value={age !== null ? `${age} Jahre` : "—"} />
                <InfoItem label="Geburtsdatum" value={formatDob(client.date_of_birth)} />
                <InfoItem label="Stadt" value={extractCity(client.client_address)} />
                <InfoItem label="Adresse" value={client.client_address || "—"} />
                <InfoItem label="Besuche" value={String(client.visit_count)} />
                <InfoItem label="Gesamtumsatz" value={`€${client.total_spent.toFixed(2)}`} />
                <InfoItem label="Bewertung" value={client.avg_rating ? `⭐ ${client.avg_rating.toFixed(1)}` : "—"} />
                <InfoItem label="Erster Besuch" value={format(parseISO(client.first_visit), "dd.MM.yyyy")} />
                <InfoItem label="Letzter Besuch" value={format(parseISO(client.last_visit), "dd.MM.yyyy")} />
                <InfoItem label="Letzter Service" value={client.last_service || "—"} />
                <InfoItem label="Letzter Therapeut" value={client.last_therapist || "—"} />
                <InfoItem
                  label={client.last_venue_type === "hotel" ? "Letztes Hotel" : "Letztes Gym"}
                  value={client.last_venue || "—"}
                />
                <InfoItem label="Kommunikation" value={
                  client.communication_preference === "silent" ? "🤫 Ruhig" :
                  client.communication_preference === "light_talk" ? "💬 Leichte Unterhaltung" :
                  client.communication_preference === "chatty" ? "🗣️ Gerne Gespräch" : "—"
                } />
                <InfoItem label="Schwangerschaft" value={
                  client.pregnancy_status === "not_pregnant" ? "Nicht schwanger" :
                  client.pregnancy_status === "pregnant" ? "Schwanger" :
                  client.pregnancy_status === "postpartum" ? "Nach der Geburt" : "—"
                } />
              </div>
            </CardContent>
          </Card>

          {client.therapist_advice && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Therapeuten-Empfehlung</h3>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap bg-background/60 rounded-lg p-3 border border-border/30">
                  {client.therapist_advice}
                </p>
              </CardContent>
            </Card>
          )}

          {latestBookingId && (
            <SmartRecoveryProfile
              bookingId={latestBookingId}
              customerEmail={client.customer_email}
              currentAreas={bodyAreas}
              clientGender={client.gender === "male" ? "male" : client.gender === "female" ? "female" : null}
            />
          )}

          <StaffPainEvolutionCard customerEmail={client.customer_email} />

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Besuchsverlauf ({client.bookings.length})
            </h3>
            {client.bookings.map((b: any) => (
              <Card key={b.id} className="border-border/60">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-medium text-foreground">
                        {format(parseISO(b.booking_date), "dd.MM.yyyy")} · {b.booking_time?.slice(0, 5)}
                      </span>
                      <BookingStatusBadge status={b.status} />
                    </div>
                    <span className="text-sm font-semibold text-foreground">€{(b.total_amount || 0).toFixed(0)}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{b.venue_type === "hotel" ? "🏨" : "🏋️"} {b.venue_name || "—"}</span>
                    <span>💆 {b.service_name || "—"}</span>
                    <span>👤 {b.therapist_name || "—"}</span>
                  </div>
                  {b.notes && (
                    <div className="bg-accent/10 rounded-md p-2 border border-accent/20">
                      <div className="flex items-center gap-1.5 mb-1">
                        <MessageCircle className="w-3 h-3 text-accent-foreground" />
                        <span className="text-[10px] font-semibold text-accent-foreground uppercase tracking-wider">Kunden-Anmerkungen</span>
                      </div>
                      <p className="text-xs text-foreground whitespace-pre-wrap">{b.notes}</p>
                    </div>
                  )}
                  {b.feedback?.therapist_advice && (
                    <div className="bg-primary/5 rounded-md p-2 border border-primary/20">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Stethoscope className="w-3 h-3 text-primary" />
                        <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Therapeuten-Empfehlung</span>
                      </div>
                      <p className="text-xs text-foreground whitespace-pre-wrap">{b.feedback.therapist_advice}</p>
                    </div>
                  )}
                  {b.feedback?.therapist_rating && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 rounded-md p-2 border border-amber-200 dark:border-amber-800/30">
                      <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">⭐ Kundenbewertung</span>
                      <div className="flex gap-4 text-xs mt-1">
                        <span>Therapeut: <strong className="text-foreground">{b.feedback.therapist_rating}/5</strong></span>
                        <span>Service: <strong className="text-foreground">{b.feedback.service_rating}/5</strong></span>
                      </div>
                      {b.feedback.comment && <p className="text-xs text-foreground mt-1 italic">„{b.feedback.comment}"</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground block">{label}</span>
      <span className="font-medium text-foreground text-sm">{value}</span>
    </div>
  );
}

function BookingStatusBadge({ status }: { status: string | null }) {
  switch (status) {
    case "confirmed": return <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30 text-[10px]">Bestätigt</Badge>;
    case "completed": return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30 text-[10px]">Abgeschlossen</Badge>;
    case "no_show": return <Badge variant="destructive" className="text-[10px]">No-Show</Badge>;
    case "pending": return <Badge variant="secondary" className="text-[10px]">Ausstehend</Badge>;
    default: return <Badge variant="secondary" className="text-[10px]">{status || "—"}</Badge>;
  }
}

// ══════════════════════════════════════════════════════════════
// PRINTABLE REPORT – A3 Landscape, Table + Detail Rows
// ══════════════════════════════════════════════════════════════

const printPageStyle = `
@media print { @page { size: A3 landscape; margin: 8mm 10mm; } }
`;

function PrintableClientReport({
  clients, dateFrom, dateTo, stats,
}: {
  clients: ClientRow[];
  dateFrom: string;
  dateTo: string;
  stats: { totalClients: number; totalVisits: number; totalRevenue: number; returningClients: number };
}) {
  const venueGroups = useMemo(() => {
    const groups = new Map<string, ClientRow[]>();
    clients.forEach((c) => {
      const label = c.last_venue
        ? `${c.last_venue_type === "hotel" ? "Hotel — " : "Gym — "}${c.last_venue}`
        : "Ohne Zuordnung";
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(c);
    });
    return Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === "Ohne Zuordnung") return 1;
      if (b[0] === "Ohne Zuordnung") return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [clients]);

  const dateRange = `${format(parseISO(dateFrom), "dd.MM.yyyy")} – ${format(parseISO(dateTo), "dd.MM.yyyy")}`;

  return (
    <>
      <style>{printPageStyle}</style>
      <div style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif", color: "#1c1917" }}>
        {venueGroups.map(([venueLabel, venueClients], groupIdx) => {
          const venueStats = {
            clients: venueClients.length,
            visits: venueClients.reduce((s, c) => s + c.visit_count, 0),
            revenue: venueClients.reduce((s, c) => s + c.total_spent, 0),
            returning: venueClients.filter((c) => c.visit_count > 1).length,
          };

          return (
            <div key={venueLabel} style={{ pageBreakBefore: groupIdx > 0 ? "always" : undefined }}>
              <EnterpriseReportLayout
                title="Kundendaten-Bericht"
                subtitle={venueLabel}
                dateRange={dateRange}
                reportType="daily_booking"
                category="administrative"
                showSignatureArea={false}
              >
                <ReportSection title="Zusammenfassung">
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                    <EnterpriseSummaryCard value={venueStats.clients} label="Kunden" variant="primary" />
                    <EnterpriseSummaryCard value={venueStats.visits} label="Besuche" variant="neutral" />
                    <EnterpriseSummaryCard value={`€${venueStats.revenue.toFixed(0)}`} label="Umsatz" variant="accent" />
                    <EnterpriseSummaryCard value={venueStats.returning} label="Stammkunden" variant="success" />
                  </div>
                </ReportSection>

                <ReportSection title={`Kundenliste (${venueClients.length})`}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", fontFamily: "'Inter', sans-serif" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#7a4a2a", color: "#fff" }}>
                        {["Nr.", "Kundenname", "Geschl.", "Alter", "Geburtsdatum", "Email", "Telefon", "Stadt", "Besuche", "Umsatz", "Letzter Service", "Therapeut", "Erster Besuch", "Letzter Besuch"].map((h) => (
                          <th key={h} style={pTh}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {venueClients.map((c, i) => {
                        const age = calcAge(c.date_of_birth);
                        const hasDetails = !!(c.client_address || c.communication_preference || c.pregnancy_status || c.therapist_advice || c.avg_rating);
                        return (
                          <ClientPrintRows key={c.customer_email} client={c} index={i + 1} age={age} hasDetails={hasDetails} />
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ backgroundColor: "#7a4a2a" }}>
                        <td colSpan={8} style={{ ...pTd, fontWeight: 700, color: "#fff", fontSize: "10px" }}>GESAMT</td>
                        <td style={{ ...pTd, textAlign: "center", fontWeight: 700, color: "#fff" }}>{venueStats.visits}</td>
                        <td style={{ ...pTd, fontWeight: 700, color: "#fff" }}>€{venueStats.revenue.toFixed(0)}</td>
                        <td colSpan={4} style={pTd} />
                      </tr>
                    </tfoot>
                  </table>
                </ReportSection>
              </EnterpriseReportLayout>
            </div>
          );
        })}

        {/* Global summary */}
        {venueGroups.length > 1 && (
          <div style={{ pageBreakBefore: "always" }}>
            <EnterpriseReportLayout
              title="Gesamtübersicht – Alle Standorte"
              dateRange={dateRange}
              reportType="admin_overview"
              category="administrative"
              showSignatureArea={false}
            >
              <ReportSection title="Standort-Vergleich">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", fontFamily: "'Inter', sans-serif" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#7a4a2a", color: "#fff" }}>
                      {["Standort", "Kunden", "Besuche", "Umsatz", "Stammkunden", "⌀ Umsatz/Kunde"].map((h) => (
                        <th key={h} style={pTh}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {venueGroups.map(([venueLabel, venueClients], i) => {
                      const rev = venueClients.reduce((s, c) => s + c.total_spent, 0);
                      return (
                        <tr key={venueLabel} style={{ borderBottom: "1px solid #e5e2dd", backgroundColor: i % 2 === 0 ? "#fff" : "#faf9f7" }}>
                          <td style={{ ...pTd, fontWeight: 600 }}>{venueLabel}</td>
                          <td style={{ ...pTd, textAlign: "center" }}>{venueClients.length}</td>
                          <td style={{ ...pTd, textAlign: "center" }}>{venueClients.reduce((s, c) => s + c.visit_count, 0)}</td>
                          <td style={{ ...pTd, fontWeight: 600 }}>€{rev.toFixed(0)}</td>
                          <td style={{ ...pTd, textAlign: "center" }}>{venueClients.filter((c) => c.visit_count > 1).length}</td>
                          <td style={pTd}>€{venueClients.length > 0 ? (rev / venueClients.length).toFixed(0) : "0"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: "#7a4a2a" }}>
                      <td style={{ ...pTd, fontWeight: 700, color: "#fff" }}>GESAMT</td>
                      <td style={{ ...pTd, textAlign: "center", fontWeight: 700, color: "#fff" }}>{stats.totalClients}</td>
                      <td style={{ ...pTd, textAlign: "center", fontWeight: 700, color: "#fff" }}>{stats.totalVisits}</td>
                      <td style={{ ...pTd, fontWeight: 700, color: "#fff" }}>€{stats.totalRevenue.toFixed(0)}</td>
                      <td style={{ ...pTd, textAlign: "center", fontWeight: 700, color: "#fff" }}>{stats.returningClients}</td>
                      <td style={{ ...pTd, fontWeight: 700, color: "#fff" }}>€{stats.totalClients > 0 ? (stats.totalRevenue / stats.totalClients).toFixed(0) : "0"}</td>
                    </tr>
                  </tfoot>
                </table>
              </ReportSection>
            </EnterpriseReportLayout>
          </div>
        )}
      </div>
    </>
  );
}

/** Main row + detail sub-row for each client */
function ClientPrintRows({ client, index, age, hasDetails }: {
  client: ClientRow; index: number; age: number | null; hasDetails: boolean;
}) {
  const rowBg = index % 2 === 0 ? "#faf9f7" : "#ffffff";
  const genderLabel = client.gender === "male" ? "M" : client.gender === "female" ? "W" : "—";

  const detailItems: string[] = [];
  if (client.client_address) detailItems.push(`📍 ${client.client_address}`);
  if (client.communication_preference) {
    const cp = client.communication_preference === "silent" ? "Ruhig" :
      client.communication_preference === "light_talk" ? "Leichte Unterhaltung" :
      client.communication_preference === "chatty" ? "Gerne Gespräch" : client.communication_preference;
    detailItems.push(`💬 ${cp}`);
  }
  if (client.pregnancy_status && client.pregnancy_status !== "not_pregnant") {
    const ps = client.pregnancy_status === "pregnant" ? "Schwanger" :
      client.pregnancy_status === "postpartum" ? "Nach der Geburt" : client.pregnancy_status;
    detailItems.push(`🤰 ${ps}`);
  }
  if (client.avg_rating) detailItems.push(`⭐ ${client.avg_rating.toFixed(1)}/5`);
  if (client.therapist_advice) detailItems.push(`🩺 ${client.therapist_advice}`);

  return (
    <>
      {/* Main Row */}
      <tr style={{ borderBottom: hasDetails && detailItems.length > 0 ? "none" : "1px solid #e5e2dd", backgroundColor: rowBg }}>
        <td style={{ ...pTd, color: "#9ca3af", fontWeight: 600, textAlign: "center" }}>{index}</td>
        <td style={{ ...pTd, fontWeight: 700, color: "#1a1a1a" }}>
          {client.customer_name || "—"}
          {client.visit_count > 1 && (
            <span style={{ marginLeft: "6px", fontSize: "7px", fontWeight: 700, color: "#16a34a", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "3px", padding: "1px 4px", verticalAlign: "middle" }}>
              STAMM
            </span>
          )}
        </td>
        <td style={{ ...pTd, textAlign: "center" }}>{genderLabel}</td>
        <td style={{ ...pTd, textAlign: "center", fontWeight: 600 }}>{age !== null ? age : "—"}</td>
        <td style={pTd}>{formatDob(client.date_of_birth)}</td>
        <td style={{ ...pTd, color: "#4b5563" }}>{client.customer_email}</td>
        <td style={{ ...pTd, whiteSpace: "nowrap" }}>{client.client_phone || "—"}</td>
        <td style={{ ...pTd, fontWeight: 500 }}>{extractCity(client.client_address)}</td>
        <td style={{ ...pTd, textAlign: "center", fontWeight: 700, color: client.visit_count > 1 ? "#16a34a" : "#1c1917" }}>{client.visit_count}</td>
        <td style={{ ...pTd, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>€{client.total_spent.toFixed(2)}</td>
        <td style={{ ...pTd, color: "#4b5563" }}>{client.last_service || "—"}</td>
        <td style={{ ...pTd, color: "#4b5563" }}>{client.last_therapist || "—"}</td>
        <td style={{ ...pTd, fontSize: "9px" }}>{format(parseISO(client.first_visit), "dd.MM.yy")}</td>
        <td style={{ ...pTd, fontSize: "9px" }}>{format(parseISO(client.last_visit), "dd.MM.yy")}</td>
      </tr>

      {/* Detail Sub-Row */}
      {detailItems.length > 0 && (
        <tr style={{ borderBottom: "1px solid #e5e2dd", backgroundColor: rowBg }}>
          <td style={{ padding: 0 }} />
          <td colSpan={13} style={{ padding: "2px 8px 6px 8px", fontSize: "9px", color: "#6b7280", lineHeight: "1.5" }}>
            {detailItems.join("  ·  ")}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Print styles ──
const pTh: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 8px",
  fontWeight: 700,
  fontSize: "9px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
  color: "#fff",
};

const pTd: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: "10px",
  color: "#1c1917",
  lineHeight: "1.3",
};
