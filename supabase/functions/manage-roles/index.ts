import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";


type AppRole = "admin" | "therapist" | "super_admin" | "client" | "user";

interface ManageRoleRequest {
  action: "add_user" | "remove_role" | "promote" | "demote" | "list_users" | "get_logs";
  targetEmail?: string;
  targetUserId?: string;
  role?: AppRole;
  reason?: string;
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }

    const callerId = claimsData.claims.sub as string;

    // Get caller's roles
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);

    const callerRoleSet = new Set((callerRoles || []).map((r) => r.role));
    const isSuperAdmin = callerRoleSet.has("super_admin");
    const isAdmin = callerRoleSet.has("admin");

    if (!isSuperAdmin && !isAdmin) {
      return json({ error: "Insufficient permissions" }, 403);
    }

    const body: ManageRoleRequest = await req.json();
    const { action } = body;

    // ============ LIST USERS ============
    if (action === "list_users") {
      const { data: allRoles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role, branch_id, created_at")
        .in("role", ["admin", "therapist", "super_admin"]);

      // Get user details
      const userIds = [...new Set((allRoles || []).map((r) => r.user_id))];
      const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
      const usersMap = new Map(
        (userData?.users || []).map((u) => [u.id, { email: u.email, name: u.user_metadata?.full_name }])
      );

      const users = userIds.map((uid) => {
        const userInfo = usersMap.get(uid);
        const userRoles = (allRoles || []).filter((r) => r.user_id === uid);
        return {
          id: uid,
          email: userInfo?.email || "unknown",
          name: userInfo?.name || null,
          roles: userRoles.map((r) => r.role),
          branch_id: userRoles.find((r) => r.branch_id)?.branch_id || null,
          created_at: userRoles[0]?.created_at,
        };
      });

      return json({ users });
    }

    // ============ GET AUDIT LOGS ============
    if (action === "get_logs") {
      const { data: logs } = await supabaseAdmin
        .from("role_change_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      return json({ logs: logs || [] });
    }

    // ============ ADD USER ============
    if (action === "add_user") {
      const { targetEmail, role, reason } = body;
      if (!targetEmail || !role) {
        return json({ error: "targetEmail and role are required" }, 400);
      }

      // Permission checks
      if (isAdmin && !isSuperAdmin) {
        if (role !== "therapist") {
          return json({ error: "Admins can only create therapist accounts" }, 403);
        }
      }

      if (!["admin", "therapist"].includes(role)) {
        return json({ error: "Can only create admin or therapist accounts" }, 400);
      }

      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existing = existingUsers?.users?.find(
        (u) => u.email?.toLowerCase() === targetEmail.toLowerCase()
      );

      let targetUserId: string;

      if (existing) {
        targetUserId = existing.id;
        // Check if role already assigned
        const { data: existingRoles } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", targetUserId)
          .eq("role", role);

        if (existingRoles && existingRoles.length > 0) {
          return json({ error: `User already has the ${role} role` }, 409);
        }
      } else {
        // Create new user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: targetEmail.toLowerCase(),
          email_confirm: true,
          user_metadata: { full_name: targetEmail.split("@")[0] },
        });

        if (createError) {
          return json({ error: `Failed to create user: ${createError.message}` }, 500);
        }
        targetUserId = newUser.user.id;
      }

      // Add role
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: targetUserId, role });

      if (roleError) {
        return json({ error: `Failed to assign role: ${roleError.message}` }, 500);
      }

      // Log the change
      await supabaseAdmin.from("role_change_logs").insert({
        changed_by: callerId,
        target_user_id: targetUserId,
        target_email: targetEmail.toLowerCase(),
        old_role: null,
        new_role: role,
        action: existing ? "add_role" : "create_account",
        reason: reason || null,
      });

      return json({ success: true, message: `${role} role assigned to ${targetEmail}` });
    }

    // ============ REMOVE ROLE ============
    if (action === "remove_role") {
      const { targetUserId, role, reason } = body;
      if (!targetUserId || !role) {
        return json({ error: "targetUserId and role are required" }, 400);
      }

      // Self-modification check
      if (targetUserId === callerId) {
        return json({ error: "Cannot modify your own role" }, 403);
      }

      // Get target's roles
      const { data: targetRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", targetUserId);

      const targetRoleSet = new Set((targetRoles || []).map((r) => r.role));

      // Permission checks
      if (isAdmin && !isSuperAdmin) {
        if (role !== "therapist") {
          return json({ error: "Admins can only remove therapist roles" }, 403);
        }
        if (targetRoleSet.has("admin") || targetRoleSet.has("super_admin")) {
          return json({ error: "Cannot modify admin or super_admin users" }, 403);
        }
      }

      if (role === "super_admin" && !isSuperAdmin) {
        return json({ error: "Only super admins can remove super_admin role" }, 403);
      }

      // Remove role
      const { error: deleteError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId)
        .eq("role", role);

      if (deleteError) {
        return json({ error: `Failed to remove role: ${deleteError.message}` }, 500);
      }

      // Get target email for logging
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(targetUserId);

      await supabaseAdmin.from("role_change_logs").insert({
        changed_by: callerId,
        target_user_id: targetUserId,
        target_email: userData?.user?.email || null,
        old_role: role,
        new_role: null,
        action: "remove_role",
        reason: reason || null,
      });

      return json({ success: true, message: `${role} role removed` });
    }

    // ============ PROMOTE (admin → super_admin) ============
    if (action === "promote") {
      if (!isSuperAdmin) {
        return json({ error: "Only super admins can promote users" }, 403);
      }

      const { targetUserId, reason } = body;
      if (!targetUserId) {
        return json({ error: "targetUserId is required" }, 400);
      }

      if (targetUserId === callerId) {
        return json({ error: "Cannot promote yourself" }, 403);
      }

      // Check target has admin role
      const { data: targetRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", targetUserId);

      const targetRoleSet = new Set((targetRoles || []).map((r) => r.role));
      if (!targetRoleSet.has("admin")) {
        return json({ error: "User must be an admin to be promoted" }, 400);
      }

      if (targetRoleSet.has("super_admin")) {
        return json({ error: "User is already a super admin" }, 409);
      }

      // Add super_admin role
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: targetUserId, role: "super_admin" });

      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(targetUserId);

      await supabaseAdmin.from("role_change_logs").insert({
        changed_by: callerId,
        target_user_id: targetUserId,
        target_email: userData?.user?.email || null,
        old_role: "admin",
        new_role: "super_admin",
        action: "promote",
        reason: reason || null,
      });

      return json({ success: true, message: "User promoted to super admin" });
    }

    // ============ DEMOTE (super_admin → admin) ============
    if (action === "demote") {
      if (!isSuperAdmin) {
        return json({ error: "Only super admins can demote users" }, 403);
      }

      const { targetUserId, reason } = body;
      if (!targetUserId) {
        return json({ error: "targetUserId is required" }, 400);
      }

      if (targetUserId === callerId) {
        return json({ error: "Cannot demote yourself" }, 403);
      }

      // Remove super_admin role
      const { error: deleteError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId)
        .eq("role", "super_admin");

      if (deleteError) {
        return json({ error: `Failed to demote: ${deleteError.message}` }, 500);
      }

      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(targetUserId);

      await supabaseAdmin.from("role_change_logs").insert({
        changed_by: callerId,
        target_user_id: targetUserId,
        target_email: userData?.user?.email || null,
        old_role: "super_admin",
        new_role: "admin",
        action: "demote",
        reason: reason || null,
      });

      return json({ success: true, message: "User demoted to admin" });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    console.error("manage-roles error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
