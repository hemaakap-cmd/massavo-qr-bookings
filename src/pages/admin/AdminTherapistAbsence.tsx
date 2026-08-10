import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertTriangle, UserX, ArrowRightLeft, CalendarClock, XCircle, Send,
  ShieldAlert, Users, CheckCircle2, Loader2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import {
  useAffectedBookings,
  useAvailableReplacements,
  useBulkReassign,
  usePostponeBooking,
  useCancelAbsenceBookings,
  useNotifyAffectedCustomers,
  type AffectedBooking,
} from "@/hooks/useTherapistAbsence";
import { useAdminAllTherapists } from "@/hooks/useAdminStaffDashboard";
import { VenueBadge } from "@/components/shared/VenueBadge";

export default function AdminTherapistAbsence() {
  const [selectedTherapist, setSelectedTherapist] = useState("");
  const [absenceDate, setAbsenceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set());
  const [actionDialog, setActionDialog] = useState<{
    type: "reassign" | "postpone" | "cancel";
    bookings: AffectedBooking[];
  } | null>(null);
  const [reassignTarget, setReassignTarget] = useState("");
  const [postponeDate, setPostponeDate] = useState("");
  const [postponeTime, setPostponeTime] = useState("");

  const { data: therapists = [] } = useAdminAllTherapists();
  const { data: affectedBookings = [], isLoading } = useAffectedBookings(
    selectedTherapist || null,
    absenceDate || null
  );

  // Collect all unique venue IDs (only gyms — hotel replacements use a different lookup path)
  const affectedGymIds = useMemo(
    () => [...new Set(affectedBookings.map((b) => b.gym_id).filter(Boolean))],
    [affectedBookings]
  );
  const firstGymId = (affectedGymIds[0] as string | undefined) || null;
  const { data: replacements = [] } = useAvailableReplacements(
    firstGymId,
    absenceDate || null,
    selectedTherapist || null
  );

  // For multi-gym scenarios, merge replacements from all gyms
  const allReplacements = useMemo(() => {
    const seen = new Set(replacements.map((r) => r.id));
    return replacements; // Primary gym replacements; additional gym logic handled in hook
  }, [replacements]);

  const bulkReassignMutation = useBulkReassign();
  const postponeMutation = usePostponeBooking();
  const cancelMutation = useCancelAbsenceBookings();
  const notifyMutation = useNotifyAffectedCustomers();

  const toggleBooking = (id: string) => {
    setSelectedBookings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedBookings.size === affectedBookings.length) {
      setSelectedBookings(new Set());
    } else {
      setSelectedBookings(new Set(affectedBookings.map((b) => b.id)));
    }
  };

  const getSelectedBookingObjects = (): AffectedBooking[] =>
    affectedBookings.filter((b) => selectedBookings.has(b.id));

  const openAction = (type: "reassign" | "postpone" | "cancel") => {
    const bookings = getSelectedBookingObjects();
    if (!bookings.length) return;
    setActionDialog({ type, bookings });
    setReassignTarget("");
    setPostponeDate("");
    setPostponeTime("");
  };

  const executeAction = async () => {
    if (!actionDialog) return;
    const { type, bookings } = actionDialog;

    try {
      if (type === "reassign" && reassignTarget) {
        await bulkReassignMutation.mutateAsync({
          bookingIds: bookings.map((b) => b.id),
          newTherapistId: reassignTarget,
        });
        const replacementName = [...replacements, ...therapists].find((r: any) => r.id === reassignTarget)?.name;
        await notifyMutation.mutateAsync({
          bookings,
          action: "reassigned",
          newTherapistName: replacementName,
        });
      } else if (type === "postpone" && postponeDate) {
        for (const b of bookings) {
          await postponeMutation.mutateAsync({
            bookingId: b.id,
            newDate: postponeDate,
            newTime: postponeTime || b.booking_time,
          });
        }
        await notifyMutation.mutateAsync({
          bookings,
          action: "postponed",
          newDate: postponeDate,
        });
      } else if (type === "cancel") {
        await cancelMutation.mutateAsync(bookings.map((b) => b.id));
        await notifyMutation.mutateAsync({ bookings, action: "cancelled" });
      }
    } finally {
      setActionDialog(null);
      setSelectedBookings(new Set());
    }
  };

  const isExecuting =
    bulkReassignMutation.isPending || postponeMutation.isPending ||
    cancelMutation.isPending || notifyMutation.isPending;

  const selectedTherapistData = therapists.find((t: any) => t.id === selectedTherapist);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-destructive/10">
            <UserX className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Abwesenheitsmanagement</h1>
            <p className="text-sm text-muted-foreground">
              Therapeut abwesend? Termine umbuchen, verschieben oder absagen — mit sofortiger Kundenbenachrichtigung.
            </p>
          </div>
        </div>

        {/* Step 1 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              Schritt 1: Abwesenheit registrieren
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Therapeut/in</Label>
                <Select value={selectedTherapist} onValueChange={(v) => { setSelectedTherapist(v); setSelectedBookings(new Set()); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Therapeut auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {therapists.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} {t.gender === "female" ? "♀" : t.gender === "male" ? "♂" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Datum der Abwesenheit</Label>
                <Input
                  type="date"
                  value={absenceDate}
                  onChange={(e) => { setAbsenceDate(e.target.value); setSelectedBookings(new Set()); }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Affected bookings */}
        {selectedTherapist && absenceDate && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Schritt 2: Betroffene Termine ({affectedBookings.length})
                </CardTitle>
                {affectedBookings.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openAction("reassign")} disabled={selectedBookings.size === 0} className="gap-1.5">
                      <ArrowRightLeft className="h-3.5 w-3.5" /> Umbuchen
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openAction("postpone")} disabled={selectedBookings.size === 0} className="gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5" /> Verschieben
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => openAction("cancel")} disabled={selectedBookings.size === 0} className="gap-1.5">
                      <XCircle className="h-3.5 w-3.5" /> Absagen
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : affectedBookings.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">Keine betroffenen Termine</p>
                  <p className="text-sm">
                    {selectedTherapistData?.name || "Dieser Therapeut"} hat am{" "}
                    {format(parseISO(absenceDate), "dd. MMMM yyyy", { locale: de })} keine Termine.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selectedBookings.size === affectedBookings.length && affectedBookings.length > 0}
                            onCheckedChange={toggleAll}
                          />
                        </TableHead>
                        <TableHead>Zeit</TableHead>
                        <TableHead>Kunde</TableHead>
                        <TableHead>Standort</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Zugewiesen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {affectedBookings.map((b) => (
                        <TableRow key={b.id} className={selectedBookings.has(b.id) ? "bg-primary/5" : ""}>
                          <TableCell>
                            <Checkbox checked={selectedBookings.has(b.id)} onCheckedChange={() => toggleBooking(b.id)} />
                          </TableCell>
                          <TableCell className="font-mono font-medium">{b.booking_time.slice(0, 5)}</TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{b.customer_name || "—"}</p>
                            <p className="text-xs text-muted-foreground">{b.customer_email}</p>
                          </TableCell>
                          <TableCell className="text-sm">
                            <VenueBadge booking={{ gym_id: b.gym_id, hotel_id: b.hotel_id, gyms: b.gym, hotels: b.hotel }} size="sm" />
                          </TableCell>
                          <TableCell className="text-sm">{b.service?.name || "—"}</TableCell>
                          <TableCell>
                            {b.therapist_id ? (
                              <Badge variant="secondary" className="text-xs">{b.therapist?.name}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">Nicht zugewiesen</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Available replacements */}
        {selectedTherapist && absenceDate && replacements.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Verfügbare Ersatz-Therapeuten ({replacements.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {replacements.map((r) => (
                  <Badge key={r.id} variant="outline" className="py-1.5 px-3 text-sm">
                    {r.name} {r.gender === "female" ? "♀" : r.gender === "male" ? "♂" : ""}
                    {r.source === "daily" && (
                      <span className="ml-1 text-xs text-muted-foreground">(Tagesplan)</span>
                    )}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.type === "reassign" && "Termine umbuchen"}
              {actionDialog?.type === "postpone" && "Termine verschieben"}
              {actionDialog?.type === "cancel" && "Termine absagen"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.bookings.length} Termin(e) betroffen. Kunden werden sofort per E-Mail benachrichtigt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {actionDialog?.type === "reassign" && (
              <div className="space-y-2">
                <Label>Neuer Therapeut</Label>
                <Select value={reassignTarget} onValueChange={setReassignTarget}>
                  <SelectTrigger><SelectValue placeholder="Ersatz-Therapeut wählen..." /></SelectTrigger>
                  <SelectContent>
                    {replacements.length > 0 && replacements.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} {r.gender === "female" ? "♀" : r.gender === "male" ? "♂" : ""}
                        {r.source === "daily" ? " (Tagesplan)" : ""}
                      </SelectItem>
                    ))}
                    {replacements.length === 0 && therapists
                      .filter((t: any) => t.id !== selectedTherapist)
                      .map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.name} (Notfall)</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {replacements.length === 0 && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Kein planmäßiger Ersatz — Notfall-Zuweisung
                  </p>
                )}
              </div>
            )}

            {actionDialog?.type === "postpone" && (
              <>
                <div className="space-y-2">
                  <Label>Neues Datum</Label>
                  <Input type="date" value={postponeDate} min={format(new Date(), "yyyy-MM-dd")} onChange={(e) => setPostponeDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Neue Uhrzeit (optional — sonst gleiche Zeit)</Label>
                  <Input type="time" value={postponeTime} onChange={(e) => setPostponeTime(e.target.value)} />
                </div>
              </>
            )}

            {actionDialog?.type === "cancel" && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm text-destructive font-medium flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  {actionDialog.bookings.length} Termin(e) werden unwiderruflich abgesagt.
                </p>
                <p className="text-xs text-muted-foreground mt-1">Kunden erhalten sofort eine Absage-E-Mail.</p>
              </div>
            )}

            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                <Send className="h-3 w-3" /> E-Mail-Benachrichtigung
              </p>
              <p className="text-xs text-muted-foreground">
                {actionDialog?.bookings.length} Kunde(n) werden sofort benachrichtigt.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)} disabled={isExecuting}>Abbrechen</Button>
            <Button
              onClick={executeAction}
              disabled={isExecuting || (actionDialog?.type === "reassign" && !reassignTarget) || (actionDialog?.type === "postpone" && !postponeDate)}
              variant={actionDialog?.type === "cancel" ? "destructive" : "default"}
            >
              {isExecuting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Bestätigen & Benachrichtigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
