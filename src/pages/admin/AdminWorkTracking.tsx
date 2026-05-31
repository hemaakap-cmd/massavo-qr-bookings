import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  Clock, Users, Calendar, ChevronLeft, ChevronRight,
  Timer, AlertTriangle, CheckCircle2, XCircle, Coffee,
  TrendingUp, Briefcase, HeartPulse, FileDown, Loader2,
  Mail, CalendarDays, Download,
} from "lucide-react";
import {
  format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval,
  isToday, isFuture, startOfMonth, endOfMonth, addMonths, subMonths,
  getDaysInMonth, getDay,
} from "date-fns";
import { de } from "date-fns/locale";

type AttendanceStatus = "working" | "sick" | "day_off" | "left_early" | "no_show" | "overtime";

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; shortLabel: string; color: string; icon: typeof Clock }> = {
  working: { label: "Working", shortLabel: "✓", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  overtime: { label: "Overtime", shortLabel: "OT", color: "bg-blue-500/10 text-blue-400 border-blue-500/30", icon: TrendingUp },
  sick: { label: "Sick Leave", shortLabel: "🤒", color: "bg-red-500/10 text-red-400 border-red-500/30", icon: HeartPulse },
  day_off: { label: "Day Off", shortLabel: "–", color: "bg-gray-500/10 text-gray-400 border-gray-500/30", icon: Coffee },
  left_early: { label: "Left Early", shortLabel: "⚠", color: "bg-amber-500/10 text-amber-400 border-amber-500/30", icon: AlertTriangle },
  no_show: { label: "No Show", shortLabel: "✗", color: "bg-red-500/10 text-red-400 border-red-500/30", icon: XCircle },
};

interface TherapistWorkData {
  therapist_id: string;
  therapist_name: string;
  sessions: number;
  total_minutes: number;
  scheduled_start?: string;
  scheduled_end?: string;
  actual_start?: string;
  actual_end?: string;
  status: AttendanceStatus;
  notes?: string;
  attendance_id?: string;
  gym_names: string[];
}

// Parse "HH:MM" to minutes since midnight — returns NaN-safe 0
const timeToMinutes = (t?: string | null): number => {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
};

const fmtHM = (mins: number) => `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;

interface DailyDetail {
  date: string;
  sessions: number;
  sessionMinutes: number;       // sum of service durations (Massagezeit)
  presenceMinutes: number;      // actual_end - actual_start (Anwesenheitszeit)
  scheduledMinutes: number;     // from weekly schedule
  breakMinutes: number;         // presence - session
  overtimeMinutes: number;      // max(0, presence - scheduled)
  status: AttendanceStatus;
  actualStart?: string;
  actualEnd?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  notes?: string;
}

interface MonthlyTherapistData {
  therapist_id: string;
  therapist_name: string;
  dailyData: DailyDetail[];
  totalSessions: number;
  totalSessionMinutes: number;
  totalPresenceMinutes: number;
  totalScheduledMinutes: number;
  totalBreakMinutes: number;
  totalOvertimeMinutes: number;
  workingDays: number;
  sickDays: number;
  dayOffCount: number;
  noShowCount: number;
  leftEarlyCount: number;
  overtimeCount: number;
  utilization: number;           // sessionMinutes / scheduledMinutes
  presenceUtilization: number;   // presenceMinutes / scheduledMinutes
}

const AdminWorkTracking = () => {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");
  const [editDialog, setEditDialog] = useState<{ open: boolean; therapist: TherapistWorkData | null }>({ open: false, therapist: null });
  const [editStatus, setEditStatus] = useState<AttendanceStatus>("working");
  const [editNotes, setEditNotes] = useState("");
  const [editActualStart, setEditActualStart] = useState("");
  const [editActualEnd, setEditActualEnd] = useState("");
  const [emailDialog, setEmailDialog] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get date range based on view mode
  const dateRange = useMemo(() => {
    if (viewMode === "day") return { start: dateStr, end: dateStr };
    if (viewMode === "week") return { start: format(weekStart, "yyyy-MM-dd"), end: format(weekEnd, "yyyy-MM-dd") };
    return { start: format(monthStart, "yyyy-MM-dd"), end: format(monthEnd, "yyyy-MM-dd") };
  }, [viewMode, dateStr, weekStart, weekEnd, monthStart, monthEnd]);

  // Fetch all therapists
  const { data: therapists = [] } = useQuery({
    queryKey: ["all-therapists"],
    queryFn: async () => {
      const { data } = await supabase.from("therapists").select("id, name").order("name");
      return data || [];
    },
  });

  // Fetch bookings for the date range
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["work-tracking-bookings", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, therapist_id, booking_date, booking_time, status, service_id, gym_id, hotel_id, services(duration_minutes), gyms(name), hotels(name)")
        .gte("booking_date", dateRange.start)
        .lte("booking_date", dateRange.end)
        .not("status", "in", '("cancelled","rescheduled")')
        .not("therapist_id", "is", null);
      return data || [];
    },
  });

  // Fetch attendance records
  const { data: attendance = [] } = useQuery({
    queryKey: ["work-tracking-attendance", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data } = await supabase
        .from("therapist_attendance")
        .select("*")
        .gte("work_date", dateRange.start)
        .lte("work_date", dateRange.end);
      return data || [];
    },
  });

  // Fetch weekly schedules
  const { data: weeklySchedules = [] } = useQuery({
    queryKey: ["work-tracking-schedules"],
    queryFn: async () => {
      const { data } = await supabase
        .from("therapist_weekly_schedules")
        .select("therapist_id, day_of_week, start_time, end_time, gym_id, hotel_id, is_active, gyms(name), hotels(name)")
        .eq("is_active", true);
      return data || [];
    },
  });

  // Build daily work data
  const dayWorkData = useMemo((): TherapistWorkData[] => {
    const dayName = format(selectedDate, "EEEE").toLowerCase();
    return therapists.map((t) => {
      const tBookings = bookings.filter((b: any) => b.therapist_id === t.id && b.booking_date === dateStr);
      const sessions = tBookings.length;
      const totalMinutes = tBookings.reduce((sum: number, b: any) => sum + (b.services?.duration_minutes || 0), 0);
      const gymNames = [...new Set(tBookings.map((b: any) => b.hotels?.name || b.gyms?.name).filter(Boolean))] as string[];
      const schedule = weeklySchedules.find((s: any) => s.therapist_id === t.id && s.day_of_week === dayName);
      const att = attendance.find((a: any) => a.therapist_id === t.id && a.work_date === dateStr);
      let status: AttendanceStatus = "working";
      if (att) status = att.status as AttendanceStatus;
      else if (!schedule && sessions === 0) status = "day_off";
      else if (schedule && sessions === 0 && !isFuture(selectedDate) && !isToday(selectedDate)) status = "no_show";
      return {
        therapist_id: t.id, therapist_name: t.name, sessions, total_minutes: totalMinutes,
        scheduled_start: schedule?.start_time?.slice(0, 5), scheduled_end: schedule?.end_time?.slice(0, 5),
        actual_start: att?.actual_start?.slice(0, 5), actual_end: att?.actual_end?.slice(0, 5),
        status, notes: att?.notes || undefined, attendance_id: att?.id,
        gym_names: gymNames.length > 0 ? gymNames : (schedule ? [(schedule as any).hotels?.name || (schedule as any).gyms?.name].filter(Boolean) : []),
      };
    });
  }, [therapists, bookings, attendance, weeklySchedules, selectedDate, dateStr]);

  // Week view data
  const weekWorkData = useMemo(() => {
    if (viewMode !== "week") return [];
    return therapists.map((t) => {
      const dailyData = weekDays.map((day) => {
        const ds = format(day, "yyyy-MM-dd");
        const dayName = format(day, "EEEE").toLowerCase();
        const tBookings = bookings.filter((b: any) => b.therapist_id === t.id && b.booking_date === ds);
        const sessions = tBookings.length;
        const sessionMinutes = tBookings.reduce((sum: number, b: any) => sum + (b.services?.duration_minutes || 0), 0);
        const att = attendance.find((a: any) => a.therapist_id === t.id && a.work_date === ds);
        const schedule = weeklySchedules.find((s: any) => s.therapist_id === t.id && s.day_of_week === dayName);
        return { date: ds, sessions, sessionMinutes, status: att?.status || (schedule ? "working" : "day_off") };
      });
      return {
        therapist_id: t.id, therapist_name: t.name, dailyData,
        totalSessions: dailyData.reduce((s, d) => s + d.sessions, 0),
        totalSessionMinutes: dailyData.reduce((s, d) => s + d.sessionMinutes, 0),
        sickDays: dailyData.filter((d) => d.status === "sick").length,
        workingDays: dailyData.filter((d) => d.sessions > 0).length,
      };
    });
  }, [therapists, bookings, attendance, weeklySchedules, weekDays, viewMode]);

  // Monthly data - the core accounting view
  const monthWorkData = useMemo((): MonthlyTherapistData[] => {
    if (viewMode !== "month") return [];
    return therapists.map((t) => {
      const dailyData: DailyDetail[] = monthDays.map((day) => {
        const ds = format(day, "yyyy-MM-dd");
        const dayName = format(day, "EEEE").toLowerCase();
        const tBookings = bookings.filter((b: any) => b.therapist_id === t.id && b.booking_date === ds);
        const sessions = tBookings.length;
        const sessionMinutes = tBookings.reduce((sum: number, b: any) => sum + (b.services?.duration_minutes || 0), 0);
        const att = attendance.find((a: any) => a.therapist_id === t.id && a.work_date === ds);
        const schedule = weeklySchedules.find((s: any) => s.therapist_id === t.id && s.day_of_week === dayName);

        const scheduledMinutes = schedule
          ? timeToMinutes(schedule.end_time) - timeToMinutes(schedule.start_time)
          : 0;

        // Presence = actual clock-in to clock-out; fallback to session time if not recorded
        const presenceMinutes = (att?.actual_start && att?.actual_end)
          ? Math.max(0, timeToMinutes(att.actual_end) - timeToMinutes(att.actual_start))
          : sessionMinutes; // fallback: assume session time = presence when not clocked

        const breakMinutes = Math.max(0, presenceMinutes - sessionMinutes);
        const overtimeMinutes = scheduledMinutes > 0 ? Math.max(0, presenceMinutes - scheduledMinutes) : 0;

        let status: AttendanceStatus = "working";
        if (att) {
          status = att.status as AttendanceStatus;
        } else if (!schedule && sessions === 0) {
          status = "day_off";
        } else if (schedule && sessions === 0 && !isFuture(day) && !isToday(day)) {
          status = "no_show";
        } else if (overtimeMinutes > 0 && !att) {
          status = "overtime";
        }

        return {
          date: ds, sessions, sessionMinutes, presenceMinutes, scheduledMinutes,
          breakMinutes, overtimeMinutes, status,
          actualStart: att?.actual_start?.slice(0, 5),
          actualEnd: att?.actual_end?.slice(0, 5),
          scheduledStart: schedule?.start_time?.slice(0, 5),
          scheduledEnd: schedule?.end_time?.slice(0, 5),
          notes: att?.notes || undefined,
        };
      });

      const totalSessions = dailyData.reduce((s, d) => s + d.sessions, 0);
      const totalSessionMinutes = dailyData.reduce((s, d) => s + d.sessionMinutes, 0);
      const totalPresenceMinutes = dailyData.reduce((s, d) => s + d.presenceMinutes, 0);
      const totalScheduledMinutes = dailyData.reduce((s, d) => s + d.scheduledMinutes, 0);
      const totalBreakMinutes = dailyData.reduce((s, d) => s + d.breakMinutes, 0);
      const totalOvertimeMinutes = dailyData.reduce((s, d) => s + d.overtimeMinutes, 0);
      const workingDays = dailyData.filter((d) => d.sessions > 0).length;
      const sickDays = dailyData.filter((d) => d.status === "sick").length;
      const dayOffCount = dailyData.filter((d) => d.status === "day_off").length;
      const noShowCount = dailyData.filter((d) => d.status === "no_show").length;
      const leftEarlyCount = dailyData.filter((d) => d.status === "left_early").length;
      const overtimeCount = dailyData.filter((d) => d.status === "overtime").length;
      const utilization = totalScheduledMinutes > 0 ? Math.round((totalSessionMinutes / totalScheduledMinutes) * 100) : 0;
      const presenceUtilization = totalScheduledMinutes > 0 ? Math.round((totalPresenceMinutes / totalScheduledMinutes) * 100) : 0;

      return {
        therapist_id: t.id, therapist_name: t.name, dailyData,
        totalSessions, totalSessionMinutes, totalPresenceMinutes, totalScheduledMinutes,
        totalBreakMinutes, totalOvertimeMinutes,
        workingDays, sickDays, dayOffCount, noShowCount,
        leftEarlyCount, overtimeCount, utilization, presenceUtilization,
      };
    }).filter(t => t.totalSessions > 0 || t.sickDays > 0 || t.totalScheduledMinutes > 0);
  }, [therapists, bookings, attendance, weeklySchedules, monthDays, viewMode]);

  // Save attendance
  const saveAttendance = useMutation({
    mutationFn: async (data: { therapist_id: string; status: AttendanceStatus; notes: string; actual_start: string; actual_end: string; attendance_id?: string }) => {
      if (data.attendance_id) {
        const { error } = await supabase.from("therapist_attendance")
          .update({ status: data.status, notes: data.notes || null, actual_start: data.actual_start || null, actual_end: data.actual_end || null })
          .eq("id", data.attendance_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("therapist_attendance")
          .insert({ therapist_id: data.therapist_id, work_date: dateStr, status: data.status, notes: data.notes || null, actual_start: data.actual_start || null, actual_end: data.actual_end || null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-tracking-attendance"] });
      setEditDialog({ open: false, therapist: null });
      toast({ title: "Saved", description: "Attendance updated." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openEditDialog = (t: TherapistWorkData) => {
    setEditStatus(t.status);
    setEditNotes(t.notes || "");
    setEditActualStart(t.actual_start || "");
    setEditActualEnd(t.actual_end || "");
    setEditDialog({ open: true, therapist: t });
  };

  // Export CSV (German-compatible)
  const exportMonthlyCSV = useCallback(() => {
    if (monthWorkData.length === 0) return;
    const monthLabel = format(selectedDate, "MMMM yyyy", { locale: de });
    const BOM = "\uFEFF";
    
    // Header row
    const headers = ["Therapeut", ...monthDays.map(d => format(d, "dd")),
      "Sitzungen", "Massagezeit", "Anwesenheit", "Geplant", "Pausen", "Überstunden-Min", "Auslastung %", "Anw.-Auslastung %",
      "Arbeitstage", "Krank", "Frei", "Abwesend", "Früh gegangen", "Überst.-Tage"];
    
    const rows = monthWorkData.map(t => {
      const dailyCells = t.dailyData.map(d => {
        if (d.status === "day_off") return "–";
        if (d.status === "sick") return "K";
        if (d.status === "no_show") return "X";
        if (d.status === "left_early") return `${d.sessions}/${d.sessionMinutes}m ⚠`;
        if (d.sessions > 0) return `${d.sessions}/${d.sessionMinutes}m`;
        return "";
      });
      return [
        t.therapist_name,
        ...dailyCells,
        String(t.totalSessions),
        fmtHM(t.totalSessionMinutes),
        fmtHM(t.totalPresenceMinutes),
        fmtHM(t.totalScheduledMinutes),
        fmtHM(t.totalBreakMinutes),
        String(t.totalOvertimeMinutes),
        `${t.utilization}%`,
        `${t.presenceUtilization}%`,
        String(t.workingDays),
        String(t.sickDays),
        String(t.dayOffCount),
        String(t.noShowCount),
        String(t.leftEarlyCount),
        String(t.overtimeCount),
      ];
    });

    const csv = BOM + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `MASSAVO_Arbeitszeitbericht_${format(selectedDate, "yyyy-MM")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exportiert", description: `Monatsbericht ${monthLabel} heruntergeladen.` });
  }, [monthWorkData, monthDays, selectedDate]);

  // Send monthly report via email
  const sendMonthlyReport = useMutation({
    mutationFn: async (email: string) => {
      const monthLabel = format(selectedDate, "MMMM yyyy", { locale: de });
      const reportData = {
        month: monthLabel,
        therapists: monthWorkData.map(t => ({
          name: t.therapist_name,
          total_sessions: t.totalSessions,
          session_hours: fmtHM(t.totalSessionMinutes),
          presence_hours: fmtHM(t.totalPresenceMinutes),
          scheduled_hours: fmtHM(t.totalScheduledMinutes),
          break_hours: fmtHM(t.totalBreakMinutes),
          overtime_minutes: t.totalOvertimeMinutes,
          utilization: `${t.utilization}%`,
          presence_utilization: `${t.presenceUtilization}%`,
          working_days: t.workingDays,
          sick_days: t.sickDays,
          day_off: t.dayOffCount,
          no_show: t.noShowCount,
          left_early: t.leftEarlyCount,
          overtime_days: t.overtimeCount,
        })),
        summary: {
          total_therapists: monthWorkData.length,
          total_sessions: monthWorkData.reduce((s, t) => s + t.totalSessions, 0),
          total_session_hours: fmtHM(monthWorkData.reduce((s, t) => s + t.totalSessionMinutes, 0)),
          total_presence_hours: fmtHM(monthWorkData.reduce((s, t) => s + t.totalPresenceMinutes, 0)),
          total_scheduled_hours: fmtHM(monthWorkData.reduce((s, t) => s + t.totalScheduledMinutes, 0)),
          avg_utilization: monthWorkData.length > 0 ? Math.round(monthWorkData.reduce((s, t) => s + t.utilization, 0) / monthWorkData.length) : 0,
          total_sick_days: monthWorkData.reduce((s, t) => s + t.sickDays, 0),
          total_overtime_minutes: monthWorkData.reduce((s, t) => s + t.totalOvertimeMinutes, 0),
        },
      };

      const { data, error } = await supabase.functions.invoke("send-work-report", {
        body: {
          recipient_email: email,
          report_data: reportData,
          date_range: monthLabel,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setEmailDialog(false);
      setEmailAddress("");
      toast({ title: "Gesendet", description: "Monatsbericht wurde per E-Mail versendet." });
    },
    onError: (err: any) => toast({ title: "Fehler", description: err.message, variant: "destructive" }),
  });

  // Summary stats
  const totalSessions = viewMode === "month"
    ? monthWorkData.reduce((s, t) => s + t.totalSessions, 0)
    : dayWorkData.reduce((s, t) => s + t.sessions, 0);
  const totalMinutes = viewMode === "month"
    ? monthWorkData.reduce((s, t) => s + t.totalSessionMinutes, 0)
    : dayWorkData.reduce((s, t) => s + t.total_minutes, 0);
  const activeTherapists = viewMode === "month"
    ? monthWorkData.filter(t => t.totalSessions > 0).length
    : dayWorkData.filter((t) => t.sessions > 0).length;
  const sickCount = viewMode === "month"
    ? monthWorkData.reduce((s, t) => s + t.sickDays, 0)
    : dayWorkData.filter((t) => t.status === "sick").length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-primary" />
              Work Tracking
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Therapist hours, sessions & attendance accounting
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as "day" | "week" | "month")}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day View</SelectItem>
                <SelectItem value="week">Week View</SelectItem>
                <SelectItem value="month">Month View</SelectItem>
              </SelectContent>
            </Select>
            {viewMode === "month" && (
              <>
                <Button variant="outline" size="sm" onClick={exportMonthlyCSV} disabled={monthWorkData.length === 0}>
                  <Download className="h-4 w-4 mr-1" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEmailDialog(true)} disabled={monthWorkData.length === 0}>
                  <Mail className="h-4 w-4 mr-1" /> E-Mail
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setSelectedDate((d) =>
            viewMode === "month" ? subMonths(d, 1) : subDays(d, viewMode === "week" ? 7 : 1)
          )}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button onClick={() => setSelectedDate(new Date())} className="font-display text-lg font-bold text-foreground hover:text-primary transition-colors">
            {viewMode === "day"
              ? format(selectedDate, "EEEE, d. MMMM yyyy", { locale: de })
              : viewMode === "week"
              ? `${format(weekStart, "d. MMM", { locale: de })} – ${format(weekEnd, "d. MMM yyyy", { locale: de })}`
              : format(selectedDate, "MMMM yyyy", { locale: de })}
          </button>
          <Button variant="outline" size="icon" onClick={() => setSelectedDate((d) =>
            viewMode === "month" ? addMonths(d, 1) : addDays(d, viewMode === "week" ? 7 : 1)
          )}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{activeTherapists}</p>
                  <p className="text-xs text-muted-foreground">{viewMode === "month" ? "Active Therapists" : "Active Today"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10"><Calendar className="h-5 w-5 text-emerald-400" /></div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalSessions}</p>
                  <p className="text-xs text-muted-foreground">Total Sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10"><Timer className="h-5 w-5 text-blue-400" /></div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
                  </p>
                  <p className="text-xs text-muted-foreground">Total Work Time</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10"><HeartPulse className="h-5 w-5 text-red-400" /></div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{sickCount}</p>
                  <p className="text-xs text-muted-foreground">{viewMode === "month" ? "Sick Days" : "Sick Leave"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Day View */}
        {viewMode === "day" && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">Therapist Details</CardTitle>
            </CardHeader>
            <CardContent>
              {bookingsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : dayWorkData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No therapists found</p>
              ) : (
                <div className="space-y-3">
                  {dayWorkData.map((t) => {
                    const cfg = STATUS_CONFIG[t.status];
                    const StatusIcon = cfg.icon;
                    const scheduledMinutes = t.scheduled_start && t.scheduled_end
                      ? (parseInt(t.scheduled_end.split(":")[0]) * 60 + parseInt(t.scheduled_end.split(":")[1]))
                        - (parseInt(t.scheduled_start.split(":")[0]) * 60 + parseInt(t.scheduled_start.split(":")[1]))
                      : 0;
                    const utilization = scheduledMinutes > 0 ? Math.round((t.total_minutes / scheduledMinutes) * 100) : 0;
                    return (
                      <div key={t.therapist_id} onClick={() => openEditDialog(t)}
                        className="flex items-center gap-4 p-4 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/60 cursor-pointer transition-all">
                        <div className={`p-2 rounded-lg border ${cfg.color}`}><StatusIcon className="h-5 w-5" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-foreground truncate">{t.therapist_name}</span>
                            <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {t.scheduled_start && <span>📅 {t.scheduled_start} – {t.scheduled_end}</span>}
                            {t.actual_start && <span>⏱️ {t.actual_start} – {t.actual_end || "?"}</span>}
                            {t.gym_names.length > 0 && <span>📍 {t.gym_names.join(", ")}</span>}
                          </div>
                          {t.notes && <p className="text-xs text-amber-400 mt-1 truncate">📝 {t.notes}</p>}
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <p className="text-lg font-bold text-foreground">{t.sessions}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">Sessions</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-foreground">{Math.floor(t.total_minutes / 60)}h {t.total_minutes % 60}m</p>
                            <p className="text-[10px] text-muted-foreground uppercase">Worked</p>
                          </div>
                          {scheduledMinutes > 0 && (
                            <div>
                              <p className={`text-lg font-bold ${utilization >= 80 ? "text-emerald-400" : utilization >= 50 ? "text-amber-400" : "text-red-400"}`}>{utilization}%</p>
                              <p className="text-[10px] text-muted-foreground uppercase">Util.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Week View */}
        {viewMode === "week" && (
          <Card className="bg-card border-border overflow-x-auto">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">Weekly Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="min-w-[700px]">
                <div className="grid grid-cols-[200px_repeat(7,1fr)_100px_80px] gap-2 pb-2 border-b border-border mb-2">
                  <span className="text-xs font-semibold text-muted-foreground">Therapist</span>
                  {weekDays.map((d) => (
                    <span key={d.toISOString()} className={`text-xs font-semibold text-center ${isToday(d) ? "text-primary" : "text-muted-foreground"}`}>
                      {format(d, "EEE d", { locale: de })}
                    </span>
                  ))}
                  <span className="text-xs font-semibold text-center text-muted-foreground">Total</span>
                  <span className="text-xs font-semibold text-center text-muted-foreground">Days</span>
                </div>
                {weekWorkData.map((t) => (
                  <div key={t.therapist_id} className="grid grid-cols-[200px_repeat(7,1fr)_100px_80px] gap-2 py-2 border-b border-border/50 items-center hover:bg-secondary/30">
                    <span className="text-sm font-medium text-foreground truncate">{t.therapist_name}</span>
                    {t.dailyData.map((d) => {
                      const statusCfg = STATUS_CONFIG[d.status as AttendanceStatus] || STATUS_CONFIG.working;
                      return (
                        <div key={d.date} className="text-center">
                          {d.sessions > 0 ? (
                            <div className="text-xs">
                              <span className="font-bold text-foreground">{d.sessions}</span>
                              <span className="text-muted-foreground ml-1">({d.sessionMinutes}m)</span>
                            </div>
                          ) : (
                            <Badge variant="outline" className={`text-[9px] px-1 py-0 ${statusCfg.color}`}>
                              {d.status === "day_off" ? "–" : d.status === "sick" ? "🤒" : "–"}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                    <div className="text-center">
                      <span className="text-sm font-bold text-foreground">{Math.floor(t.totalSessionMinutes / 60)}h {t.totalSessionMinutes % 60}m</span>
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-semibold text-primary">{t.workingDays}</span>
                      {t.sickDays > 0 && <span className="text-xs text-red-400 ml-1">({t.sickDays}🤒)</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Month View - Accounting Report */}
        {viewMode === "month" && (
          <div className="space-y-4">
            {bookingsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : monthWorkData.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center text-muted-foreground">
                  Keine Daten für {format(selectedDate, "MMMM yyyy", { locale: de })}
                </CardContent>
              </Card>
            ) : (
              monthWorkData.map((t) => (
                <Card key={t.therapist_id} className="bg-card border-border overflow-x-auto">
                  <CardHeader className="pb-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <CardTitle className="text-base font-semibold text-foreground">{t.therapist_name}</CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-xs">
                          {t.totalSessions} Sitzungen
                        </Badge>
                        <Badge variant="outline" className="text-blue-400 border-blue-500/30 bg-blue-500/10 text-xs">
                          {Math.floor(t.totalSessionMinutes / 60)}:{String(t.totalSessionMinutes % 60).padStart(2, "0")} Std
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${t.utilization >= 80 ? "text-emerald-400 border-emerald-500/30" : t.utilization >= 50 ? "text-amber-400 border-amber-500/30" : "text-red-400 border-red-500/30"}`}>
                          {t.utilization}% Auslastung
                        </Badge>
                        {t.sickDays > 0 && (
                          <Badge variant="outline" className="text-red-400 border-red-500/30 bg-red-500/10 text-xs">
                            {t.sickDays} Krank
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Calendar grid */}
                    <div className="min-w-[600px]">
                      <div className="grid grid-cols-7 gap-1 mb-1">
                        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(d => (
                          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {/* Empty cells for offset */}
                        {Array.from({ length: (getDay(monthStart) + 6) % 7 }).map((_, i) => (
                          <div key={`empty-${i}`} />
                        ))}
                        {t.dailyData.map((d) => {
                          const cfg = STATUS_CONFIG[d.status];
                          const dayNum = parseInt(d.date.split("-")[2]);
                          return (
                            <div key={d.date} className={`rounded-lg p-1.5 text-center border ${d.sessions > 0 ? "border-emerald-500/30 bg-emerald-500/5" : d.status === "sick" ? "border-red-500/30 bg-red-500/5" : d.status === "no_show" ? "border-red-500/20 bg-red-500/5" : "border-border/50 bg-secondary/20"}`}>
                              <div className="text-[10px] text-muted-foreground">{dayNum}</div>
                              {d.sessions > 0 ? (
                                <>
                                  <div className="text-xs font-bold text-emerald-400">{d.sessions}</div>
                                  <div className="text-[9px] text-muted-foreground">{d.sessionMinutes}m</div>
                                </>
                              ) : (
                                <div className="text-xs mt-0.5">{cfg.shortLabel}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Monthly summary — precision accounting grid */}
                    <div className="mt-4 grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 p-3 rounded-lg bg-secondary/30 border border-border/50">
                      <div className="text-center">
                        <p className="text-base font-bold text-foreground">{t.workingDays}</p>
                        <p className="text-[9px] text-muted-foreground uppercase">Arbeitstage</p>
                      </div>
                      <div className="text-center">
                        <p className="text-base font-bold text-foreground">{fmtHM(t.totalScheduledMinutes)}</p>
                        <p className="text-[9px] text-muted-foreground uppercase">Geplant</p>
                      </div>
                      <div className="text-center">
                        <p className="text-base font-bold text-foreground">{fmtHM(t.totalPresenceMinutes)}</p>
                        <p className="text-[9px] text-muted-foreground uppercase">Anwesenheit</p>
                      </div>
                      <div className="text-center">
                        <p className="text-base font-bold text-primary">{fmtHM(t.totalSessionMinutes)}</p>
                        <p className="text-[9px] text-muted-foreground uppercase">Massagezeit</p>
                      </div>
                      <div className="text-center">
                        <p className="text-base font-bold text-muted-foreground">{fmtHM(t.totalBreakMinutes)}</p>
                        <p className="text-[9px] text-muted-foreground uppercase">Pausen</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-base font-bold ${t.totalOvertimeMinutes > 0 ? "text-blue-400" : "text-muted-foreground"}`}>{fmtHM(t.totalOvertimeMinutes)}</p>
                        <p className="text-[9px] text-muted-foreground uppercase">Überstunden</p>
                      </div>
                      <div className="text-center">
                        <p className="text-base font-bold text-red-400">{t.sickDays}</p>
                        <p className="text-[9px] text-muted-foreground uppercase">Krank</p>
                      </div>
                      <div className="text-center">
                        <p className="text-base font-bold text-amber-400">{t.noShowCount}</p>
                        <p className="text-[9px] text-muted-foreground uppercase">Abwesend</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-base font-bold ${t.utilization >= 80 ? "text-emerald-400" : t.utilization >= 50 ? "text-amber-400" : "text-red-400"}`}>{t.utilization}%</p>
                        <p className="text-[9px] text-muted-foreground uppercase">Auslastung</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open, therapist: open ? editDialog.therapist : null })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" /> {editDialog.therapist?.therapist_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Status</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as AttendanceStatus)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2"><cfg.icon className="h-4 w-4" /> {cfg.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Actual Start</Label>
                <Input type="time" value={editActualStart} onChange={(e) => setEditActualStart(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm font-medium">Actual End</Label>
                <Input type="time" value={editActualEnd} onChange={(e) => setEditActualEnd(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Notes</Label>
              <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="e.g. Left at 19:00..." className="mt-1" rows={3} />
            </div>
            {editDialog.therapist && (
              <div className="p-3 rounded-lg bg-secondary/50 text-xs space-y-1">
                <p><span className="text-muted-foreground">Sessions:</span> <strong>{editDialog.therapist.sessions}</strong></p>
                <p><span className="text-muted-foreground">Time:</span> <strong>{Math.floor(editDialog.therapist.total_minutes / 60)}h {editDialog.therapist.total_minutes % 60}m</strong></p>
                {editDialog.therapist.scheduled_start && (
                  <p><span className="text-muted-foreground">Scheduled:</span> <strong>{editDialog.therapist.scheduled_start} – {editDialog.therapist.scheduled_end}</strong></p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, therapist: null })}>Cancel</Button>
            <Button
              onClick={() => {
                if (!editDialog.therapist) return;
                saveAttendance.mutate({
                  therapist_id: editDialog.therapist.therapist_id, status: editStatus,
                  notes: editNotes, actual_start: editActualStart, actual_end: editActualEnd,
                  attendance_id: editDialog.therapist.attendance_id,
                });
              }}
              disabled={saveAttendance.isPending}
            >
              {saveAttendance.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={emailDialog} onOpenChange={setEmailDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" /> Monatsbericht versenden
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Arbeitszeitbericht für <strong>{format(selectedDate, "MMMM yyyy", { locale: de })}</strong> per E-Mail versenden.
            </p>
            <div>
              <Label className="text-sm font-medium">E-Mail-Adresse</Label>
              <Input
                type="email" value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="buchhaltung@firma.de" className="mt-1"
              />
            </div>
            <div className="p-3 rounded-lg bg-secondary/50 text-xs space-y-1">
              <p><span className="text-muted-foreground">Therapeuten:</span> <strong>{monthWorkData.length}</strong></p>
              <p><span className="text-muted-foreground">Sitzungen:</span> <strong>{monthWorkData.reduce((s, t) => s + t.totalSessions, 0)}</strong></p>
              <p><span className="text-muted-foreground">Massagezeit:</span> <strong>{fmtHM(monthWorkData.reduce((s, t) => s + t.totalSessionMinutes, 0))}</strong></p>
              <p><span className="text-muted-foreground">Anwesenheit:</span> <strong>{fmtHM(monthWorkData.reduce((s, t) => s + t.totalPresenceMinutes, 0))}</strong></p>
              <p><span className="text-muted-foreground">Geplant:</span> <strong>{fmtHM(monthWorkData.reduce((s, t) => s + t.totalScheduledMinutes, 0))}</strong></p>
              <p><span className="text-muted-foreground">Kranktage:</span> <strong>{monthWorkData.reduce((s, t) => s + t.sickDays, 0)}</strong></p>
              <p><span className="text-muted-foreground">Überstunden:</span> <strong>{fmtHM(monthWorkData.reduce((s, t) => s + t.totalOvertimeMinutes, 0))}</strong></p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialog(false)}>Abbrechen</Button>
            <Button
              onClick={() => emailAddress && sendMonthlyReport.mutate(emailAddress)}
              disabled={!emailAddress || sendMonthlyReport.isPending}
            >
              {sendMonthlyReport.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminWorkTracking;
