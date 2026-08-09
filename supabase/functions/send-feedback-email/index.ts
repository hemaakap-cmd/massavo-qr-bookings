import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emailLayout, emailHeading, emailGreeting, emailParagraph, emailButton, emailDetailTable, emailDetailRow, emailSignature, emailDivider, emailNotice, emailSubheading, BRAND_COLOR, TEXT_COLOR, TEXT_MUTED, BG_WARM, BORDER_LIGHT } from "../_shared/email-template.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";


function getIntensityColor(intensity: number): string {
  if (intensity <= 3) return "#22c55e";
  if (intensity <= 6) return "#eab308";
  if (intensity <= 8) return "#f97316";
  return "#ef4444";
}

function getTrendLabel(direction: string): { label: string; icon: string; color: string } {
  switch (direction) {
    case "improving": return { label: "Verbessert", icon: "📉", color: "#22c55e" };
    case "worsening": return { label: "Verschlechtert", icon: "📈", color: "#ef4444" };
    default: return { label: "Stabil", icon: "➡️", color: TEXT_MUTED };
  }
}

function buildPainEvolutionHtml(trends: Array<{ areaLabel: string; firstValue: number; latestValue: number; direction: string; sessionCount: number }>): string {
  if (!trends.length) return "";

  const rows = trends.map(t => {
    const trend = getTrendLabel(t.direction);
    return `<tr>
      <td style="padding:8px 10px;font-size:12px;color:${TEXT_COLOR};border-bottom:1px solid ${BORDER_LIGHT};font-weight:500;">${t.areaLabel}</td>
      <td style="padding:8px 10px;font-size:12px;border-bottom:1px solid ${BORDER_LIGHT};text-align:center;">
        <span style="color:${getIntensityColor(t.firstValue)};font-weight:700;">${t.firstValue}</span>
        <span style="color:${TEXT_MUTED};margin:0 3px;">→</span>
        <span style="color:${getIntensityColor(t.latestValue)};font-weight:700;">${t.latestValue}</span>
      </td>
      <td style="padding:8px 10px;font-size:11px;border-bottom:1px solid ${BORDER_LIGHT};text-align:center;color:${trend.color};font-weight:600;">${trend.icon} ${trend.label}</td>
      <td style="padding:8px 10px;font-size:11px;border-bottom:1px solid ${BORDER_LIGHT};text-align:center;color:${TEXT_MUTED};">${t.sessionCount}x</td>
    </tr>`;
  }).join("");

  const thStyle = `padding:7px 10px;font-size:9px;font-weight:700;color:#a09a94;text-transform:uppercase;letter-spacing:0.8px;border-bottom:2px solid ${BORDER_LIGHT};text-align:left;`;

  return `
    ${emailDivider()}
    ${emailHeading("📊 Ihre Schmerzentwicklung")}
    ${emailParagraph("Basierend auf Ihren bisherigen Sitzungen sehen Sie hier, wie sich Ihre Beschwerden entwickelt haben:")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 18px;border-collapse:collapse;background:${BG_WARM};border-radius:10px;overflow:hidden;">
      <thead><tr>
        <th style="${thStyle}">Bereich</th>
        <th style="${thStyle}text-align:center;">Intensität</th>
        <th style="${thStyle}text-align:center;">Trend</th>
        <th style="${thStyle}text-align:center;">Sitzungen</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildCurrentSessionAreasHtml(areas: Array<{ area_label: string; pain_intensity: number; is_focus: boolean; side: string }>): string {
  if (!areas.length) return "";

  const areaItems = areas.map(a => {
    const focusBadge = a.is_focus
      ? `<span style="display:inline-block;background:#fef3c7;color:#b45309;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;margin-left:6px;letter-spacing:0.3px;">FOKUS</span>`
      : "";
    return `<tr>
      <td style="padding:6px 10px;font-size:12px;color:${TEXT_COLOR};border-bottom:1px solid ${BORDER_LIGHT};">
        ${a.area_label}${focusBadge}
      </td>
      <td style="padding:6px 10px;font-size:12px;border-bottom:1px solid ${BORDER_LIGHT};text-align:right;">
        <span style="color:${getIntensityColor(a.pain_intensity)};font-weight:700;">${a.pain_intensity}/10</span>
      </td>
    </tr>`;
  }).join("");

  return `
    ${emailDivider()}
    ${emailHeading("🧘 Behandelte Bereiche dieser Sitzung")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 18px;border-collapse:collapse;background:${BG_WARM};border-radius:10px;overflow:hidden;">
      <tbody>${areaItems}</tbody>
    </table>
  `;
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);

    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from("bookings")
      .select("id, customer_name, customer_email, booking_date, booking_time, therapist_id, gym_id, hotel_id, service_id")
      .eq("status", "completed")
      .eq("payment_status", "paid");

    if (bookingsError) throw bookingsError;

    const eligibleBookings = (bookings || []).filter((b) => {
      const bookingEnd = new Date(`${b.booking_date}T${b.booking_time}`);
      const sessionEnd = new Date(bookingEnd.getTime() + 60 * 60 * 1000);
      return sessionEnd <= oneHourAgo && sessionEnd >= twoHoursAgo;
    });

    if (eligibleBookings.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No eligible bookings" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bookingIds = eligibleBookings.map((b) => b.id);
    const { data: existingFeedback } = await supabaseAdmin
      .from("booking_feedback")
      .select("booking_id, feedback_email_sent_at, therapist_advice")
      .in("booking_id", bookingIds);

    const sentBookingIds = new Set(
      (existingFeedback || []).filter((f) => f.feedback_email_sent_at).map((f) => f.booking_id)
    );

    const toSend = eligibleBookings.filter((b) => !sentBookingIds.has(b.id));

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    let sentCount = 0;

    for (const booking of toSend) {
      let feedbackToken: string;
      let therapistAdvice: string | null = null;
      const existingEntry = (existingFeedback || []).find((f) => f.booking_id === booking.id);

      if (!existingEntry) {
        const firstName = booking.customer_name?.split(" ")[0] || "Kunde";
        const { data: newFeedback, error: insertErr } = await supabaseAdmin
          .from("booking_feedback")
          .insert({
            booking_id: booking.id,
            therapist_id: booking.therapist_id,
            gym_id: booking.gym_id,
            customer_first_name: firstName,
          })
          .select("feedback_token, therapist_advice")
          .single();

        if (insertErr) {
          console.error(`Failed to create feedback for booking ${booking.id}:`, insertErr);
          continue;
        }
        feedbackToken = newFeedback.feedback_token;
        therapistAdvice = newFeedback.therapist_advice;
      } else {
        const { data: tokenData } = await supabaseAdmin
          .from("booking_feedback")
          .select("feedback_token, therapist_advice")
          .eq("booking_id", booking.id)
          .single();
        feedbackToken = tokenData?.feedback_token || "";
        therapistAdvice = tokenData?.therapist_advice || null;
      }

      if (!feedbackToken) continue;

      // Get venue (gym or hotel) name, service name, therapist name in parallel
      const venuePromise = booking.hotel_id
        ? supabaseAdmin.from("hotels").select("name").eq("id", booking.hotel_id).single()
        : supabaseAdmin.from("gyms").select("name").eq("id", booking.gym_id).single();
      const [venueRes, serviceRes, therapistRes] = await Promise.all([
        venuePromise,
        supabaseAdmin.from("services").select("name").eq("id", booking.service_id).single(),
        booking.therapist_id
          ? supabaseAdmin.from("therapists").select("name").eq("id", booking.therapist_id).single()
          : Promise.resolve({ data: null }),
      ]);

      const gymName = (venueRes as any).data?.name || "—";
      const serviceName = serviceRes.data?.name || "Massage";
      const therapistName = therapistRes.data?.name || "";

      // Fetch body areas for THIS booking
      const { data: currentAreas } = await supabaseAdmin
        .from("booking_body_areas")
        .select("area_label, pain_intensity, is_focus, side")
        .eq("booking_id", booking.id)
        .order("is_focus", { ascending: false });

      // Fetch pain evolution: all bookings for this customer
      let painTrends: Array<{ areaLabel: string; firstValue: number; latestValue: number; direction: string; sessionCount: number }> = [];

      const { data: allBookings } = await supabaseAdmin
        .from("bookings")
        .select("id, booking_date")
        .eq("customer_email", booking.customer_email)
        .order("booking_date", { ascending: true });

      if (allBookings && allBookings.length >= 2) {
        const allIds = allBookings.map(b => b.id);
        const { data: allAreas } = await supabaseAdmin
          .from("booking_body_areas")
          .select("booking_id, area_code, area_label, pain_intensity")
          .in("booking_id", allIds);

        if (allAreas && allAreas.length > 0) {
          // Group by area
          const areaMap = new Map<string, { label: string; values: number[] }>();
          // Process in booking date order
          const bookingOrder = new Map(allBookings.map((b, i) => [b.id, i]));
          const sortedAreas = [...allAreas].sort((a, b) =>
            (bookingOrder.get(a.booking_id) || 0) - (bookingOrder.get(b.booking_id) || 0)
          );

          for (const a of sortedAreas) {
            if (!areaMap.has(a.area_code)) {
              areaMap.set(a.area_code, { label: a.area_label, values: [] });
            }
            areaMap.get(a.area_code)!.values.push(a.pain_intensity || 0);
          }

          painTrends = Array.from(areaMap.entries())
            .filter(([, { values }]) => values.length >= 2)
            .map(([, { label, values }]) => {
              const first = values[0];
              const latest = values[values.length - 1];
              const diff = latest - first;
              const direction = diff <= -1 ? "improving" : diff >= 1 ? "worsening" : "stable";
              return {
                areaLabel: label,
                firstValue: first,
                latestValue: latest,
                direction,
                sessionCount: values.length,
              };
            });
        }
      }

      const feedbackUrl = `https://massavo-qr-bookings.lovable.app/feedback?token=${feedbackToken}`;
      const firstName = booking.customer_name?.split(" ")[0] || "geschätzter Kunde";

      const emailParts: string[] = [
        emailHeading("Wie war Ihre Massage?"),
        emailGreeting(firstName),
        emailParagraph("Wir hoffen, Sie haben Ihre Massage genossen! Ihr Feedback hilft uns, unseren Service kontinuierlich zu verbessern."),
        emailDetailTable(
          emailDetailRow("Service", serviceName) +
          emailDetailRow("Standort", gymName) +
          emailDetailRow("Datum", booking.booking_date) +
          (therapistName ? emailDetailRow("Therapeut/in", therapistName) : "")
        ),
      ];

      // Include therapist advice if available
      if (therapistAdvice && therapistAdvice.trim()) {
        emailParts.push(
          emailDivider(),
          emailHeading("💡 Empfehlung Ihres Therapeuten"),
          emailNotice(therapistAdvice, "info"),
          emailParagraph("Diese persönliche Empfehlung wurde speziell für Sie von Ihrem Therapeuten hinterlassen."),
        );
      }

      // Include current session body areas
      if (currentAreas && currentAreas.length > 0) {
        emailParts.push(buildCurrentSessionAreasHtml(currentAreas as any));
      }

      // Include pain evolution trends (only if 2+ sessions)
      if (painTrends.length > 0) {
        emailParts.push(buildPainEvolutionHtml(painTrends));
      }

      emailParts.push(
        emailDivider(),
        emailParagraph("Bitte nehmen Sie sich einen kurzen Moment, um Ihre Erfahrung zu bewerten:"),
        emailButton("Jetzt bewerten ⭐", feedbackUrl),
        emailDivider(),
        emailParagraph("Ihre Bewertung dauert nur 30 Sekunden und hilft anderen Kunden bei der Entscheidung."),
        emailSignature(),
      );

      const hasExtraContent = !!(therapistAdvice?.trim()) || (currentAreas && currentAreas.length > 0) || painTrends.length > 0;

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "MASSAVO <noreply@massavo.com>",
          to: [booking.customer_email],
          subject: hasExtraContent
            ? "⭐ Ihre Massage-Bewertung & persönlicher Sitzungsbericht"
            : "⭐ Wie war Ihre Massage? — Bewerten Sie Ihre Erfahrung",
          html: emailLayout(emailParts.join("")),
        }),
      });

      if (emailRes.ok) {
        await supabaseAdmin
          .from("booking_feedback")
          .update({ feedback_email_sent_at: new Date().toISOString() })
          .eq("booking_id", booking.id);
        sentCount++;
      } else {
        console.error(`Failed to send email for booking ${booking.id}:`, await emailRes.text());
      }
    }

    return new Response(JSON.stringify({ sent: sentCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-feedback-email error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
