import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Palmtree, Plus, AlertTriangle, CheckCircle2, XCircle, Clock,
  Calendar, Loader2, Ban, ArrowRightLeft,
} from "lucide-react";
import { format, parseISO, differenceInDays, isAfter } from "date-fns";
import { de } from "date-fns/locale";
import {
  useTherapistLeaves,
  useCreateLeave,
  useUpdateLeaveStatus,
  useCancelLeave,
  useLeaveAffectedBookings,
} from "@/hooks/useTherapistLeaves";
import { useAdminAllTherapists } from "@/hooks/useAdminStaffDashboard";
import { useNavigate } from "react-router-dom";

const LEAVE_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  vacation: { label: "Urlaub", icon: "🏖️", color: "bg-blue-500/10 text-blue-700 border-blue-200" },
  sick: { label: "Krankheit", icon: "🤒", color: "bg-red-500/10 text-red-700 border-red-200" },
  personal: { label: "Persönlich", icon: "🏠", color: "bg-amber-500/10 text-amber-700 border-amber-200" },
  emergency: { label: "Notfall", icon: "🚨", color: "bg-destructive/10 text-destructive border-destructive/20" },
};

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Ausstehend", variant: "outline" },
  approved: { label: "Genehmigt", variant: "default" },
  rejected: { label: "Abgelehnt", variant: "destructive" },
  cancelled: { label: "Storniert", variant: "secondary" },
};

