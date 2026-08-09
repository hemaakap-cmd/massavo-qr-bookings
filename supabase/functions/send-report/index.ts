import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import {
  emailLayout, emailHeading, emailSubheading, emailParagraph,
  emailDetailRow, emailDetailTable, emailDataTable, emailMetricCard,
  emailDivider,
} from "../_shared/email-template.ts";

const RESEND_API_URL = "https://api.resend.com/emails";


interface ReportDeliveryRequest {
  report_id: string;
  delivery_channel: "email" | "whatsapp";
  recipient_email?: string;
  recipient_phone?: string;
  report_data: any;
  recipient_type: "therapist" | "gym" | "admin";
  recipient_name: string;
  date_range: string;
}

const formatTherapistEmail = (data: any, recipientName: string, dateRange: string): string => {
  const rows = data.bookings?.map((b: any) => [b.client_name, b.date, b.time, b.service_name, b.gym_name]) || [];
  const content = `
    ${emailHeading("Session Report")}
    ${emailParagraph(`Hallo ${recipientName}, hier ist Ihre Sitzungsübersicht für <strong>${dateRange}</strong>.`)}
    <div style="text-align:center;margin:16px 0;">${emailMetricCard(String(data.total_sessions || 0), "Sitzungen")}</div>
    ${rows.length > 0
      ? emailDataTable(["Kunde", "Datum", "Uhrzeit", "Service", "Standort"], rows)
      : emailParagraph("Keine Sitzungen in diesem Zeitraum.")}
  `;
  return emailLayout(content);
};

const formatGymEmail = (data: any, recipientName: string, dateRange: string): string => {
  const rows = data.bookings?.map((b: any) => [
    b.masked_customer, b.date, b.time, b.service_name,
    `€${b.session_price?.toFixed(2) || "0.00"}`,
    `<strong style="color:#22c55e;">€${b.commission_amount?.toFixed(2) || "0.00"}</strong>`
  ]) || [];

  const content = `
    ${emailHeading("Provisionsabrechnung")}
    ${emailSubheading(data.gym_name || recipientName)}
    ${emailParagraph(`Zeitraum: ${dateRange}`)}
    <div style="text-align:center;margin:16px 0;">
      ${emailMetricCard(String(data.total_sessions || 0), "Sitzungen")}
      ${emailMetricCard(`${data.commission_percentage || 0}%`, "Provision")}
      ${emailMetricCard(`€${data.total_commission?.toFixed(2) || "0.00"}`, "Gesamt")}
    </div>
    ${rows.length > 0
      ? emailDataTable(["Kunde", "Datum", "Uhrzeit", "Service", "Preis", "Provision"], rows)
      : emailParagraph("Keine Sitzungen in diesem Zeitraum.")}
    ${emailDivider()}
    ${emailParagraph("Diese Abrechnung zeigt nur Ihre Provisionseinnahmen. Plattform-Umsatzdetails sind vertraulich.")}
  `;
  return emailLayout(content);
};

const formatAdminEmail = (data: any, dateRange: string): string => {
  const content = `
    ${emailHeading("Admin Übersicht")}
    ${emailParagraph(`Zeitraum: ${dateRange}`)}
    <div style="text-align:center;margin:16px 0;">
      ${emailMetricCard(`€${data.total_revenue?.toFixed(2) || "0"}`, "Umsatz")}
      ${emailMetricCard(`€${data.total_commission?.toFixed(2) || "0"}`, "Provision")}
      ${emailMetricCard(`€${data.total_net?.toFixed(2) || "0"}`, "Netto")}
      ${emailMetricCard(String(data.total_sessions || 0), "Sitzungen")}
    </div>
  `;
  return emailLayout(content);
};

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request - only admins can send reports
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = claimsData.claims.sub;

    // Verify admin role
    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const body: ReportDeliveryRequest = await req.json();
    const { delivery_channel, recipient_email, recipient_phone, report_data, recipient_type, recipient_name, date_range } = body;

    if (delivery_channel === "email") {
      if (!recipient_email) throw new Error("Recipient email is required for email delivery");

      let htmlContent: string;
      let subject: string;

      if (recipient_type === "therapist") {
        htmlContent = formatTherapistEmail(report_data, recipient_name, date_range);
        subject = `Massavo – Session Report (${date_range})`;
      } else if (recipient_type === "gym") {
        htmlContent = formatGymEmail(report_data, recipient_name, date_range);
        subject = `Massavo – Provisionsabrechnung (${date_range})`;
      } else {
        htmlContent = formatAdminEmail(report_data, date_range);
        subject = `Massavo – Admin Report (${date_range})`;
      }

      const emailResponse = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "Massavo Reports <noreply@massavo.com>", to: [recipient_email], subject, html: htmlContent }),
      });

      const emailResult = await emailResponse.json();
      if (!emailResponse.ok) throw new Error(emailResult.message || "Failed to send email");

      console.log("Email sent:", emailResult);
      return new Response(JSON.stringify({ success: true, channel: "email", messageId: emailResult.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (delivery_channel === "whatsapp") {
      let message = "";
      if (recipient_type === "therapist") {
        message = `📋 *Massavo Session Report*\n\nHallo ${recipient_name},\n\n📅 Zeitraum: ${date_range}\n📊 Sitzungen: ${report_data.total_sessions || 0}`;
      } else if (recipient_type === "gym") {
        message = `📋 *Massavo Provisionsabrechnung*\n\n🏋️ ${report_data.gym_name}\n📅 Zeitraum: ${date_range}\n💰 Provision: ${report_data.commission_percentage}%\n📊 Sitzungen: ${report_data.total_sessions || 0}\n💵 Gesamt: €${report_data.total_commission?.toFixed(2) || 0}`;
      }
      console.log("WhatsApp message to send:", { phone: recipient_phone, message });
      return new Response(JSON.stringify({ success: true, channel: "whatsapp", note: "WhatsApp delivery logged" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error(`Unsupported delivery channel: ${delivery_channel}`);
  } catch (error: unknown) {
    console.error("Report delivery error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
