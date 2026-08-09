import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import {
  emailLayout, emailHeading, emailGreeting, emailParagraph,
  emailSubheading, emailDetailRow, emailDetailTable, emailDataTable,
  emailSignature, emailMetricCard,
} from "../_shared/email-template.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

interface RequestBody {
  therapist_id: string;
  date: string;
  delivery_method: "email" | "whatsapp" | "both";
}

const maskName = (name: string | null): string => {
  if (!name) return "Kunde";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0] + "***";
  return parts[0][0] + "*** " + parts[parts.length - 1][0] + "***";
};

const formatTime = (time: string): string => time.slice(0, 5);

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.user.id;

    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { therapist_id, date, delivery_method }: RequestBody = await req.json();

    const { data: therapist, error: therapistError } = await supabase.from("therapists").select("id, name, phone, email").eq("id", therapist_id).single();
    if (therapistError || !therapist) throw new Error("Therapist not found");

    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select(`id, booking_date, booking_time, customer_name, gym_id, hotel_id, services (name, duration_minutes), gyms (name, address), hotels (name, address)`)
      .eq("therapist_id", therapist_id).eq("booking_date", date)
      .in("status", ["confirmed", "pending"]).order("booking_time");

    if (bookingsError) throw new Error("Failed to fetch bookings");
    if (!bookings || bookings.length === 0) {
      return new Response(JSON.stringify({ error: "No bookings found for this therapist on the selected date" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const displayDate = new Date(date).toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const sessionsSummary = bookings.map((b: any) => ({
      time: formatTime(b.booking_time),
      customer: maskName(b.customer_name),
      service: b.services?.name || "Massage",
      duration: b.services?.duration_minutes || 60,
      location: b.gyms?.name || b.hotels?.name || "Location TBD",
      address: b.gyms?.address || b.hotels?.address || "",
      venueType: b.hotel_id ? "Hotel" : "Gym",
    }));

    let emailSent = false;
    let whatsappSent = false;
    let errorMessage: string | null = null;

    if ((delivery_method === "email" || delivery_method === "both") && therapist.email) {
      if (!resendApiKey) {
        errorMessage = "Email service not configured";
      } else {
        try {
          const resend = new Resend(resendApiKey);

          const tableRows = sessionsSummary.map((s: any) => [
            `<strong>${s.time}</strong>`,
            s.customer,
            `${s.service} (${s.duration} Min)`,
            s.location,
          ]);

          const content = `
            ${emailHeading(`Tagesplan – ${displayDate}`)}
            ${emailGreeting(therapist.name)}
            ${emailParagraph(`Hier ist dein Tagesplan mit <strong>${bookings.length} Termin(en)</strong>.`)}
            ${emailDataTable(["Uhrzeit", "Kunde", "Service", "Standort"], tableRows)}
            ${emailParagraph("Bitte melde dich rechtzeitig am jeweiligen Standort.")}
            ${emailSignature()}
          `;

          await resend.emails.send({
            from: "Massavo <noreply@massavo.com>",
            to: [therapist.email],
            subject: `Tagesplan – ${displayDate}`,
            html: emailLayout(content),
          });

          emailSent = true;
          console.log(`Email sent to ${therapist.email}`);
        } catch (emailError: any) {
          console.error("Email send error:", emailError);
          errorMessage = emailError.message;
        }
      }
    }

    if ((delivery_method === "whatsapp" || delivery_method === "both") && therapist.phone) {
      const whatsappMessage = `*Tagesplan für ${displayDate}*\n\nHallo ${therapist.name}!\n\nDu hast ${bookings.length} Termin(e) heute:\n\n${sessionsSummary.map((s: any) => `⏰ *${s.time} Uhr*\n👤 ${s.customer}\n💆 ${s.service} (${s.duration} Min)\n📍 ${s.location}\n${s.address ? `📫 ${s.address}` : ""}`).join("\n---\n")}\n\nBitte melde dich rechtzeitig!\n\nBei Fragen: info@massavo.com`.trim();
      console.log("WhatsApp message prepared:", whatsappMessage);
      const encodedMessage = encodeURIComponent(whatsappMessage);
      const cleanPhone = therapist.phone.replace(/[^0-9+]/g, "");
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
      whatsappSent = true;
    }

    let deliveryStatus: "sent" | "failed" | "resent" = "sent";
    if (!emailSent && !whatsappSent) deliveryStatus = "failed";

    const { data: existingSend } = await supabase.from("therapist_daily_sends").select("id, delivery_status").eq("therapist_id", therapist_id).eq("assignment_date", date).maybeSingle();
    if (existingSend && existingSend.delivery_status === "sent") deliveryStatus = "resent";

    const { error: upsertError } = await supabase.from("therapist_daily_sends").upsert(
      { therapist_id, assignment_date: date, delivery_method, delivery_status: deliveryStatus, sent_at: new Date().toISOString(), sent_by: userId, error_message: errorMessage },
      { onConflict: "therapist_id,assignment_date" }
    );
    if (upsertError) console.error("Failed to update send record:", upsertError);

    return new Response(
      JSON.stringify({ success: deliveryStatus !== "failed", email_sent: emailSent, whatsapp_sent: whatsappSent, status: deliveryStatus, message: deliveryStatus === "failed" ? errorMessage || "Failed to send summary" : "Summary sent successfully" }),
      { status: deliveryStatus === "failed" ? 500 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-therapist-daily-summary:", error);
    let userMessage = "Failed to send summary. Please try again later.";
    if (error instanceof Error) {
      if (error.message.includes("Therapist not found")) userMessage = "Therapist not found.";
      else if (error.message.includes("No bookings")) userMessage = "No bookings found for this date.";
    }
    return new Response(JSON.stringify({ error: userMessage }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
