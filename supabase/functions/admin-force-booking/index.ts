import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";


Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is super_admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check super_admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["super_admin"]);

    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: "Super admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      gym_id,
      hotel_id,
      service_id,
      booking_date,
      booking_time,
      customer_email,
      customer_name,
      therapist_id,
      notes,
    } = body;

    if ((!gym_id && !hotel_id) || !service_id || !booking_date || !booking_time || !customer_email) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (gym_id && hotel_id) {
      return new Response(JSON.stringify({ error: "Provide either gym_id or hotel_id, not both" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get service price
    const { data: service } = await adminClient
      .from("services")
      .select("price, duration_minutes")
      .eq("id", service_id)
      .single();

    if (!service) {
      return new Response(JSON.stringify({ error: "Service not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Force insert — bypasses all slot availability checks
    const { data: booking, error: insertError } = await adminClient
      .from("bookings")
      .insert({
        gym_id: gym_id || null,
        hotel_id: hotel_id || null,
        service_id,
        booking_date,
        booking_time: booking_time + ":00",
        customer_email,
        customer_name: customer_name || null,
        total_amount: service.price,
        payment_status: "admin_override",
        status: "confirmed",
        therapist_id: therapist_id || null,
        notes: notes ? `[ADMIN OVERRIDE] ${notes}` : "[ADMIN OVERRIDE]",
        cancellation_token: crypto.randomUUID(),
      })
      .select("id")
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the override action
    await adminClient.from("admin_audit_log").insert({
      admin_user_id: user.id,
      action: "force_booking",
      entity_type: "booking",
      entity_id: booking.id,
      changes: { gym_id: gym_id || null, hotel_id: hotel_id || null, service_id, booking_date, booking_time, customer_email, therapist_id },
      metadata: { override: true, reason: notes || "Admin force booking" },
    });

    return new Response(JSON.stringify({ success: true, booking_id: booking.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
