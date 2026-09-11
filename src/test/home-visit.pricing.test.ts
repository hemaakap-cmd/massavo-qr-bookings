/**
 * HOME VISIT — the quoted total must equal the charged total.
 *
 * THE BUG
 * -------
 * `create-payment` builds the Stripe amount as
 * `basePrice + surcharge + travelFee`, resolving the travel fee server-side
 * via the `get_home_travel_fee` RPC. The Home Visit summary rendered
 * `basePrice + finalSurcharge` and never mentioned a travel fee at all, so the
 * moment a city or country travel fee was set the customer would be quoted one
 * amount and charged a higher one. It stayed invisible only because every
 * configured fee is currently 0.
 *
 * WHY THIS IS A SOURCE-LEVEL TEST
 * -------------------------------
 * The defect is a disagreement between two files that each look correct on
 * their own, so no unit test confined to one side can catch it. What has to
 * hold is that both sides sum the same components. These assertions are
 * deliberately about the pricing expressions, not about formatting.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "../..");
const serverSrc = fs.readFileSync(
  path.join(root, "supabase/functions/create-payment/index.ts"),
  "utf8",
);
const pageSrc = fs.readFileSync(path.join(root, "src/pages/HomeVisit.tsx"), "utf8");

/** Strip whitespace so formatting changes don't break the match. */
const squash = (s: string) => s.replace(/\s+/g, "");

describe("Home Visit pricing — quoted total matches charged total", () => {
  it("the server still charges base + surcharge + travel fee", () => {
    // If this line is restructured, the page-side assertion below must be
    // revisited rather than silently drifting away from it.
    expect(squash(serverSrc)).toContain("constfinalPrice=basePrice+surcharge+travelFee");
  });

  it("the server resolves the travel fee itself and never trusts the client", () => {
    expect(serverSrc).toContain('supabase.rpc("get_home_travel_fee"');
    // The client-sent body is destructured once; travelFee must not be in it.
    const destructure = serverSrc.slice(
      serverSrc.indexOf("const {"),
      serverSrc.indexOf("} = body;"),
    );
    expect(destructure).not.toContain("travelFee");
  });

  it("the page adds the travel fee into the total it shows the customer", () => {
    expect(squash(pageSrc)).toContain("formatPrice(basePrice+finalSurcharge+travelFee)");
  });

  it("the page reads the travel fee from the same server RPC, not a local rule", () => {
    expect(pageSrc).toContain("useHomeTravelFee");
    // The fee must arrive from the hook. A standalone `const travelFee = 12`
    // would be a second, drifting source of truth. (The `= 0` in the hook's
    // destructuring is a loading fallback, not a rule, so it is not matched.)
    expect(pageSrc).not.toMatch(/const\s+travelFee\s*=\s*\d/);
  });

  it("every component of the charged price appears in the quoted total", () => {
    // The summary renders several formatPrice() calls (base, surcharge, total).
    // The total is the one that sums basePrice with something else.
    const quotedTotal = squash(pageSrc).match(/formatPrice\(basePrice\+[^)]*\)/)?.[0];
    expect(quotedTotal).toBeTruthy();
    for (const component of ["basePrice", "Surcharge", "travelFee"]) {
      expect(quotedTotal!.toLowerCase()).toContain(component.toLowerCase());
    }
  });
});
