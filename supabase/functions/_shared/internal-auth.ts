/**
 * Shared authorization helpers for internal-only / admin-only edge functions.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

function bearer(req: Request): string | null {
  const h = req.headers.get("Authorization") ?? "";
  if (!h.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

/** True when the caller presents the project service-role key (internal server-to-server). */
export function isServiceRoleCall(req: Request): boolean {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!key) return false;
  const token = bearer(req) ?? req.headers.get("apikey");
  return !!token && token === key;
}

/** True when the caller presents a valid JWT with admin or super_admin role. */
export async function isAdminCall(req: Request): Promise<boolean> {
  const token = bearer(req);
  if (!token) return false;
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
    );
    const { data: claimsData, error } = await supabase.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (error || !userId) return false;
    const [{ data: isAdmin }, { data: isSuper }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
    ]);
    return !!isAdmin || !!isSuper;
  } catch {
    return false;
  }
}

export function unauthorized(corsHeaders: Record<string, string>, status = 401): Response {
  return new Response(JSON.stringify({ error: status === 403 ? "Forbidden" : "Unauthorized" }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
