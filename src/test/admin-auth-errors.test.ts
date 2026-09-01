/**
 * Admin edge-function auth status codes.
 *
 * Regression for a defect found during the Admin QA pass: business-intelligence,
 * therapist-analytics and admin-ai-chat rejected unauthenticated callers
 * correctly (no data leaked) but reported it as HTTP 500 instead of 401/403.
 * That makes routine auth rejections indistinguishable from real server
 * failures in monitoring, and gives clients an unusable signal.
 *
 * These tests exercise the real mapper used by those functions.
 */
import { describe, it, expect } from "vitest";
import { statusForError, messageForError } from "../../supabase/functions/_shared/auth-errors.ts";

describe("ADMIN AUTH — status code mapping", () => {
  it("'Not authenticated' → 401", () => {
    expect(statusForError(new Error("Not authenticated"))).toBe(401);
    expect(messageForError(new Error("Not authenticated"))).toBe("Not authenticated");
  });

  it("'Unauthorized: admin role required' → 403", () => {
    const err = new Error("Unauthorized: admin role required");
    expect(statusForError(err)).toBe(403);
    expect(messageForError(err)).toBe("Unauthorized: admin role required");
  });

  it("'Unauthorized: admin or super_admin role required' → 403", () => {
    expect(statusForError(new Error("Unauthorized: admin or super_admin role required"))).toBe(403);
  });

  it("a genuine failure stays 500", () => {
    expect(statusForError(new Error("relation \"bookings\" does not exist"))).toBe(500);
  });

  it("500 responses never leak internal detail", () => {
    // A DB error must not reach the client verbatim.
    const msg = messageForError(new Error("relation \"bookings\" does not exist"));
    expect(msg).toBe("Internal server error");
    expect(msg).not.toContain("bookings");
  });

  it("handles non-Error throws without crashing", () => {
    expect(statusForError("Not authenticated")).toBe(401);
    expect(statusForError(null)).toBe(500);
    expect(statusForError(undefined)).toBe(500);
  });

  it("does not mistake an unrelated message containing the word for an auth error", () => {
    // Only an exact/prefixed auth signal maps to 4xx; anything else is a 500.
    expect(statusForError(new Error("user was not authenticated by upstream cache"))).toBe(500);
  });
});
