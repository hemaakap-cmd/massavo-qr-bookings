import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { ReportDeliveryLog, DeliveryMethod, GeneratedReport } from "@/types/reporting";

export const useDeliveryLogs = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all delivery logs with report info
  const { data: deliveryLogs, isLoading, error, refetch } = useQuery({
    queryKey: ["delivery-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_delivery_logs")
        .select(`
          *,
          generated_reports:report_id(
            id,
            report_type,
            recipient_type,
            recipient_name,
            date_from,
            date_to
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as ReportDeliveryLog[];
    },
  });

  // Fetch generated reports
  const { data: generatedReports, isLoading: reportsLoading } = useQuery({
    queryKey: ["generated-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as unknown as GeneratedReport[];
    },
  });

  // Create delivery log entry (when sending report)
  const createDeliveryLog = useMutation({
    mutationFn: async (params: {
      report_id: string;
      delivery_channel: DeliveryMethod;
      recipient_email?: string;
      recipient_phone?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("report_delivery_logs")
        .insert({
          report_id: params.report_id,
          delivery_channel: params.delivery_channel,
          recipient_email: params.recipient_email || null,
          recipient_phone: params.recipient_phone || null,
          delivery_status: "pending",
          sent_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-logs"] });
    },
  });

  // Update delivery status
  const updateDeliveryStatus = useMutation({
    mutationFn: async (params: {
      id: string;
      status: "pending" | "sent" | "failed" | "resent";
      error_message?: string;
    }) => {
      const { data, error } = await supabase
        .from("report_delivery_logs")
        .update({
          delivery_status: params.status,
          sent_at: params.status === "sent" || params.status === "resent" ? new Date().toISOString() : null,
          error_message: params.error_message || null,
        })
        .eq("id", params.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-logs"] });
    },
  });

  // Get logs for a specific report
  const getLogsForReport = async (reportId: string): Promise<ReportDeliveryLog[]> => {
    const { data, error } = await supabase
      .from("report_delivery_logs")
      .select("*")
      .eq("report_id", reportId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as ReportDeliveryLog[];
  };

  // Get activity summary
  const { data: activitySummary } = useQuery({
    queryKey: ["delivery-activity-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_delivery_logs")
        .select("delivery_status, delivery_channel")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      const summary = {
        total: data.length,
        sent: data.filter(d => d.delivery_status === "sent" || d.delivery_status === "resent").length,
        failed: data.filter(d => d.delivery_status === "failed").length,
        pending: data.filter(d => d.delivery_status === "pending").length,
        byChannel: {
          email: data.filter(d => d.delivery_channel === "email").length,
          whatsapp: data.filter(d => d.delivery_channel === "whatsapp").length,
        },
      };

      return summary;
    },
  });

  return {
    deliveryLogs,
    generatedReports,
    isLoading,
    reportsLoading,
    error,
    refetch,
    createDeliveryLog,
    updateDeliveryStatus,
    getLogsForReport,
    activitySummary,
  };
};
