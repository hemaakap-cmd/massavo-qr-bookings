import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, Lock, Landmark } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCountryData } from "@/hooks/useCountry";
import { format, startOfMonth, endOfMonth } from "date-fns";
import FinancialFilters from "@/components/admin/financial/FinancialFilters";
import FinancialSummaryCards from "@/components/admin/financial/FinancialSummaryCards";
import FinancialTable from "@/components/admin/financial/FinancialTable";
import FinancialExport from "@/components/admin/financial/FinancialExport";
import GymCommissionList from "@/components/admin/financial/GymCommissionList";
import PrintableFinancialReport from "@/components/admin/financial/PrintableFinancialReport";
import PrintableContainer from "@/components/print/PrintableContainer";
// Gym-specific components (privacy-restricted views)
import GymFinancialSummaryCards from "@/components/admin/financial/GymFinancialSummaryCards";
import GymFinancialTable from "@/components/admin/financial/GymFinancialTable";
import GymFinancialExport from "@/components/admin/financial/GymFinancialExport";
import GymPrintableReport from "@/components/admin/financial/GymPrintableReport";
import type { AnonymizedBooking, FinancialSummary, GymCommission } from "@/types/financial";

/** Venue = gym OR hotel (commission-bearing entity) */
interface Venue {
  id: string;
  name: string;
  commission_percentage: number | null;
  type: "gym" | "hotel";
}

/**
 * Masks a customer name for privacy (GDPR compliance)
 * Shows family name only for multi-part names, or first name for single names
 * Example: "Max Mustermann" -> "Mustermann", "Sarah" -> "Sarah"
 */
const maskCustomerName = (name: string | null, id: string): string => {
  if (!name || name.trim() === "") {
    // Use anonymized ID if no name
    return `Client-${id.substring(0, 6).toUpperCase()}`;
  }
  
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    // Show only the family name (last name)
    return parts[parts.length - 1];
  }
  // Single name - show as is (likely first name)
  return name.trim();
};

