import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClinicalBodyPanel } from "@/components/admin/clinical/ClinicalBodyPanel";
import { ChronicRiskAlert } from "@/components/admin/clinical/ChronicRiskAlert";
import { ClinicalUnlockGate } from "@/components/admin/clinical/ClinicalUnlockGate";
import { SmartRecoveryProfile } from "@/components/clinical/SmartRecoveryProfile";
import { useBookingBodyAreas, useBodyAreaHistory } from "@/hooks/useBodyAreas";
import ClinicalPdfReport from "@/components/admin/clinical/ClinicalPdfReport";
import PrintableContainer from "@/components/print/PrintableContainer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar, Clock, Mail, Printer, Building2, Hotel, User, AlertTriangle, Wifi, FileDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import PrintableBookingList from "@/components/admin/PrintableBookingList";
import TherapistBookingList from "@/components/admin/TherapistBookingList";
import { useAuth } from "@/hooks/useAuth";
import { useCountryData } from "@/hooks/useCountry";
import { useVenueContext } from "@/domain/venue/VenueContext";

interface Booking {
  id: string;
  customer_email: string;
  customer_name: string | null;
  booking_date: string;
  booking_time: string;
  status: string;
  payment_status: string;
  total_amount: number;
  created_at: string;
  gym_id: string | null;
  hotel_id: string | null;
  therapist_id: string | null;
  gender: string | null;
  pregnancy_status: string | null;
  gyms?: { name: string } | null;
  hotels?: { name: string } | null;
  services?: { name: string };
  therapists?: { name: string } | null;
}

interface Location {
  id: string;
  name: string;
  type: "gym" | "hotel";
}

interface Therapist {
  id: string;
  name: string;
}

