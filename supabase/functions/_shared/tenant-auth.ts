/**
 * Tenant (country) authorization for admin-facing edge functions.
 *
 * SECURITY (remediation item 5): `admin-ai-chat` and `business-intelligence`
 * checked only "is this caller an admin?", then used the SERVICE-ROLE client to
 * read every gym, hotel, therapist and booking for whatever `country_id` the
 * CALLER put in the request body. Any admin of any single country could
 * therefore read — and have the AI summarise — another country's entire
 * operation and revenue. Massavo's whole model is strict per-country tenancy.
 *
 * `authorizeAdminForCountry` derives authority from the caller's JWT only:
 *   1. the JWT must resolve to a real user,
 *   2. that user must hold admin or super_admin,
 *   3. that user must have access to the REQUESTED country via the
 *      `has_country_access` SECURITY DEFINER function (which itself grants
 *      super_admin global access and otherwise requires a matching
 *      `user_roles.country_id` row).
 *
 * Service-role clients must only ever be constructed AFTER this returns ok.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TenantAuthSuccess {
  ok: true;
  userId: string;
  /** The authorized country id — always use THIS, never the raw body value. */
  countryId: string;
  isSuperAdmin: boolean;
}

export interface TenantAuthFailure {
  ok: false;
  status: number;
  error: string;
}

export type TenantAuthResult = TenantAuthSuccess | TenantAuthFailure;

export async function authorizeAdminForCountry(
  req: Request,
  requestedCountryId: unknown,
): Promise<TenantAuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Not authenticated" };
  }
  const token = authHeader.slice(7).trim();
  if (!token) return { ok: false, status: 401, error: "Not authenticated" };

  if (typeof requestedCountryId !== "string" || !UUID_REGEX.test(requestedCountryId)) {
    return { ok: false, status: 400, error: "A valid country_id is required" };
  }

  // Caller-scoped client: the JWT — not the request body — is the identity.
  const callerClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
  );

  const { data: userData, error: authError } = await callerClient.auth.getUser(token);
  const user = userData?.user;
  if (authError || !user) {
    return { ok: false, status: 401, error: "Not authenticated" };
  }

  const [{ data: isAdmin }, { data: isSuperAdmin }] = await Promise.all([
    callerClient.rpc("has_role", { _user_id: user.id, _role: "admin" }),
    callerClient.rpc("has_role", { _user_id: user.id, _role: "super_admin" }),
  ]);
  if (!isAdmin && !isSuperAdmin) {
    return { ok: false, status: 403, error: "Unauthorized: admin role required" };
  }

  // Tenant boundary. `has_country_access` returns true for super_admin globally
  // and otherwise requires an explicit user_roles row for THIS country.
  const { data: hasAccess, error: accessError } = await callerClient.rpc("has_country_access", {
    _user_id: user.id,
    _country_id: requestedCountryId,
  });
  if (accessError) {
    console.error("[tenant-auth] has_country_access failed:", accessError.message);
    return { ok: false, status: 403, error: "Unauthorized for this country" };
  }
  if (hasAccess !== true) {
    console.warn(`[tenant-auth] denied cross-country access user=${user.id} country=${requestedCountryId}`);
    return { ok: false, status: 403, error: "Unauthorized for this country" };
  }

  return { ok: true, userId: user.id, countryId: requestedCountryId, isSuperAdmin: !!isSuperAdmin };
}

export function tenantAuthResponse(
  corsHeaders: Record<string, string>,
  failure: TenantAuthFailure,
): Response {
  return new Response(JSON.stringify({ error: failure.error }), {
    status: failure.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