const AdminFinancial = () => {
  const { countryId } = useAuth();
  const { selectedCountry, formatCurrency } = useCountryData(countryId);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [bookings, setBookings] = useState<AnonymizedBooking[]>([]);
  const [gymCommissions, setGymCommissions] = useState<GymCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [gymFilter, setGymFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [showPrintView, setShowPrintView] = useState(false);
  const { toast } = useToast();

  /** Loads gyms + hotels for the selected country into a single venue list. */
  const fetchVenues = async () => {
    const gymQ = supabase.from("gyms").select("id, name, commission_percentage").order("name");
    const hotelQ = supabase.from("hotels").select("id, name, commission_percentage").order("name");
    const [{ data: gymsData }, { data: hotelsData }] = await Promise.all([
      selectedCountry ? gymQ.eq("country_id", selectedCountry.id) : gymQ,
      selectedCountry ? hotelQ.eq("country_id", selectedCountry.id) : hotelQ,
    ]);
    const merged: Venue[] = [
      ...(gymsData || []).map((g: any) => ({ ...g, type: "gym" as const })),
      ...(hotelsData || []).map((h: any) => ({ ...h, type: "hotel" as const, name: `🏨 ${h.name}` })),
    ];
    setVenues(merged);
  };

  /** Build a venue OR filter covering both gym_id and hotel_id. */
  const buildVenueScope = () => {
    const gymIds = venues.filter((v) => v.type === "gym").map((v) => v.id);
    const hotelIds = venues.filter((v) => v.type === "hotel").map((v) => v.id);
    const parts: string[] = [];
    if (gymIds.length) parts.push(`gym_id.in.(${gymIds.join(",")})`);
    if (hotelIds.length) parts.push(`hotel_id.in.(${hotelIds.join(",")})`);
    return parts.length ? parts.join(",") : null;
  };

  const fetchBookings = async () => {
    setLoading(true);

    let query = supabase
      .from("bookings")
      .select(`
        id,
        customer_name,
        booking_date,
        booking_time,
        total_amount,
        gym_id,
        hotel_id,
        gyms(name, commission_percentage, country_id),
        hotels(name, commission_percentage, country_id),
        services(name)
      `)
      .gte("booking_date", dateFrom)
      .lte("booking_date", dateTo)
      .in("status", ["confirmed", "completed"])
      .eq("payment_status", "paid")
      .order("booking_date", { ascending: false });

    if (gymFilter !== "all") {
      const venue = venues.find((v) => v.id === gymFilter);
      if (venue?.type === "hotel") {
        query = query.eq("hotel_id", gymFilter);
      } else {
        query = query.eq("gym_id", gymFilter);
      }
    } else if (selectedCountry && venues.length > 0) {
      const orFilter = buildVenueScope();
      if (orFilter) query = query.or(orFilter);
      else { setBookings([]); setLoading(false); return; }
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setBookings([]);
    } else {
      // Transform to anonymized format
      const anonymized: AnonymizedBooking[] = (data || []).map((b: any) => {
        const venueRel = b.hotels || b.gyms;
        const venueType: "gym" | "hotel" = b.hotel_id ? "hotel" : "gym";
        const commissionPct = venueRel?.commission_percentage ?? 20;
        const commissionAmt = (b.total_amount * commissionPct) / 100;
        const venueName = venueRel?.name
          ? (venueType === "hotel" ? `🏨 ${venueRel.name}` : venueRel.name)
          : "Unknown";

        return {
          id: b.id,
          masked_customer: maskCustomerName(b.customer_name, b.id),
          booking_date: b.booking_date,
          booking_time: b.booking_time,
          service_name: b.services?.name || "Unknown",
          session_price: b.total_amount,
          gym_name: venueName,
          gym_id: b.hotel_id || b.gym_id,
          commission_percentage: commissionPct,
          commission_amount: commissionAmt,
        };
      });
      
      setBookings(anonymized);
    }
    setLoading(false);
  };

  const calculateGymCommissions = async () => {
    let query = supabase
      .from("bookings")
      .select(`
        gym_id,
        hotel_id,
        total_amount,
        gyms(id, name, commission_percentage),
        hotels(id, name, commission_percentage)
      `)
      .gte("booking_date", dateFrom)
      .lte("booking_date", dateTo)
      .in("status", ["confirmed", "completed"])
      .eq("payment_status", "paid");

    if (selectedCountry && venues.length > 0) {
      const orFilter = buildVenueScope();
      if (orFilter) query = query.or(orFilter);
      else { setGymCommissions([]); return; }
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error calculating commissions:", error);
      return;
    }

    // Aggregate by venue (gym or hotel)
    const venueMap = new Map<string, GymCommission>();
    
    (data || []).forEach((b: any) => {
      const venueRel = b.hotels || b.gyms;
      const venueId = b.hotel_id || b.gym_id;
      if (!venueId) return;
      const isHotel = !!b.hotel_id;
      const venueName = venueRel?.name
        ? (isHotel ? `🏨 ${venueRel.name}` : venueRel.name)
        : "Unknown";
      const commissionPct = venueRel?.commission_percentage ?? 20;
      const commissionAmt = (b.total_amount * commissionPct) / 100;
      
      if (venueMap.has(venueId)) {
        const existing = venueMap.get(venueId)!;
        existing.total_revenue += b.total_amount;
        existing.total_commission += commissionAmt;
        existing.booking_count += 1;
      } else {
        venueMap.set(venueId, {
          id: venueId,
          name: venueName,
          commission_percentage: commissionPct,
          total_revenue: b.total_amount,
          total_commission: commissionAmt,
          booking_count: 1,
        });
      }
    });
    
    setGymCommissions(Array.from(venueMap.values()));
  };

  useEffect(() => {
    fetchVenues();
    setGymFilter("all"); // Reset gym filter when country changes
  }, [selectedCountry?.id]);

  useEffect(() => {
    fetchBookings();
    calculateGymCommissions();
  }, [gymFilter, dateFrom, dateTo, selectedCountry?.id, venues.length]);

  const handleCommissionUpdated = () => {
    fetchVenues();
    fetchBookings();
    calculateGymCommissions();
  };

  const handlePrint = useCallback(() => {
    setShowPrintView(true);
  }, []);

  const handleAfterPrint = useCallback(() => {
    setShowPrintView(false);
  }, []);

  // Calculate summary (admin-only data)
  const summary: FinancialSummary = {
    total_revenue: bookings.reduce((sum, b) => sum + b.session_price, 0),
    total_commission: bookings.reduce((sum, b) => sum + b.commission_amount, 0),
    total_net: bookings.reduce((sum, b) => sum + (b.session_price - b.commission_amount), 0),
    booking_count: bookings.length,
  };

  const selectedGymName = gymFilter === "all" 
    ? "All Venues"
    : venues.find((v) => v.id === gymFilter)?.name || "Unknown";

  const selectedGymCommission = gymFilter !== "all"
    ? venues.find((v) => v.id === gymFilter)?.commission_percentage ?? 20
    : 20;

  const dateRange = `${format(new Date(dateFrom), "dd MMM yyyy")} - ${format(new Date(dateTo), "dd MMM yyyy")}`;

  // Determine if viewing gym-specific data (restricted view) or admin overview
  const isGymSpecificView = gymFilter !== "all";

  const printFilename = isGymSpecificView 
    ? `commission-statement-${selectedGymName.replace(/\s+/g, "-")}-${dateRange.replace(/\s+/g, "")}.pdf`
    : `financial-report-${dateRange.replace(/\s+/g, "")}.pdf`;

  return (
    <>
      {/* Print View - Uses PDF generation for reliable mobile support */}
      <PrintableContainer 
        isOpen={showPrintView} 
        onClose={handleAfterPrint}
        filename={printFilename}
        title={isGymSpecificView ? "Commission Statement" : "Financial Report"}
      >
        {isGymSpecificView ? (
          <GymPrintableReport
            bookings={bookings}
            gymName={selectedGymName}
            commissionPercentage={selectedGymCommission}
            totalCommission={summary.total_commission}
            sessionCount={summary.booking_count}
            dateRange={dateRange}
          />
        ) : (
          <PrintableFinancialReport
            bookings={bookings}
            summary={summary}
            gymName={selectedGymName}
            dateRange={dateRange}
          />
        )}
      </PrintableContainer>

      <AdminLayout>
        <div className="space-y-6 print:hidden">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
                {isGymSpecificView ? "Commission Statement" : "Financial Dashboard"}
                {selectedCountry && (
                  <span className="text-base font-normal text-muted-foreground">
                    — {selectedCountry.name} ({selectedCountry.currency_code})
                  </span>
                )}
              </h2>
              <p className="text-muted-foreground flex items-center gap-2">
                {isGymSpecificView ? (
                  <>
                    <Lock className="w-4 h-4" />
                    Gym-specific view - Commission data only
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    Admin view - Full financial reporting
                  </>
                )}
              </p>
            </div>
            
            {/* Use gym-specific export when viewing single gym */}
            {isGymSpecificView ? (
              <GymFinancialExport
                bookings={bookings}
                gymName={selectedGymName}
                commissionPercentage={selectedGymCommission}
                totalCommission={summary.total_commission}
                sessionCount={summary.booking_count}
                dateRange={dateRange}
                onPrint={handlePrint}
              />
            ) : (
              <FinancialExport
                bookings={bookings}
                summary={summary}
                gymName={selectedGymName}
                dateRange={dateRange}
                onPrint={handlePrint}
              />
            )}
          </div>

          {/* Filters */}
          <div className="bg-card rounded-lg border border-border p-4">
            <FinancialFilters
              gyms={venues}
              gymFilter={gymFilter}
              onGymFilterChange={setGymFilter}
              dateFrom={dateFrom}
              onDateFromChange={setDateFrom}
              dateTo={dateTo}
              onDateToChange={setDateTo}
            />
          </div>

          {/* Privacy Notice for Gym-Specific View */}
          {isGymSpecificView && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
              <Lock className="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <p className="font-medium text-orange-800">Restricted View - {selectedGymName}</p>
                <p className="text-sm text-orange-700">
                  This view shows only commission-related data for this gym. 
                  Company revenue, profit margins, and other gyms' data are hidden for confidentiality.
                </p>
              </div>
            </div>
          )}

          {/* Country Financial Info */}
          {selectedCountry && !isGymSpecificView && (
            <div className="bg-accent/30 border border-border rounded-lg p-4 flex items-start gap-3">
              <Landmark className="w-5 h-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-foreground">
                  {selectedCountry.name} — {selectedCountry.currency_code} ({selectedCountry.currency_symbol})
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1 text-sm text-muted-foreground">
                  <span>
                    {Number(selectedCountry.tax_rate) > 0
                      ? `${selectedCountry.tax_label}: ${selectedCountry.tax_rate}%`
                      : selectedCountry.tax_label}
                  </span>
                  {selectedCountry.bank_name && <span>Bank: {selectedCountry.bank_name}</span>}
                  {selectedCountry.tax_id_value && <span>{selectedCountry.tax_id_label}: {selectedCountry.tax_id_value}</span>}
                </div>
                {selectedCountry.invoice_footer_note && (
                  <p className="text-xs text-muted-foreground mt-1 italic">{selectedCountry.invoice_footer_note}</p>
                )}
              </div>
            </div>
          )}

          {/* Summary Cards - Different for gym vs admin view */}
          {isGymSpecificView ? (
            <GymFinancialSummaryCards
              gymId={gymFilter}
              gymName={selectedGymName}
              commissionPercentage={selectedGymCommission}
              totalCommission={summary.total_commission}
              sessionCount={summary.booking_count}
              onCommissionUpdated={handleCommissionUpdated}
            />
          ) : (
            <FinancialSummaryCards summary={summary} gymName={undefined} currencySymbol={selectedCountry?.currency_symbol || "€"} />
          )}

          {/* Tabs for different views */}
          <Tabs defaultValue="transactions" className="space-y-4">
            <TabsList>
              <TabsTrigger value="transactions">
                {isGymSpecificView ? "Eligible Sessions" : "Transaction Details"}
              </TabsTrigger>
              {!isGymSpecificView && (
                <TabsTrigger value="commissions">Gym Commission Rates</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="transactions">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : isGymSpecificView ? (
                <GymFinancialTable 
                  bookings={bookings} 
                  commissionPercentage={selectedGymCommission}
                />
              ) : (
                <FinancialTable 
                  bookings={bookings} 
                  showGymColumn={true} 
                />
              )}
            </TabsContent>

            {!isGymSpecificView && (
              <TabsContent value="commissions">
                <GymCommissionList
                  gyms={venues}
                  commissions={gymCommissions}
                  onCommissionUpdated={handleCommissionUpdated}
                />
              </TabsContent>
            )}
          </Tabs>

          {/* Privacy Notice */}
          <div className="bg-muted/50 border border-border rounded-lg p-4 flex items-start gap-3">
            <Shield className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Privacy & Data Protection</p>
              <p className="text-sm text-muted-foreground">
                {isGymSpecificView ? (
                  <>
                    This report shows only commission-eligible data with anonymized client identifiers. 
                    No personal contact information, company revenue, or other gyms' data is included.
                  </>
                ) : (
                  <>
                    This view displays anonymized client data in compliance with GDPR. Personal contact 
                    information (email, phone, address) is not shown in financial reports. Full client 
                    details are available only in the restricted Bookings section.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </AdminLayout>
    </>
  );
};

export default AdminFinancial;
