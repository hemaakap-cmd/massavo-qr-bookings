import { useState, useMemo, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
import {
  useAdminAllBookings,
  useAdminAllTherapists,
  useAdminAllGyms,
  useAdminUpdateBooking,
  useAdminCancelBooking,
  type AdminBooking,
} from "@/hooks/useAdminStaffDashboard";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Shield, Users, Building2, Calendar, Clock, User,
  ChevronRight, CheckCircle2, XCircle, Edit, ArrowRightLeft,
  AlertTriangle, Loader2, Filter, Plus, Wifi, WifiOff,
  MapPin, FileText, MessageCircle, Mail, Phone, Eye,
} from "lucide-react";
import { type SelectedArea } from "@/components/body-diagram/BodyDiagram";
import { SmartRecoveryProfile } from "@/components/clinical/SmartRecoveryProfile";
import { StaffPainEvolutionCard } from "@/components/staff/StaffPainEvolutionCard";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, subDays } from "date-fns";
import { toast } from "sonner";

export default function AdminStaffAdvanced() {
  const { user, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Filters
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>("all");
  const [selectedGymId, setSelectedGymId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(addDays(new Date(), 7), "yyyy-MM-dd"));

  // Dialogs
  const [editBooking, setEditBooking] = useState<AdminBooking | null>(null);
  const [reassignBooking, setReassignBooking] = useState<AdminBooking | null>(null);
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [detailBooking, setDetailBooking] = useState<AdminBooking | null>(null);

  // Realtime
  const [isConnected, setIsConnected] = useState(false);

  const { data: therapists = [] } = useAdminAllTherapists();
  const { data: gyms = [] } = useAdminAllGyms();
  const { data: bookings = [], isLoading } = useAdminAllBookings({
    dateFrom,
    dateTo,
    gymId: selectedGymId !== "all" ? selectedGymId : null,
    therapistId: selectedTherapistId !== "all" ? selectedTherapistId : null,
  });
  const updateBooking = useAdminUpdateBooking();
  const cancelBooking = useAdminCancelBooking();

  const selectedTherapist = therapists.find((t: any) => t.id === selectedTherapistId);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("admin-staff-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-staff-bookings"] });
      })
      .subscribe((status) => setIsConnected(status === "SUBSCRIBED"));

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Group bookings by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, AdminBooking[]> = {};
    bookings.forEach((b) => {
      (groups[b.booking_date] = groups[b.booking_date] || []).push(b);
    });
    return groups;
  }, [bookings]);

  // Stats
  const stats = useMemo(() => {
    const scheduled = bookings.filter((b) => b.status === "confirmed" || b.status === "pending").length;
    const completed = bookings.filter((b) => b.status === "completed").length;
    const noShows = bookings.filter((b) => b.status === "no_show").length;
    return { total: bookings.length, scheduled, completed, noShows };
  }, [bookings]);

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Admin Mode Banner */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20">
          <Shield className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-semibold text-foreground">Admin Mode</span>
            <span className="text-sm text-muted-foreground ml-2">
              {selectedTherapistId !== "all"
                ? `Viewing as ${selectedTherapist?.name || "..."}`
                : "Viewing all therapists"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {isConnected ? (
              <><Wifi className="w-3.5 h-3.5 text-emerald-500" /><span className="text-xs text-emerald-500">Live</span></>
            ) : (
              <><WifiOff className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Offline</span></>
            )}
          </div>
          {isSuperAdmin && (
            <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-[10px]">
              Override Mode
            </Badge>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Filters</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Therapist */}
              <Select value={selectedTherapistId} onValueChange={setSelectedTherapistId}>
                <SelectTrigger><SelectValue placeholder="All Therapists" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Therapists</SelectItem>
                  {therapists.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.gymName})</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Gym */}
              <Select value={selectedGymId} onValueChange={setSelectedGymId}>
                <SelectTrigger><SelectValue placeholder="All Gyms" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Gyms</SelectItem>
                  {gyms.map((g: any) => (
                    <SelectItem key={g.id} value={g.id}>{g.name} – {g.cityName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date Range */}
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Calendar} label="Total" value={stats.total} color="text-primary" />
          <StatCard icon={Clock} label="Scheduled" value={stats.scheduled} color="text-blue-500" />
          <StatCard icon={CheckCircle2} label="Completed" value={stats.completed} color="text-emerald-500" />
          <StatCard icon={AlertTriangle} label="No-Shows" value={stats.noShows} color="text-destructive" />
        </div>

        {/* Bookings List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : bookings.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No bookings found for the selected filters</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedByDate).map(([dateStr, dayBookings]) => (
            <div key={dateStr} className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  {format(new Date(dateStr + "T00:00:00"), "EEEE, dd MMM yyyy")}
                </span>
                <Badge variant="secondary" className="text-[10px]">{dayBookings.length}</Badge>
              </div>

              <div className="space-y-2">
                {dayBookings.map((b) => (
                  <AdminBookingCard
                    key={b.id}
                    booking={b}
                    isSuperAdmin={isSuperAdmin}
                    onEdit={() => setEditBooking(b)}
                    onReassign={() => setReassignBooking(b)}
                    onCancel={() => setCancelBookingId(b.id)}
                    onDetail={() => setDetailBooking(b)}
                    onStatusChange={(status) =>
                      updateBooking.mutate({ bookingId: b.id, updates: { status }, auditAction: `status_${status}` })
                    }
                    isUpdating={updateBooking.isPending}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <EditBookingDialog
        booking={editBooking}
        onClose={() => setEditBooking(null)}
        onSave={(updates) => {
          if (!editBooking) return;
          updateBooking.mutate(
            { bookingId: editBooking.id, updates, auditAction: "edit" },
            { onSuccess: () => setEditBooking(null) }
          );
        }}
        isPending={updateBooking.isPending}
      />

      {/* Reassign Dialog */}
      <ReassignDialog
        booking={reassignBooking}
        therapists={therapists}
        onClose={() => setReassignBooking(null)}
        onReassign={(therapistId) => {
          if (!reassignBooking) return;
          updateBooking.mutate(
            { bookingId: reassignBooking.id, updates: { therapist_id: therapistId }, auditAction: "reassign" },
            { onSuccess: () => setReassignBooking(null) }
          );
        }}
        isPending={updateBooking.isPending}
      />

      {/* Detail Dialog */}
      <AdminBookingDetailDialog
        booking={detailBooking}
        onClose={() => setDetailBooking(null)}
      />

      {/* Cancel Confirm */}
      <Dialog open={!!cancelBookingId} onOpenChange={() => setCancelBookingId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancel Booking?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will cancel the booking. This action is logged.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelBookingId(null)}>Keep</Button>
            <Button
              variant="destructive"
              disabled={cancelBooking.isPending}
              onClick={() => {
                if (cancelBookingId) {
                  cancelBooking.mutate(cancelBookingId, { onSuccess: () => setCancelBookingId(null) });
                }
              }}
            >
              {cancelBooking.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cancel Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

// ─── Sub-components ──────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
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

function AdminBookingCard({
  booking,
  isSuperAdmin,
  onEdit,
  onReassign,
  onCancel,
  onDetail,
  onStatusChange,
  isUpdating,
}: {
  booking: AdminBooking;
  isSuperAdmin: boolean;
  onEdit: () => void;
  onReassign: () => void;
  onCancel: () => void;
  onDetail: () => void;
  onStatusChange: (status: string) => void;
  isUpdating: boolean;
}) {
  const canComplete = booking.status === "confirmed" || booking.status === "pending";

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Time */}
          <div className="shrink-0 text-center min-w-[50px]">
            <div className="text-lg font-bold text-foreground">{booking.booking_time?.slice(0, 5)}</div>
            <div className="text-[10px] text-muted-foreground">{booking.service?.duration_minutes || "—"} min</div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-foreground truncate">
                {booking.customer_name || "Anonymous"}
              </span>
              <StatusBadge status={booking.status} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{booking.service?.name || "—"}</span>
              {booking.gym && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {booking.gym.name}
                </span>
              )}
              {booking.therapist && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {booking.therapist.name}
                </span>
              )}
              {!booking.therapist && (
                <Badge variant="outline" className="text-[10px] py-0 text-amber-500 border-amber-500/30">
                  Unassigned
                </Badge>
              )}
            </div>
            {booking.communication_preference && (
              <div className="text-xs text-muted-foreground">
                {booking.communication_preference === "silent" && "🤫 Ruhig"}
                {booking.communication_preference === "light_talk" && "💬 Leichte Unterhaltung"}
                {booking.communication_preference === "normal" && "🗣️ Gerne Gespräch"}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={onDetail} title="View Details">
              <Eye className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} title="Edit">
              <Edit className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onReassign} title="Reassign">
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </Button>
            {canComplete && (
              <>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8 text-emerald-500"
                  onClick={() => onStatusChange("completed")} disabled={isUpdating}
                  title="Complete"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8 text-amber-500"
                  onClick={() => onStatusChange("no_show")} disabled={isUpdating}
                  title="No-Show"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onCancel} title="Cancel">
              <XCircle className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  switch (status) {
    case "confirmed": return <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30 text-[10px]">Confirmed</Badge>;
    case "completed": return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30 text-[10px]">Completed</Badge>;
    case "no_show": return <Badge variant="destructive" className="text-[10px]">No-Show</Badge>;
    case "pending": return <Badge variant="secondary" className="text-[10px]">Pending</Badge>;
    default: return <Badge variant="secondary" className="text-[10px]">{status || "Unknown"}</Badge>;
  }
}

function EditBookingDialog({
  booking,
  onClose,
  onSave,
  isPending,
}: {
  booking: AdminBooking | null;
  onClose: () => void;
  onSave: (updates: Record<string, any>) => void;
  isPending: boolean;
}) {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (booking) {
      setTime(booking.booking_time?.slice(0, 5) || "");
      setDate(booking.booking_date || "");
      setNotes(booking.notes || "");
    }
  }, [booking]);

  if (!booking) return null;

  return (
    <Dialog open={!!booking} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Booking</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Time</label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Notes</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={isPending}
            onClick={() => onSave({
              booking_date: date,
              booking_time: time + ":00",
              notes: notes || null,
            })}
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminBookingDetailDialog({
  booking,
  onClose,
}: {
  booking: AdminBooking | null;
  onClose: () => void;
}) {
  const { data: bodyAreas = [] } = useQuery({
    queryKey: ["admin-booking-body-areas", booking?.id],
    enabled: !!booking,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_body_areas")
        .select("*")
        .eq("booking_id", booking!.id);
      if (error) throw error;
      return (data || []).map((a: any) => ({
        code: a.area_code,
        label: a.area_label,
        side: a.side as "front" | "back",
        painIntensity: a.pain_intensity || 5,
        isFocus: a.is_focus || false,
        notes: a.notes || "",
      })) as SelectedArea[];
    },
  });

  // Load therapist advice (read-only for admin)
  const { data: feedbackData } = useQuery({
    queryKey: ["admin-therapist-advice", booking?.id],
    enabled: !!booking,
    queryFn: async () => {
      const { data } = await supabase
        .from("booking_feedback")
        .select("therapist_advice, therapist_rating, service_rating, comment, customer_first_name, submitted_at, is_submitted")
        .eq("booking_id", booking!.id)
        .maybeSingle();
      return data;
    },
  });

  if (!booking) return null;

  const endTime = (() => {
    const t = booking.booking_time;
    const dur = booking.service?.duration_minutes;
    if (!t || !dur) return "—";
    const [h, m] = t.split(":").map(Number);
    const end = new Date(0, 0, 0, h, m + dur);
    return `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
  })();

  return (
    <Dialog open={!!booking} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Client Details – {booking.customer_name || "Anonymous"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={booking.status} />
            {booking.therapist && (
              <Badge variant="outline" className="text-xs">
                <User className="w-3 h-3 mr-1" />
                {booking.therapist.name}
              </Badge>
            )}
            {booking.payment_status && (
              <Badge variant="outline" className="text-xs">
                💳 {booking.payment_status}
              </Badge>
            )}
          </div>

          {/* Client Info */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <SectionTitle icon={User} title="Client Information" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 text-sm">
                <InfoRow label="Name" value={booking.customer_name || "Anonymous"} />
                <InfoRow label="Email" value={booking.customer_email} />
                {booking.salutation && <InfoRow label="Salutation" value={booking.salutation} />}
                {booking.gender && <InfoRow label="Gender" value={booking.gender} />}
                {booking.date_of_birth && <InfoRow label="Date of Birth" value={format(new Date(booking.date_of_birth + "T00:00:00"), "dd.MM.yyyy")} />}
                {booking.client_phone && <InfoRow label="Phone" value={booking.client_phone} />}
                {booking.client_address && <InfoRow label="Address" value={booking.client_address} />}
                {booking.pregnancy_status && booking.pregnancy_status !== "none" && (
                  <InfoRow label="Pregnancy" value={booking.pregnancy_status} />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Appointment Info */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <SectionTitle icon={Calendar} title="Appointment" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 text-sm">
                <InfoRow label="Date" value={format(new Date(booking.booking_date + "T00:00:00"), "EEE, dd MMM yyyy")} />
                <InfoRow label="Start" value={booking.booking_time?.slice(0, 5) || "—"} />
                <InfoRow label="End" value={endTime} />
                <InfoRow label="Service" value={booking.service?.name || "—"} />
                <InfoRow label="Duration" value={`${booking.service?.duration_minutes || "—"} min`} />
                {booking.gym && <InfoRow label="Location" value={booking.gym.name} />}
                <InfoRow label="Amount" value={`€${booking.total_amount.toFixed(2)}`} />
              </div>
            </CardContent>
          </Card>

          {/* Communication Preference */}
          {booking.communication_preference && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <SectionTitle icon={MessageCircle} title="Communication Preference" />
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-lg">
                    {booking.communication_preference === "silent" && "🤫"}
                    {booking.communication_preference === "light_talk" && "💬"}
                    {booking.communication_preference === "normal" && "🗣️"}
                  </span>
                  <span className="font-medium text-foreground">
                    {booking.communication_preference === "silent" && "Ruhige Sitzung bevorzugt"}
                    {booking.communication_preference === "light_talk" && "Leichte Unterhaltung ist OK"}
                    {booking.communication_preference === "normal" && "Unterhält sich gerne"}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {booking.notes && (
            <Card className="border-accent/30 bg-accent/5">
              <CardContent className="p-4 space-y-2">
                <SectionTitle icon={FileText} title="Anmerkungen des Kunden" />
                <p className="text-sm text-foreground whitespace-pre-wrap bg-background/60 rounded-lg p-3 border border-border/30">{booking.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Smart Recovery Profile */}
          <SmartRecoveryProfile
            bookingId={booking.id}
            customerEmail={booking.customer_email}
            currentAreas={bodyAreas}
            clientGender={booking.gender === "male" ? "male" : booking.gender === "female" ? "female" : null}
          />

          {/* Pain Evolution Tracker */}
          <StaffPainEvolutionCard customerEmail={booking.customer_email} />

          {/* Therapist Advice (read-only for admin) */}
          {feedbackData?.therapist_advice && (
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="p-4 space-y-2">
                <SectionTitle icon={FileText} title="Therapist Advice" />
                <p className="text-sm text-foreground whitespace-pre-wrap bg-background/60 rounded-lg p-3 border border-border/30">
                  {feedbackData.therapist_advice}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Client Feedback (if submitted) */}
          {feedbackData?.is_submitted && (
            <Card className="border-border/50">
              <CardContent className="p-4 space-y-2">
                <SectionTitle icon={MessageCircle} title="Client Feedback" />
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                  {feedbackData.therapist_rating != null && (
                    <InfoRow label="Therapist Rating" value={`⭐ ${feedbackData.therapist_rating}/5`} />
                  )}
                  {feedbackData.service_rating != null && (
                    <InfoRow label="Service Rating" value={`⭐ ${feedbackData.service_rating}/5`} />
                  )}
                </div>
                {feedbackData.comment && (
                  <p className="text-sm text-foreground/80 italic mt-2">"{feedbackData.comment}"</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-primary" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground block">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function ReassignDialog({
  booking,
  therapists,
  onClose,
  onReassign,
  isPending,
}: {
  booking: AdminBooking | null;
  therapists: any[];
  onClose: () => void;
  onReassign: (therapistId: string) => void;
  isPending: boolean;
}) {
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    if (booking?.therapist_id) setSelected(booking.therapist_id);
  }, [booking]);

  if (!booking) return null;

  return (
    <Dialog open={!!booking} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Reassign Therapist</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Current: <span className="font-medium text-foreground">{booking.therapist?.name || "Unassigned"}</span>
          </p>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger><SelectValue placeholder="Select therapist..." /></SelectTrigger>
            <SelectContent>
              {therapists.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>{t.name} ({t.gymName})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={isPending || !selected} onClick={() => onReassign(selected)}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Reassign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