export default function AdminTherapistLeaves() {
  const navigate = useNavigate();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTherapist, setFilterTherapist] = useState("all");

  // Create form state
  const [formTherapist, setFormTherapist] = useState("");
  const [formType, setFormType] = useState("vacation");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formReason, setFormReason] = useState("");

  // Affected bookings preview
  const [previewLeave, setPreviewLeave] = useState<{ therapistId: string; start: string; end: string } | null>(null);

  const { data: therapists = [] } = useAdminAllTherapists();
  const { data: leaves = [], isLoading } = useTherapistLeaves({
    status: filterStatus !== "all" ? filterStatus : undefined,
    therapistId: filterTherapist !== "all" ? filterTherapist : undefined,
  });

  const { data: affectedBookings = [] } = useLeaveAffectedBookings(
    previewLeave?.therapistId || null,
    previewLeave?.start || null,
    previewLeave?.end || null,
  );

  const createMutation = useCreateLeave();
  const updateStatusMutation = useUpdateLeaveStatus();
  const cancelMutation = useCancelLeave();

  // Stats
  const stats = useMemo(() => {
    const active = leaves.filter(l => l.status === "approved" || l.status === "pending");
    const upcoming = active.filter(l => isAfter(parseISO(l.start_date), new Date()));
    const current = active.filter(l => {
      const now = new Date();
      return parseISO(l.start_date) <= now && parseISO(l.end_date) >= now;
    });
    return { total: leaves.length, active: active.length, upcoming: upcoming.length, current: current.length };
  }, [leaves]);

  const handleCreate = async () => {
    if (!formTherapist || !formStartDate || !formEndDate) return;
    await createMutation.mutateAsync({
      therapist_id: formTherapist,
      leave_type: formType,
      start_date: formStartDate,
      end_date: formEndDate,
      reason: formReason || undefined,
      status: "approved",
    });
    setShowCreateDialog(false);
    resetForm();
  };

  const resetForm = () => {
    setFormTherapist("");
    setFormType("vacation");
    setFormStartDate("");
    setFormEndDate("");
    setFormReason("");
    setPreviewLeave(null);
  };

  // Auto-preview affected bookings when therapist + dates are set
  const handleFormChange = (therapistId: string, start: string, end: string) => {
    if (therapistId && start && end) {
      setPreviewLeave({ therapistId, start, end });
    } else {
      setPreviewLeave(null);
    }
  };

  const navigateToAbsence = (therapistId: string, date: string) => {
    navigate(`/admin/therapist-absence`);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Palmtree className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Urlaubsverwaltung</h1>
              <p className="text-sm text-muted-foreground">
                Urlaub, Krankheit und Abwesenheiten der Therapeuten verwalten
              </p>
            </div>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Neue Abwesenheit
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Gesamt</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{stats.current}</p>
              <p className="text-xs text-muted-foreground">Aktuell abwesend</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{stats.upcoming}</p>
              <p className="text-xs text-muted-foreground">Geplant</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              <p className="text-xs text-muted-foreground">Aktiv</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Select value={filterTherapist} onValueChange={setFilterTherapist}>
                  <SelectTrigger><SelectValue placeholder="Alle Therapeuten" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Therapeuten</SelectItem>
                    {therapists.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger><SelectValue placeholder="Alle Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    <SelectItem value="approved">Genehmigt</SelectItem>
                    <SelectItem value="pending">Ausstehend</SelectItem>
                    <SelectItem value="rejected">Abgelehnt</SelectItem>
                    <SelectItem value="cancelled">Storniert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leave list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Abwesenheiten ({leaves.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : leaves.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Keine Abwesenheiten</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Therapeut</TableHead>
                      <TableHead>Art</TableHead>
                      <TableHead>Zeitraum</TableHead>
                      <TableHead>Tage</TableHead>
                      <TableHead>Grund</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaves.map((leave) => {
                      const typeInfo = LEAVE_TYPE_LABELS[leave.leave_type] || LEAVE_TYPE_LABELS.personal;
                      const statusInfo = STATUS_BADGES[leave.status] || STATUS_BADGES.pending;
                      const days = differenceInDays(parseISO(leave.end_date), parseISO(leave.start_date)) + 1;
                      const isFuture = isAfter(parseISO(leave.start_date), new Date());

                      return (
                        <TableRow key={leave.id}>
                          <TableCell className="font-medium text-sm">
                            {leave.therapist?.name || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${typeInfo.color}`}>
                              {typeInfo.icon} {typeInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className="font-mono">
                              {format(parseISO(leave.start_date), "dd.MM.yy")}
                            </span>
                            {" – "}
                            <span className="font-mono">
                              {format(parseISO(leave.end_date), "dd.MM.yy")}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm font-medium">{days}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {leave.reason || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusInfo.variant} className="text-xs">
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {leave.status === "approved" && isFuture && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => navigateToAbsence(leave.therapist_id, leave.start_date)}
                                  >
                                    <ArrowRightLeft className="h-3 w-3" /> Termine
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs text-destructive"
                                    onClick={() => cancelMutation.mutate(leave.id)}
                                  >
                                    <Ban className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                              {leave.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs text-green-600"
                                    onClick={() => updateStatusMutation.mutate({ leaveId: leave.id, status: "approved" })}
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs text-destructive"
                                    onClick={() => updateStatusMutation.mutate({ leaveId: leave.id, status: "rejected" })}
                                  >
                                    <XCircle className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Leave Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) { resetForm(); } setShowCreateDialog(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palmtree className="h-5 w-5" /> Neue Abwesenheit eintragen
            </DialogTitle>
            <DialogDescription>
              Urlaub, Krankheit oder persönliche Abwesenheit eines Therapeuten registrieren.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Therapeut/in *</Label>
              <Select value={formTherapist} onValueChange={(v) => {
                setFormTherapist(v);
                handleFormChange(v, formStartDate, formEndDate);
              }}>
                <SelectTrigger><SelectValue placeholder="Therapeut wählen..." /></SelectTrigger>
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
              <Label>Art der Abwesenheit *</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAVE_TYPE_LABELS).map(([key, info]) => (
                    <SelectItem key={key} value={key}>{info.icon} {info.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Von *</Label>
                <Input
                  type="date"
                  value={formStartDate}
                  min={format(new Date(), "yyyy-MM-dd")}
                  onChange={(e) => {
                    setFormStartDate(e.target.value);
                    handleFormChange(formTherapist, e.target.value, formEndDate);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Bis *</Label>
                <Input
                  type="date"
                  value={formEndDate}
                  min={formStartDate || format(new Date(), "yyyy-MM-dd")}
                  onChange={(e) => {
                    setFormEndDate(e.target.value);
                    handleFormChange(formTherapist, formStartDate, e.target.value);
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Grund (optional)</Label>
              <Textarea
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder="z.B. Familienurlaub, OP, etc."
                rows={2}
              />
            </div>

            {/* Affected bookings preview */}
            {previewLeave && affectedBookings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  {affectedBookings.length} betroffene Termine im Zeitraum
                </p>
                <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                  {affectedBookings.slice(0, 5).map((b: any) => (
                    <li key={b.id} className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      {format(parseISO(b.booking_date), "dd.MM.")} {b.booking_time?.slice(0, 5)} — {b.customer_name || b.customer_email}
                    </li>
                  ))}
                  {affectedBookings.length > 5 && (
                    <li className="text-xs opacity-70">... und {affectedBookings.length - 5} weitere</li>
                  )}
                </ul>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  Nach dem Speichern können Sie diese Termine über die Abwesenheitsverwaltung bearbeiten.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowCreateDialog(false); }}>
              Abbrechen
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formTherapist || !formStartDate || !formEndDate || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
