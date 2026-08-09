import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

/**
 * Find or create an auth user by email (OTP only, no password).
 * Returns { userId, wasExisting }.
 */
async function ensureAuthUser(
  adminClient: ReturnType<typeof createClient>,
  email: string,
  name?: string
): Promise<{ userId: string; wasExisting: boolean }> {
  const { data: existingUsers } = await adminClient.auth.admin.listUsers();
  const existing = existingUsers?.users?.find(
    (u: any) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (existing) {
    return { userId: existing.id, wasExisting: true };
  }

  const { data: newUser, error } = await adminClient.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: name || email.split("@")[0] },
  });

  if (error) {
    throw new Error(`Auth user creation failed: ${error.message}`);
  }

  return { userId: newUser.user.id, wasExisting: false };
}

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

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }

    const callerId = claimsData.claims.sub as string;

    // Verify caller is super_admin
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);

    const isSuperAdmin = (callerRoles || []).some((r) => r.role === "super_admin");
    if (!isSuperAdmin) {
      return json({ error: "Forbidden – super_admin role required" }, 403);
    }

    const { action, targetUserId, targetEmail, name } = await req.json();

    // ── LIST USERS ──
    if (action === "list_users") {
      const { data: allRoles } = await adminClient
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "super_admin", "therapist"]);

      const userIds = [...new Set((allRoles || []).map((r) => r.user_id))];
      const { data: authUsers } = await adminClient.auth.admin.listUsers();
      const map = new Map(
        (authUsers?.users || []).map((u) => [u.id, { email: u.email, name: u.user_metadata?.full_name }])
      );

      const users = userIds.map((uid) => {
        const info = map.get(uid);
        return {
          id: uid,
          email: info?.email || "unknown",
          name: info?.name || null,
          roles: (allRoles || []).filter((r) => r.user_id === uid).map((r) => r.role),
        };
      });

      return json({ users });
    }

    // ── ADD ADMIN ──
    if (action === "add_admin") {
      // Must provide either targetUserId (existing user) or targetEmail (new user)
      let userId = targetUserId;

      if (!userId && !targetEmail) {
        return json({ error: "targetUserId or targetEmail is required" }, 400);
      }

      // If email provided, ensure auth user exists
      if (targetEmail) {
        try {
          const { userId: authUserId } = await ensureAuthUser(adminClient, targetEmail, name);
          userId = authUserId;
        } catch (err) {
          return json({ error: err.message }, 400);
        }
      }

      if (userId === callerId) {
        return json({ error: "Cannot modify your own role" }, 403);
      }

      // Check if already admin
      const { data: existing } = await adminClient
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "admin");

      if (existing && existing.length > 0) {
        return json({ error: "User is already an admin" }, 409);
      }

      const { error: insertErr } = await adminClient
        .from("user_roles")
        .upsert(
          { user_id: userId, role: "admin" },
          { onConflict: "user_id,role" }
        );

      if (insertErr) {
        return json({ error: insertErr.message }, 500);
      }

      // Get email for logging
      const { data: targetUser } = await adminClient.auth.admin.getUserById(userId);

      await adminClient.from("role_change_logs").insert({
        changed_by: callerId,
        target_user_id: userId,
        target_email: targetUser?.user?.email || targetEmail || null,
        old_role: null,
        new_role: "admin",
        action: "add_role",
        reason: "Promoted to admin via manage-admin-role",
      });

      return json({ success: true, message: "Admin role assigned", user_id: userId });
    }

    // ── REMOVE ADMIN ──
    if (action === "remove_admin") {
      if (!targetUserId) {
        return json({ error: "targetUserId is required" }, 400);
      }

      if (targetUserId === callerId) {
        return json({ error: "Cannot modify your own role" }, 403);
      }

      const { data: targetRoles } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", targetUserId);

      const targetRoleSet = new Set((targetRoles || []).map((r) => r.role));

      if (targetRoleSet.has("super_admin")) {
        return json({ error: "Cannot remove admin role from a super_admin via this endpoint" }, 403);
      }

      if (!targetRoleSet.has("admin")) {
        return json({ error: "User does not have the admin role" }, 404);
      }

      const { error: deleteErr } = await adminClient
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId)
        .eq("role", "admin");

      if (deleteErr) {
        return json({ error: deleteErr.message }, 500);
      }

      const { data: targetUser } = await adminClient.auth.admin.getUserById(targetUserId);

      await adminClient.from("role_change_logs").insert({
        changed_by: callerId,
        target_user_id: targetUserId,
        target_email: targetUser?.user?.email || null,
        old_role: "admin",
        new_role: null,
        action: "remove_role",
        reason: "Admin role removed via manage-admin-role",
      });

      return json({ success: true, message: "Admin role removed" });
    }

    return json({ error: "Invalid action. Use list_users, add_admin, or remove_admin" }, 400);
  } catch (err) {
    console.error("manage-admin-role error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
