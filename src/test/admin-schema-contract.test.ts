/**
 * Admin schema contracts — live guard against column drift.
 *
 * Found during the authenticated Admin QA pass: phone/email were moved from
 * `therapists` to `therapist_private_info`, but four admin code paths kept
 * selecting them. Every one failed with Postgres 42703 at runtime, taking down
 * Therapist Analytics, Staff Advanced, Therapist Absence, Therapist Leaves,
 * admin AI chat and the therapist daily summary — with no test catching it,
 * because nothing asserted the select strings still match the schema.
 *
 * These tests run the EXACT select strings the admin code uses against the live
 * database. They are read-only (limit 1, no mutations) and fail loudly if a
 * column is renamed or moved again.
 */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://lugzhjfguftlfcgjfnbj.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Z3poamZndWZ0bGZjZ2pmbmJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNjY1ODAsImV4cCI6MjA4NDk0MjU4MH0._uP_L7Z_OR_E-m6KqkTbXN_fbXKLDGBF-OUENc4AHHg";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TIMEOUT = 25_000;

/**
 * A missing column yields Postgres 42703 regardless of RLS, so an anonymous
 * client is enough to prove the contract: RLS returns empty/denied, but a
 * schema error surfaces as 42703 either way.
 */
async function selectFails42703(table: string, select: string): Promise<string | null> {
  const { error } = await sb.from(table as any).select(select).limit(1);
  if (!error) return null;
  if (error.code === "42703" || /does not exist/i.test(error.message || "")) {
    return error.message;
  }
  return null; // RLS/permission errors are fine here — only schema drift matters.
}

describe("ADMIN schema contracts — therapists column drift", () => {
  it(
    "phone/email are NOT on `therapists` (they live on therapist_private_info)",
    async () => {
      // Documents the actual schema so the drift can never silently return.
      const stale = await selectFails42703("therapists", "id,name,phone,email");
      expect(stale).toBeTruthy();
      expect(String(stale)).toMatch(/does not exist/i);
    },
    TIMEOUT,
  );

  it(
    "therapist-analytics select is valid",
    async () => {
      const err = await selectFails42703(
        "therapists",
        "id,name,is_available,profession,gym_id,city_id,rating,education,created_at",
      );
      expect(err).toBeNull();
    },
    TIMEOUT,
  );

  it(
    "useAdminAllTherapists select is valid",
    async () => {
      const err = await selectFails42703(
        "therapists",
        "id,name,is_available,gym_id,gyms:gym_id(name),therapist_gyms(gym_id,is_primary,gyms(id,name))",
      );
      expect(err).toBeNull();
    },
    TIMEOUT,
  );

  it(
    "admin-ai-chat select is valid",
    async () => {
      const err = await selectFails42703("therapists", "id,name,is_available,profession,gym_id");
      expect(err).toBeNull();
    },
    TIMEOUT,
  );

  it(
    "send-therapist-daily-summary joins therapist_private_info for phone/email",
    async () => {
      const err = await selectFails42703("therapists", "id,name,therapist_private_info(phone,email)");
      expect(err).toBeNull();
    },
    TIMEOUT,
  );

  it(
    "AdminTherapists detail select is valid",
    async () => {
      const err = await selectFails42703(
        "therapists",
        "id,name,therapist_private_info(phone,email,address),therapist_gyms(gym_id,is_primary)",
      );
      expect(err).toBeNull();
    },
    TIMEOUT,
  );
});
