import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { invalidateBookingAndAssignments } from "@/utils/cacheSync";
import { useAuth } from "@/hooks/useAuth";
import { useCountryData } from "@/hooks/useCountry";
import { fetchCountryVenueIds, buildVenueOrFilter, getVenueName, getVenueType } from "@/lib/venueUtils";
import { VenueBadge } from "@/components/shared/VenueBadge";
import {
  CalendarIcon,
  Send,
  UserCheck,
  Clock,
  MapPin,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Mail,
  MessageCircle,
} from "lucide-react";

interface Booking {
  id: string;
  booking_date: string;
  booking_time: string;
  customer_name: string | null;
  therapist_id: string | null;
  gym_id: string | null;
  hotel_id: string | null;
  service_id: string;
  status: string | null;
  services: { name: string; duration_minutes: number } | null;
  gyms: { name: string; address: string } | null;
  hotels: { name: string; address: string } | null;
  therapists: { id: string; name: string } | null;
}

interface Therapist {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

interface DailySend {
  id: string;
  therapist_id: string;
  assignment_date: string;
  delivery_method: "email" | "whatsapp" | "both";
  delivery_status: "pending" | "sent" | "failed" | "resent";
  sent_at: string | null;
  error_message: string | null;
}

export default function AdminDailyAssignments() {
  const { countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedBookings, setSelectedBookings] = useState<string[]>([]);
  const [bulkTherapistId, setBulkTherapistId] = useState<string>("");
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<"email" | "whatsapp" | "both">("email");
  const [therapistToSend, setTherapistToSend] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const dateString = format(selectedDate, "yyyy-MM-dd");

  // Get country venue IDs (gyms + hotels)
  const { data: venueIds = { gymIds: [], hotelIds: [] } } = useQuery({
    queryKey: ["country-venue-ids", selectedCountry?.id],
    queryFn: () => fetchCountryVenueIds(selectedCountry?.id),
  });
  const countryGymIds = venueIds.gymIds;
  const countryHotelIds = venueIds.hotelIds;
  const hasCountryFilter = !!selectedCountry?.id;
  const venueFilter = buildVenueOrFilter(countryGymIds, countryHotelIds);

  // Fetch bookings for selected date
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["daily-bookings", dateString, selectedCountry?.id, countryGymIds.length, countryHotelIds.length],
    queryFn: async () => {
      if (hasCountryFilter && countryGymIds.length === 0 && countryHotelIds.length === 0) return [];

      let query = supabase
        .from("bookings")
        .select(`
          id,
          booking_date,
          booking_time,
          customer_name,
          therapist_id,
          gym_id,
          hotel_id,
          service_id,
          status,
          services (name, duration_minutes),
          gyms (name, address),
          hotels (name, address),
          therapists (id, name)
        `)
        .eq("booking_date", dateString)
        .in("status", ["confirmed", "pending"])
        .order("booking_time");

      if (hasCountryFilter && venueFilter) query = query.or(venueFilter);

      const { data, error } = await query;
      if (error) throw error;
      return data as Booking[];
    },
    enabled: !hasCountryFilter || countryGymIds.length > 0 || countryHotelIds.length > 0,
  });

  // Fetch all therapists scoped by country
  const { data: therapists = [] } = useQuery({
    queryKey: ["therapists-list", selectedCountry?.id, countryGymIds.length],
    queryFn: async () => {
      if (hasCountryFilter && countryGymIds.length === 0 && countryHotelIds.length === 0) return [];

      let query = supabase
        .from("therapists")
        .select("id, name")
        .eq("is_available", true)
        .order("name");

      if (hasCountryFilter && countryGymIds.length > 0) {
        query = query.in("gym_id", countryGymIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Therapist[];
    },
    enabled: !hasCountryFilter || countryGymIds.length > 0 || countryHotelIds.length > 0,
  });

  // Fetch daily send status
  const { data: dailySends = [] } = useQuery({
    queryKey: ["daily-sends", dateString],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapist_daily_sends")
        .select("*")
        .eq("assignment_date", dateString);

      if (error) throw error;
      return data as DailySend[];
    },
  });

  // Update therapist assignment mutation
  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ bookingId, therapistId }: { bookingId: string; therapistId: string | null }) => {
      const { error } = await supabase
        .from("bookings")
        .update({ therapist_id: therapistId })
        .eq("id", bookingId);

      if (error) throw error;

      // Audit log
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase as any).from("admin_audit_log").insert({
          admin_user_id: user.id,
          action: "daily_assign",
          entity_type: "booking",
          entity_id: bookingId,
          changes: { therapist_id: therapistId, date: dateString },
        });
      }
    },
    onSuccess: () => {
      invalidateBookingAndAssignments(queryClient);
      queryClient.invalidateQueries({ queryKey: ["daily-bookings", dateString] });
      toast({ title: "Assignment updated", description: "Therapist assignment has been saved." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Bulk assignment mutation
  const bulkAssignMutation = useMutation({
    mutationFn: async ({ bookingIds, therapistId }: { bookingIds: string[]; therapistId: string }) => {
      const { error } = await supabase
        .from("bookings")
        .update({ therapist_id: therapistId })
        .in("id", bookingIds);

      if (error) throw error;

      // Audit log
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase as any).from("admin_audit_log").insert({
          admin_user_id: user.id,
          action: "daily_bulk_assign",
          entity_type: "booking",
          entity_id: bookingIds[0],
          changes: { booking_count: bookingIds.length, therapist_id: therapistId, date: dateString },
        });
      }
    },
    onSuccess: () => {
      invalidateBookingAndAssignments(queryClient);
      queryClient.invalidateQueries({ queryKey: ["daily-bookings", dateString] });
      setSelectedBookings([]);
      setBulkTherapistId("");
      toast({ title: "Bulk assignment complete", description: "Selected sessions have been assigned." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Send daily summary mutation
  const sendSummaryMutation = useMutation({
    mutationFn: async ({ therapistId, method }: { therapistId: string; method: "email" | "whatsapp" | "both" }) => {
      const response = await supabase.functions.invoke("send-therapist-daily-summary", {
        body: {
          therapist_id: therapistId,
          date: dateString,
          delivery_method: method,
        },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-sends", dateString] });
      setSendDialogOpen(false);
      setTherapistToSend(null);
      toast({ title: "Summary sent", description: "Daily summary has been sent to the therapist." });
    },
    onError: (error) => {
      toast({ title: "Send failed", description: error.message, variant: "destructive" });
    },
  });

  // Get therapists with assigned sessions for the day
  const therapistsWithSessions = therapists.filter((t) =>
    bookings.some((b) => b.therapist_id === t.id)
  );

  // Get send status for a therapist
  const getSendStatus = (therapistId: string) => {
    return dailySends.find((s) => s.therapist_id === therapistId);
  };

  // Mask customer name for GDPR
  const maskName = (name: string | null) => {
    if (!name) return "Kunde";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0] + "***";
    return parts[0][0] + "*** " + parts[parts.length - 1][0] + "***";
  };

  const handleSelectAll = () => {
    if (selectedBookings.length === bookings.length) {
      setSelectedBookings([]);
    } else {
      setSelectedBookings(bookings.map((b) => b.id));
    }
  };

  const handleBulkAssign = () => {
    if (!bulkTherapistId || selectedBookings.length === 0) return;
    bulkAssignMutation.mutate({ bookingIds: selectedBookings, therapistId: bulkTherapistId });
  };

  const openSendDialog = (therapistId: string) => {
    setTherapistToSend(therapistId);
    setSendDialogOpen(true);
  };

  const handleSend = () => {
    if (!therapistToSend) return;
    sendSummaryMutation.mutate({ therapistId: therapistToSend, method: deliveryMethod });
  };

  const getStatusBadge = (status: DailySend | undefined) => {
    if (!status) {
      return <Badge variant="outline" className="text-muted-foreground"><AlertCircle className="w-3 h-3 mr-1" />Not sent</Badge>;
    }
    switch (status.delivery_status) {
      case "sent":
        return <Badge className="bg-sage-light text-sage"><CheckCircle2 className="w-3 h-3 mr-1" />Sent</Badge>;
      case "resent":
        return <Badge className="bg-accent text-accent-foreground"><RefreshCw className="w-3 h-3 mr-1" />Resent</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline"><AlertCircle className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const getDeliveryIcon = (method: string) => {
    switch (method) {
      case "email": return <Mail className="w-3 h-3" />;
      case "whatsapp": return <MessageCircle className="w-3 h-3" />;
      case "both": return <><Mail className="w-3 h-3" /><MessageCircle className="w-3 h-3" /></>;
      default: return null;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Daily Assignments</h1>
            <p className="text-muted-foreground">Manage therapist assignments and send daily schedules</p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "PPP", { locale: de })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-background" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{bookings.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Assigned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-sage">
                {bookings.filter((b) => b.therapist_id).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Unassigned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gold">
                {bookings.filter((b) => !b.therapist_id).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Therapists</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{therapistsWithSessions.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Bulk Actions */}
        {selectedBookings.length > 0 && (
          <Card className="border-sage/30 bg-sage-light/20">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-sm font-medium">
                  {selectedBookings.length} session(s) selected
                </span>
                <Select value={bulkTherapistId} onValueChange={setBulkTherapistId}>
                  <SelectTrigger className="w-[200px] bg-background">
                    <SelectValue placeholder="Assign to therapist" />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    {therapists.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleBulkAssign}
                  disabled={!bulkTherapistId || bulkAssignMutation.isPending}
                  size="sm"
                >
                  <UserCheck className="w-4 h-4 mr-2" />
                  Assign Selected
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bookings Table */}
        <Card>
          <CardHeader>
            <CardTitle>Sessions for {format(selectedDate, "EEEE, d MMMM yyyy", { locale: de })}</CardTitle>
          </CardHeader>
          <CardContent>
            {bookingsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading sessions...</div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No sessions scheduled for this date.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedBookings.length === bookings.length && bookings.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Therapist</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((booking) => (
                    <TableRow key={booking.id} className={cn(!booking.therapist_id && "bg-gold/10")}>
                      <TableCell>
                        <Checkbox
                          checked={selectedBookings.includes(booking.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedBookings([...selectedBookings, booking.id]);
                            } else {
                              setSelectedBookings(selectedBookings.filter((id) => id !== booking.id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          {booking.booking_time.slice(0, 5)}
                        </div>
                      </TableCell>
                      <TableCell>{maskName(booking.customer_name)}</TableCell>
                      <TableCell>{booking.services?.name || "-"}</TableCell>
                      <TableCell>{booking.services?.duration_minutes} min</TableCell>
                      <TableCell>
                        <VenueBadge booking={booking} size="sm" />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={booking.therapist_id || "unassigned"}
                          onValueChange={(value) =>
                            updateAssignmentMutation.mutate({
                              bookingId: booking.id,
                              therapistId: value === "unassigned" ? null : value,
                            })
                          }
                        >
                          <SelectTrigger className={cn("w-[160px]", !booking.therapist_id && "border-gold")}>
                            <SelectValue placeholder="Select therapist" />
                          </SelectTrigger>
                          <SelectContent className="bg-background">
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {therapists.map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
                          {booking.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Therapist Summary Cards */}
        {therapistsWithSessions.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Therapist Summaries</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {therapistsWithSessions.map((therapist) => {
                const therapistBookings = bookings.filter((b) => b.therapist_id === therapist.id);
                const sendStatus = getSendStatus(therapist.id);

                return (
                  <Card key={therapist.id} className="relative">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{therapist.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {therapistBookings.length} session(s)
                          </p>
                        </div>
                        {getStatusBadge(sendStatus)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1 text-sm">
                        {therapistBookings.slice(0, 3).map((b) => (
                          <div key={b.id} className="flex items-center justify-between text-muted-foreground">
                            <span>{b.booking_time.slice(0, 5)} - {maskName(b.customer_name)}</span>
                            <span>{b.services?.duration_minutes}min</span>
                          </div>
                        ))}
                        {therapistBookings.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{therapistBookings.length - 3} more sessions
                          </p>
                        )}
                      </div>

                      {sendStatus?.sent_at && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {getDeliveryIcon(sendStatus.delivery_method)}
                          <span>Sent {format(parseISO(sendStatus.sent_at), "PPp", { locale: de })}</span>
                        </div>
                      )}

                      <Button
                        onClick={() => openSendDialog(therapist.id)}
                        variant={sendStatus?.delivery_status === "sent" ? "outline" : "default"}
                        size="sm"
                        className="w-full"
                        disabled={therapistBookings.length === 0}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        {sendStatus?.delivery_status === "sent" ? "Resend" : "Send"} Summary
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Send Confirmation Dialog */}
        <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
          <DialogContent className="bg-background">
            <DialogHeader>
              <DialogTitle>Send Daily Summary</DialogTitle>
              <DialogDescription>
                Choose how to send the daily schedule to the therapist.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Delivery Method</label>
                <Select value={deliveryMethod} onValueChange={(v) => setDeliveryMethod(v as typeof deliveryMethod)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="email">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email Only
                      </div>
                    </SelectItem>
                    <SelectItem value="whatsapp">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp Only
                      </div>
                    </SelectItem>
                    <SelectItem value="both">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        <MessageCircle className="w-4 h-4" />
                        Email & WhatsApp
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {therapistToSend && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <h4 className="font-medium text-sm mb-2">Preview: Sessions to be sent</h4>
                  <div className="space-y-1 text-sm">
                    {bookings
                      .filter((b) => b.therapist_id === therapistToSend)
                      .map((b) => (
                        <div key={b.id} className="flex justify-between">
                          <span>
                            {b.booking_time.slice(0, 5)} - {maskName(b.customer_name)} ({b.services?.name})
                          </span>
                          <span className="text-muted-foreground">{b.services?.duration_minutes}min</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sendSummaryMutation.isPending}>
                {sendSummaryMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Now
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
