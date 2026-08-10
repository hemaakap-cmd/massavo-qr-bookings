import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from "date-fns";
import type { 
  ReportType, 
  RecipientType, 
  GeneratedReport, 
  TherapistReportData, 
  GymReportData, 
  AdminReportData,
  ReportGenerationParams 
} from "@/types/reporting";

// Mask customer name for privacy - show only family name for multi-part names
const maskCustomerName = (name: string | null): string => {
  if (!name) return "Anonymous";
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : name;
};

export const useReportGeneration = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch report templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["report-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_templates")
        .select("*")
        .eq("is_active", true)
        .order("recipient_type", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Generate therapist report data
  const generateTherapistReport = async (
    therapistId: string,
    dateFrom: string,
    dateTo: string
  ): Promise<TherapistReportData> => {
    // Get therapist info
    const { data: therapist, error: therapistError } = await supabase
      .from("therapists")
      .select("name")
      .eq("id", therapistId)
      .single();

    if (therapistError) throw therapistError;

    // Get bookings for this therapist (no financial data)
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select(`
        customer_name,
        booking_date,
        booking_time,
        services:service_id(name),
        gyms:gym_id(name)
      `)
      .eq("therapist_id", therapistId)
      .gte("booking_date", dateFrom)
      .lte("booking_date", dateTo)
      .in("status", ["confirmed", "completed"])
      .order("booking_date", { ascending: true });

    if (bookingsError) throw bookingsError;

    return {
      therapist_name: therapist.name,
      date_range: `${format(new Date(dateFrom), "dd.MM.yyyy")} - ${format(new Date(dateTo), "dd.MM.yyyy")}`,
      bookings: (bookings || []).map((b: any) => ({
        client_name: maskCustomerName(b.customer_name),
        date: format(new Date(b.booking_date), "dd.MM.yyyy"),
        time: b.booking_time,
        service_name: b.services?.name || "Unknown",
        gym_name: b.gyms?.name || "Unknown",
      })),
      total_sessions: bookings?.length || 0,
    };
  };

  // Generate gym report data (commission only - no platform revenue)
  const generateGymReport = async (
    gymId: string,
    dateFrom: string,
    dateTo: string
  ): Promise<GymReportData> => {
    // Get gym info with commission percentage
    const { data: gym, error: gymError } = await supabase
      .from("gyms")
      .select("name, commission_percentage")
      .eq("id", gymId)
      .single();

    if (gymError) throw gymError;

    const commissionPercentage = gym.commission_percentage || 20;

    // Get bookings for this gym
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select(`
        customer_name,
        booking_date,
        booking_time,
        total_amount,
        services:service_id(name)
      `)
      .eq("gym_id", gymId)
      .gte("booking_date", dateFrom)
      .lte("booking_date", dateTo)
      .in("status", ["confirmed", "completed"])
      .order("booking_date", { ascending: true });

    if (bookingsError) throw bookingsError;

    const reportBookings = (bookings || []).map((b: any) => {
      const sessionPrice = Number(b.total_amount) || 0;
      const commissionAmount = sessionPrice * (commissionPercentage / 100);
      return {
        masked_customer: maskCustomerName(b.customer_name),
        date: format(new Date(b.booking_date), "dd.MM.yyyy"),
        time: b.booking_time,
        service_name: b.services?.name || "Unknown",
        session_price: sessionPrice,
        commission_amount: commissionAmount,
      };
    });

    const totalCommission = reportBookings.reduce((sum, b) => sum + b.commission_amount, 0);

    return {
      gym_name: gym.name,
      date_range: `${format(new Date(dateFrom), "dd.MM.yyyy")} - ${format(new Date(dateTo), "dd.MM.yyyy")}`,
      commission_percentage: commissionPercentage,
      bookings: reportBookings,
      total_sessions: reportBookings.length,
      total_commission: totalCommission,
    };
  };

  // Generate admin report data (full platform overview)
  const generateAdminReport = async (
    dateFrom: string,
    dateTo: string
  ): Promise<AdminReportData> => {
    // Get all bookings with gym and therapist info
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select(`
        total_amount,
        gyms:gym_id(id, name, commission_percentage),
        therapists:therapist_id(id, name)
      `)
      .gte("booking_date", dateFrom)
      .lte("booking_date", dateTo)
      .in("status", ["confirmed", "completed"]);

    if (bookingsError) throw bookingsError;

    // Aggregate by gym
    const gymStats: Record<string, { name: string; sessions: number; revenue: number; commission: number }> = {};
    const therapistStats: Record<string, { name: string; sessions: number }> = {};

    let totalRevenue = 0;
    let totalCommission = 0;

    (bookings || []).forEach((b: any) => {
      const amount = Number(b.total_amount) || 0;
      const commissionPct = b.gyms?.commission_percentage || 20;
      const commission = amount * (commissionPct / 100);

      totalRevenue += amount;
      totalCommission += commission;

      // Gym stats
      if (b.gyms?.id) {
        if (!gymStats[b.gyms.id]) {
          gymStats[b.gyms.id] = { name: b.gyms.name, sessions: 0, revenue: 0, commission: 0 };
        }
        gymStats[b.gyms.id].sessions++;
        gymStats[b.gyms.id].revenue += amount;
        gymStats[b.gyms.id].commission += commission;
      }

      // Therapist stats
      if (b.therapists?.id) {
        if (!therapistStats[b.therapists.id]) {
          therapistStats[b.therapists.id] = { name: b.therapists.name, sessions: 0 };
        }
        therapistStats[b.therapists.id].sessions++;
      }
    });

    return {
      date_range: `${format(new Date(dateFrom), "dd.MM.yyyy")} - ${format(new Date(dateTo), "dd.MM.yyyy")}`,
      total_revenue: totalRevenue,
      total_commission: totalCommission,
      total_net: totalRevenue - totalCommission,
      total_sessions: bookings?.length || 0,
      gyms: Object.values(gymStats).sort((a, b) => b.sessions - a.sessions),
      therapists: Object.values(therapistStats).sort((a, b) => b.sessions - a.sessions),
    };
  };

  // Main report generation mutation
  const generateReport = useMutation({
    mutationFn: async (params: ReportGenerationParams) => {
      const { report_type, recipient_type, recipient_id, date_from, date_to } = params;

      let reportData: TherapistReportData | GymReportData | AdminReportData;
      let recipientName: string | null = null;
      let recipientEmail: string | null = null;

      if (recipient_type === "therapist" && recipient_id) {
        reportData = await generateTherapistReport(recipient_id, date_from, date_to);
        recipientName = (reportData as TherapistReportData).therapist_name;

        // Get therapist email from private info table
        const { data: therapistPI } = await supabase
          .from("therapist_private_info")
          .select("email")
          .eq("therapist_id", recipient_id)
          .maybeSingle();
        recipientEmail = (therapistPI as any)?.email || null;

      } else if (recipient_type === "gym" && recipient_id) {
        reportData = await generateGymReport(recipient_id, date_from, date_to);
        recipientName = (reportData as GymReportData).gym_name;

        // Get gym contact email
        const { data: gymContact } = await supabase
          .from("gym_contacts")
          .select("manager_email")
          .eq("gym_id", recipient_id)
          .single();
        recipientEmail = gymContact?.manager_email || null;

      } else {
        reportData = await generateAdminReport(date_from, date_to);
        recipientName = "MASSAVO Admin";
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Save generated report
      const { data: report, error } = await supabase
        .from("generated_reports")
        .insert({
          report_type,
          recipient_type,
          recipient_id: recipient_id || null,
          recipient_name: recipientName,
          recipient_email: recipientEmail,
          date_from,
          date_to,
          report_data: reportData as any,
          generated_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return report;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generated-reports"] });
      toast({
        title: "Report Generated",
        description: "The report has been generated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Helper to get date ranges
  const getDateRange = (period: "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month") => {
    const now = new Date();
    switch (period) {
      case "today":
        return { from: format(startOfDay(now), "yyyy-MM-dd"), to: format(endOfDay(now), "yyyy-MM-dd") };
      case "yesterday": {
        const yesterday = subDays(now, 1);
        return { from: format(startOfDay(yesterday), "yyyy-MM-dd"), to: format(endOfDay(yesterday), "yyyy-MM-dd") };
      }
      case "this_week":
        return { from: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"), to: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd") };
      case "last_week": {
        const lastWeek = subWeeks(now, 1);
        return { from: format(startOfWeek(lastWeek, { weekStartsOn: 1 }), "yyyy-MM-dd"), to: format(endOfWeek(lastWeek, { weekStartsOn: 1 }), "yyyy-MM-dd") };
      }
      case "this_month":
        return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(endOfMonth(now), "yyyy-MM-dd") };
      case "last_month": {
        const lastMonth = subMonths(now, 1);
        return { from: format(startOfMonth(lastMonth), "yyyy-MM-dd"), to: format(endOfMonth(lastMonth), "yyyy-MM-dd") };
      }
    }
  };

  return {
    templates,
    templatesLoading,
    generateReport,
    getDateRange,
  };
};
