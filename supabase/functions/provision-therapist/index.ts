import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }

    const callerId = claimsData.claims.sub as string;

    // Verify caller is admin or super_admin
    const { data: callerRoles } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);

    const isAdmin = (callerRoles || []).some(
      (r: any) => r.role === "admin" || r.role === "super_admin"
    );
    if (!isAdmin) {
      return json({ error: "Forbidden" }, 403);
    }

    const { email, therapist_id, name } = await req.json();
    if (!email) {
      return json({ error: "email is required" }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ── Step 1: Find or create auth user ──
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    );

    let userId: string;
    let wasExisting = false;

    if (existingUser) {
      userId = existingUser.id;
      wasExisting = true;
      console.log(`Existing auth user found: ${userId}`);
    } else {
      // Create new auth user (OTP login only – no password)
      const { data: newUserData, error: createError } =
        await adminClient.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { full_name: name || "Therapist" },
        });

      if (createError) {
        console.error("Create user error:", createError);
        return json({ error: `Auth user creation failed: ${createError.message}` }, 400);
      }

      userId = newUserData.user.id;
      console.log(`New auth user created: ${userId}`);
    }

    // ── Step 2: Assign therapist role (upsert) ──
    const { error: roleError } = await adminClient
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "therapist" },
        { onConflict: "user_id,role" }
      );

    if (roleError) {
      console.error("Role assignment error:", roleError);
      // If we just created the user, clean up
      if (!wasExisting) {
        await adminClient.auth.admin.deleteUser(userId);
        console.log(`Rolled back auth user ${userId} due to role assignment failure`);
      }
      return json({ error: `Role assignment failed: ${roleError.message}` }, 500);
    }

    // ── Step 3: Link auth user to therapist record (if therapist_id provided) ──
    if (therapist_id) {
      const { error: linkError } = await adminClient
        .from("therapists")
        .update({ user_id: userId })
        .eq("id", therapist_id);

      if (linkError) {
        console.error("Link error:", linkError);
        // Rollback: remove role + delete user if newly created
        await adminClient.from("user_roles").delete()
          .eq("user_id", userId).eq("role", "therapist");
        if (!wasExisting) {
          await adminClient.auth.admin.deleteUser(userId);
          console.log(`Rolled back auth user ${userId} due to link failure`);
        }
        return json({ error: `Failed to link auth user to therapist: ${linkError.message}` }, 500);
      }
    }

    return json({
      success: true,
      user_id: userId,
      was_existing: wasExisting,
    });
  } catch (err) {
    console.error("provision-therapist error:", err);
    return json({ error: err.message }, 500);
  }
});
