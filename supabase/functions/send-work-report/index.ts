import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import {
  emailLayout, emailHeading, emailSubheading, emailParagraph,
  emailDataTable, emailMetricCard, emailDivider,
} from "../_shared/email-template.ts";

const RESEND_API_URL = "https://api.resend.com/emails";


serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const { data: isSuperAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "super_admin" });
    if (!isAdmin && !isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const body = await req.json();
    const { recipient_email, report_data, date_range } = body;
    if (!recipient_email) throw new Error("recipient_email is required");

    const { month, therapists, summary } = report_data;

    // Build precision accounting table
    const tableRows = (therapists || []).map((t: any) => [
      t.name,
      String(t.total_sessions),
      t.session_hours || "0:00",
      t.presence_hours || "0:00",
      t.scheduled_hours || "0:00",
      t.break_hours || "0:00",
      String(t.overtime_minutes || 0) + "m",
      t.utilization || "0%",
      String(t.working_days),
      String(t.sick_days),
      String(t.no_show),
    ]);

    const htmlContent = emailLayout(`
      ${emailHeading("Arbeitszeitbericht")}
      ${emailSubheading(month || date_range)}
      ${emailParagraph("Präziser monatlicher Arbeitszeitbericht — alle Zeiten in Stunden:Minuten.")}
      
      <div style="text-align:center;margin:16px 0;">
        ${emailMetricCard(String(summary?.total_therapists || 0), "Therapeuten")}
        ${emailMetricCard(String(summary?.total_sessions || 0), "Sitzungen")}
        ${emailMetricCard(summary?.total_session_hours || "0:00", "Massagezeit")}
        ${emailMetricCard(summary?.total_presence_hours || "0:00", "Anwesenheit")}
        ${emailMetricCard(summary?.total_scheduled_hours || "0:00", "Geplant")}
      </div>

      <div style="text-align:center;margin:8px 0;">
        ${emailMetricCard(`${summary?.avg_utilization || 0}%`, "Ø Auslastung")}
        ${emailMetricCard(String(summary?.total_sick_days || 0), "Kranktage")}
        ${emailMetricCard(String(summary?.total_overtime_minutes || 0) + "m", "Überstunden")}
      </div>

      ${emailDivider()}

      ${tableRows.length > 0
        ? emailDataTable(
            ["Therapeut", "Sitz.", "Massage", "Anwes.", "Geplant", "Pausen", "Überst.", "Ausl.", "Tage", "Krank", "Abw."],
            tableRows
          )
        : emailParagraph("Keine Daten für diesen Zeitraum.")
      }

      ${emailDivider()}
      ${emailParagraph("<strong>Legende:</strong> Massage = reine Behandlungszeit · Anwes. = Anwesenheitszeit (Ein-/Ausstempeln) · Pausen = Anwes. − Massage · Überst. = Anwes. über Geplant · Ausl. = Massage ÷ Geplant")}
      ${emailParagraph("Automatisch generiert von MASSAVO. Bei Fragen: info@massavo.com")}
    `);

    const emailResponse = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Massavo Reports <noreply@massavo.com>",
        to: [recipient_email],
        subject: `Massavo – Arbeitszeitbericht ${month || date_range}`,
        html: htmlContent,
      }),
    });

    const emailResult = await emailResponse.json();
    if (!emailResponse.ok) throw new Error(emailResult.message || "Failed to send email");

    return new Response(JSON.stringify({ success: true, messageId: emailResult.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    console.error("Work report error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