const AdminBookings = () => {
  const { activeType } = useVenueContext();
  const { t } = useTranslation();
  const { countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [therapistFilter, setTherapistFilter] = useState("all");
  const [showPrintView, setShowPrintView] = useState(false);
  const [printMode, setPrintMode] = useState<"gym" | "therapist">("gym");
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const lastFetchRef = useRef<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showClinicalPdf, setShowClinicalPdf] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingCancel, setPendingCancel] = useState<{ id: string; status: string } | null>(null);
  const { toast } = useToast();

  const fetchLocations = async () => {
    let gymQuery = supabase.from("gyms").select("id, name").order("name");
    let hotelQuery = supabase.from("hotels").select("id, name").order("name");
    if (selectedCountry?.id) {
      gymQuery = gymQuery.eq("country_id", selectedCountry.id);
      hotelQuery = hotelQuery.eq("country_id", selectedCountry.id);
    }
    const [gymsRes, hotelsRes] = await Promise.all([gymQuery, hotelQuery]);
    setLocations([
      ...((gymsRes.data || []).map((g) => ({ id: g.id, name: g.name, type: "gym" as const }))),
      ...((hotelsRes.data || []).map((h) => ({ id: h.id, name: h.name, type: "hotel" as const }))),
    ]);
  };

  const fetchTherapists = async () => {
    // First get gym IDs for the country, then filter therapists
    let gymIds: string[] = [];
    if (selectedCountry?.id) {
      const { data: countryGyms } = await supabase
        .from("gyms")
        .select("id")
        .eq("country_id", selectedCountry.id);
      gymIds = (countryGyms || []).map(g => g.id);
      if (gymIds.length === 0) {
        setTherapists([]);
        return;
      }
    }

    let query = supabase
      .from("therapists")
      .select("id, name")
      .order("name");

    if (selectedCountry?.id && gymIds.length > 0) {
      query = query.in("gym_id", gymIds);
    }

    const { data, error } = await query;

    if (!error && data) {
      setTherapists(data);
    }
  };

  const fetchBookings = useCallback(async () => {
    let countryGymIds: string[] = [];
    let countryHotelIds: string[] = [];
    if (selectedCountry?.id) {
      const [{ data: cg }, { data: ch }] = await Promise.all([
        supabase.from("gyms").select("id").eq("country_id", selectedCountry.id),
        supabase.from("hotels").select("id").eq("country_id", selectedCountry.id),
      ]);
      countryGymIds = (cg || []).map((g) => g.id);
      countryHotelIds = (ch || []).map((h) => h.id);
      if (countryGymIds.length === 0 && countryHotelIds.length === 0) {
        setBookings([]);
        setLoading(false);
        return;
      }
    }

    let query = supabase
      .from("bookings")
      .select("*, gyms(name), hotels(name), services(name), therapists(name)")
      .order("booking_date", { ascending: true })
      .order("booking_time", { ascending: true });

    if (selectedCountry?.id) {
      const parts: string[] = [];
      if (countryGymIds.length > 0 && activeType !== "hotel") parts.push(`gym_id.in.(${countryGymIds.join(",")})`);
      if (countryHotelIds.length > 0 && activeType !== "gym") parts.push(`hotel_id.in.(${countryHotelIds.join(",")})`);
      if (parts.length > 0) query = query.or(parts.join(","));
    }

    if (statusFilter !== "all") query = query.eq("status", statusFilter);

    if (locationFilter !== "all") {
      const [type, id] = locationFilter.split(":");
      if (type === "gym") query = query.eq("gym_id", id);
      else if (type === "hotel") query = query.eq("hotel_id", id);
    }

    if (therapistFilter !== "all") query = query.eq("therapist_id", therapistFilter);

    const { data, error } = await query;

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setBookings(data || []);
      lastFetchRef.current = new Date().toISOString();
      
      // Detect duplicate conflicts
      detectConflicts(data || []);
    }
    setLoading(false);
  }, [statusFilter, locationFilter, therapistFilter, toast, selectedCountry?.id, activeType]);

  // Detect duplicate bookings (same location + date + time, gym OR hotel)
  const detectConflicts = (bookingList: Booking[]) => {
    const slotMap = new Map<string, Booking[]>();
    const activeBookings = bookingList.filter(b => !["cancelled", "rescheduled"].includes(b.status));
    
    activeBookings.forEach(b => {
      const locKey = b.gym_id ? `g:${b.gym_id}` : b.hotel_id ? `h:${b.hotel_id}` : "none";
      const key = `${locKey}|${b.booking_date}|${b.booking_time}`;
      if (!slotMap.has(key)) slotMap.set(key, []);
      slotMap.get(key)!.push(b);
    });
    
    const found: string[] = [];
    slotMap.forEach((group, key) => {
      if (group.length > 1) {
        const names = group.map(b => b.customer_name || b.customer_email).join(", ");
        found.push(`Duplicate at ${key.split("|").slice(1).join(" ")} — ${names}`);
      }
    });
    setConflicts(found);
  };

  useEffect(() => {
    fetchLocations();
    fetchTherapists();
  }, [selectedCountry?.id]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Real-time subscription for booking changes
  useEffect(() => {
    const channel = supabase
      .channel("admin-bookings-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        (payload) => {
          console.log("Booking change detected:", payload.eventType, payload.new);
          
          // Show toast for new/changed bookings
          if (payload.eventType === "INSERT") {
            const newBooking = payload.new as any;
            toast({
              title: "Neue Buchung",
              description: `${newBooking.customer_name || newBooking.customer_email} — ${newBooking.booking_date} ${newBooking.booking_time}`,
            });
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as any;
            if (updated.status === "cancelled") {
              toast({
                title: "Buchung storniert",
                description: `${updated.customer_name || updated.customer_email}`,
                variant: "destructive",
              });
            }
          }
          
          // Refetch to get joined data
          fetchBookings();
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBookings, toast]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Booking status updated" });
      fetchBookings();
    }
  };

  // Client-side search filter (no DB hit)
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleBookings = normalizedQuery
    ? bookings.filter((b) => {
        const haystack = [
          b.customer_name,
          b.customer_email,
          b.id,
          b.id?.slice(0, 8),
          b.booking_date,
          b.booking_time,
          b.gyms?.name,
          b.services?.name,
          b.therapists?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : bookings;

  const handlePrint = useCallback((mode: "gym" | "therapist") => {
    if (mode === "gym" && locationFilter === "all") {
      toast({
        title: "Select a Location",
        description: "Please select a specific gym or hotel to print its booking list.",
        variant: "destructive",
      });
      return;
    }
    if (mode === "therapist" && therapistFilter === "all") {
      toast({ 
        title: "Select a Therapist", 
        description: "Please select a specific therapist to print their booking list.", 
        variant: "destructive" 
      });
      return;
    }
    
    setPrintMode(mode);
    setShowPrintView(true);
  }, [locationFilter, therapistFilter, toast]);

  const handleAfterPrint = useCallback(() => {
    setShowPrintView(false);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-sage-light text-sage";
      case "completed":
        return "bg-green-100 text-green-700";
      case "cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gold-light text-gold";
    }
  };

  const getPaymentColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-700";
      case "refunded":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const selectedLocation =
    locationFilter === "all"
      ? null
      : locations.find((l) => `${l.type}:${l.id}` === locationFilter) || null;
  const selectedLocationName = selectedLocation?.name || "All Locations";

  const selectedTherapistName = therapistFilter === "all"
    ? "All Therapists"
    : therapists.find(t => t.id === therapistFilter)?.name || "Unknown Therapist";

  const printFilename = printMode === "therapist"
    ? `therapist-schedule-${selectedTherapistName.replace(/\s+/g, "-")}.pdf`
    : `booking-list-${selectedLocationName.replace(/\s+/g, "-")}.pdf`;

  return (
    <>
      {/* Print View - Uses PDF generation for reliable mobile support */}
      <PrintableContainer 
        isOpen={showPrintView} 
        onClose={handleAfterPrint}
        filename={printFilename}
        title={printMode === "therapist" ? "Therapist Schedule" : "Booking List"}
      >
        {printMode === "therapist" ? (
          <TherapistBookingList 
            bookings={bookings}
            therapistName={selectedTherapistName}
            isPrintView={true}
          />
        ) : (
          <PrintableBookingList 
            bookings={bookings}
            gymName={selectedLocationName}
          />
        )}
      </PrintableContainer>

      <AdminLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">Bookings</h2>
              <p className="text-muted-foreground">View and manage bookings by gym or hotel</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Location Filter (Gyms + Hotels) */}
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-56">
                  <Building2 className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.filter((l) => l.type === "gym").length > 0 && (
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Gyms</div>
                  )}
                  {locations
                    .filter((l) => l.type === "gym")
                    .map((loc) => (
                      <SelectItem key={`gym:${loc.id}`} value={`gym:${loc.id}`}>
                        <span className="inline-flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5" /> {loc.name}
                        </span>
                      </SelectItem>
                    ))}
                  {locations.filter((l) => l.type === "hotel").length > 0 && (
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Hotels</div>
                  )}
                  {locations
                    .filter((l) => l.type === "hotel")
                    .map((loc) => (
                      <SelectItem key={`hotel:${loc.id}`} value={`hotel:${loc.id}`}>
                        <span className="inline-flex items-center gap-2">
                          <Hotel className="w-3.5 h-3.5" /> {loc.name}
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              {/* Therapist Filter */}
              <Select value={therapistFilter} onValueChange={setTherapistFilter}>
                <SelectTrigger className="w-48">
                  <User className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by therapist" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Therapists</SelectItem>
                  {therapists.map((therapist) => (
                    <SelectItem key={therapist.id} value={therapist.id}>
                      {therapist.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {/* Print Location List Button */}
              <Button 
                variant="outline" 
                onClick={() => handlePrint("gym")}
                disabled={locationFilter === "all"}
                title={locationFilter === "all" ? "Select a location to print" : "Print location booking list"}
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Location List
              </Button>

              {/* Print Therapist List Button */}
              <Button 
                variant="outline" 
                onClick={() => handlePrint("therapist")}
                disabled={therapistFilter === "all"}
                title={therapistFilter === "all" ? "Select a therapist to print" : "Print therapist schedule"}
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Therapist List
              </Button>
            </div>
          </div>

          {/* Real-time status indicator */}
          <div className="flex items-center gap-2 text-xs">
            <Wifi className={`w-3 h-3 ${realtimeConnected ? "text-green-500" : "text-red-400"}`} />
            <span className={realtimeConnected ? "text-green-600" : "text-red-500"}>
              {realtimeConnected ? "Live" : "Offline"}
            </span>
          </div>

          {/* Search bar (client-side filter — no DB hit) */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("bookings.searchPlaceholder")}
              className="pl-9"
            />
          </div>

          {/* Conflict warnings */}
          {conflicts.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-destructive">⚠ Duplicate Booking Conflicts Detected</p>
                {conflicts.map((c, i) => (
                  <p key={i} className="text-sm text-destructive/80 mt-1">• {c}</p>
                ))}
              </div>
            </div>
          )}

          {/* Location Selection Notice */}
          {locationFilter === "all" && therapistFilter === "all" && (
            <div className="bg-muted/50 border border-border rounded-lg p-4 flex items-start gap-3">
              <Building2 className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Select a gym, hotel, or therapist to isolate bookings</p>
                <p className="text-sm text-muted-foreground">
                  Filter by gym or hotel to see location-specific bookings, or by therapist to see their schedule.
                </p>
              </div>
            </div>
          )}

          {/* Selected Location Header */}
          {locationFilter !== "all" && selectedLocation && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selectedLocation.type === "hotel" ? (
                    <Hotel className="w-5 h-5 text-primary" />
                  ) : (
                    <Building2 className="w-5 h-5 text-primary" />
                  )}
                  <div>
                    <p className="font-semibold text-foreground">
                      {selectedLocationName}
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {selectedLocation.type}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {bookings.length} booking{bookings.length !== 1 ? 's' : ''} found
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-foreground">
                    €{bookings.reduce((sum, b) => sum + b.total_amount, 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                </div>
              </div>
            </div>
          )}

          {/* Therapist Schedule View - Show when therapist is selected */}
          {therapistFilter !== "all" && !loading && (
            <TherapistBookingList
              bookings={bookings}
              therapistName={selectedTherapistName}
            />
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-sage" />
            </div>
          ) : therapistFilter !== "all" ? null : (
            <div className="bg-card rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date & Time</TableHead>
                    {locationFilter === "all" && <TableHead>Location</TableHead>}
                    <TableHead>Service</TableHead>
                    <TableHead>Therapist</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleBookings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={locationFilter === "all" ? 9 : 8} className="text-center py-8 text-muted-foreground">
                        {normalizedQuery ? t("bookings.noSearchResults") : "No bookings found."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleBookings.map((booking) => (
                      <TableRow 
                        key={booking.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedBooking(booking)}
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium">{booking.customer_name || "Guest"}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {booking.customer_email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-1 text-sm">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(booking.booking_date), "MMM d, yyyy")}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {booking.booking_time}
                            </span>
                          </div>
                        </TableCell>
                        {locationFilter === "all" && (
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 text-sm">
                              {booking.hotel_id ? (
                                <Hotel className="w-3.5 h-3.5 text-muted-foreground" />
                              ) : (
                                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                              {booking.hotels?.name || booking.gyms?.name || "—"}
                            </span>
                          </TableCell>
                        )}
                        <TableCell>{booking.services?.name}</TableCell>
                        <TableCell>{booking.therapists?.name || "Any"}</TableCell>
                        <TableCell className="font-medium">€{booking.total_amount}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs capitalize ${getStatusColor(booking.status)}`}>
                            {booking.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs capitalize ${getPaymentColor(booking.payment_status)}`}>
                            {booking.payment_status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <Select
                            value={booking.status}
                            onValueChange={(value) => {
                              if (value === "cancelled" && booking.status !== "cancelled") {
                                setPendingCancel({ id: booking.id, status: value });
                              } else {
                                updateStatus(booking.id, value);
                              }
                            }}
                          >
                            <SelectTrigger className="w-28 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="confirmed">Confirmed</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </AdminLayout>

      {/* Clinical Body Panel Dialog */}
      <Dialog open={!!selectedBooking} onOpenChange={open => !open && setSelectedBooking(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-foreground flex items-center justify-between">
              <span>Booking Details — {selectedBooking?.customer_name || selectedBooking?.customer_email}</span>
              {selectedBooking && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setShowClinicalPdf(true)}
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Clinical PDF
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <BookingDetailContent
              booking={selectedBooking}
              onOpenPdf={() => setShowClinicalPdf(true)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Clinical PDF Report */}
      {selectedBooking && (
        <ClinicalPdfPrintWrapper
          booking={selectedBooking}
          isOpen={showClinicalPdf}
          onClose={() => setShowClinicalPdf(false)}
        />
      )}

      {/* Print styles are now handled globally in index.css */}

      {/* Cancel confirmation dialog */}
      <AlertDialog open={!!pendingCancel} onOpenChange={(open) => !open && setPendingCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("bookings.cancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("bookings.cancelDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("bookings.cancelKeep")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingCancel) {
                  updateStatus(pendingCancel.id, pendingCancel.status);
                  setPendingCancel(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("bookings.cancelConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

/** Extracted booking detail content with hooks */
function BookingDetailContent({ booking, onOpenPdf }: { booking: Booking; onOpenPdf: () => void }) {
  const { data: bodyAreas = [] } = useBookingBodyAreas(booking.id);
  const { data: history = [] } = useBodyAreaHistory(booking.customer_email, booking.id);

  return (
    <div className="space-y-4">
      {/* Quick info */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">Date:</span>{" "}
          <span className="font-medium text-foreground">{booking.booking_date} {booking.booking_time}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Service:</span>{" "}
          <span className="font-medium text-foreground">{booking.services?.name}</span>
        </div>
        <div>
          <span className="text-muted-foreground">{booking.hotel_id ? "Hotel:" : "Gym:"}</span>{" "}
          <span className="font-medium text-foreground">{booking.hotels?.name || booking.gyms?.name || "—"}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Status:</span>{" "}
          <span className="font-medium text-foreground capitalize">{booking.status}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Gender:</span>{" "}
          <span className="font-medium text-foreground capitalize">{booking.gender || "—"}</span>
        </div>
        {booking.gender === "female" && (
          <div>
            <span className="text-muted-foreground">Pregnancy:</span>{" "}
            <span className="font-medium text-foreground">
              {booking.pregnancy_status === "not_pregnant" ? "✅ Pregnancy status confirmed" : "—"}
            </span>
          </div>
        )}
      </div>

      {/* Smart Recovery Profile */}
      <SmartRecoveryProfile
        bookingId={booking.id}
        customerEmail={booking.customer_email}
        currentAreas={bodyAreas}
        compact
      />

      {/* GDPR Protected Clinical Section */}
      <ClinicalUnlockGate bookingId={booking.id}>
        {/* Chronic Risk Alert */}
        <ChronicRiskAlert currentAreas={bodyAreas} history={history} />

        {/* Clinical Body Panel */}
        <ClinicalBodyPanel
          bookingId={booking.id}
          customerEmail={booking.customer_email}
        />
      </ClinicalUnlockGate>
    </div>
  );
}

/** Wraps the PDF report with data fetching */
function ClinicalPdfPrintWrapper({ booking, isOpen, onClose }: { booking: Booking; isOpen: boolean; onClose: () => void }) {
  const { data: bodyAreas = [] } = useBookingBodyAreas(booking.id);
  const { data: history = [] } = useBodyAreaHistory(booking.customer_email, booking.id);

  return (
    <PrintableContainer
      isOpen={isOpen}
      onClose={onClose}
      filename={`clinical-report-${booking.customer_name?.replace(/\s+/g, "-") || "client"}-${booking.booking_date}.pdf`}
      title="Clinical Body Mapping Report"
    >
      <ClinicalPdfReport
        booking={{
          customerName: booking.customer_name || "",
          customerEmail: booking.customer_email,
          bookingDate: booking.booking_date,
          bookingTime: booking.booking_time,
          gymName: booking.hotels?.name || booking.gyms?.name || "",
          serviceName: booking.services?.name || "",
          therapistName: booking.therapists?.name || "",
          status: booking.status,
          totalAmount: booking.total_amount,
        }}
        areas={bodyAreas}
        history={history}
      />
    </PrintableContainer>
  );
}

export default AdminBookings;
