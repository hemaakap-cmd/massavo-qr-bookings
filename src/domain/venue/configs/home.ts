import { Home } from "lucide-react";
import type { VenueTypeConfig } from "../types";

/**
 * Home Visit — the therapist travels to the customer's address.
 * Unlike gym/hotel there is no fixed venue row; availability and assignment
 * come from the therapist-city pool. Kept in the same registry so every
 * adaptive UI surface (badges, filters, dashboards) treats it natively.
 */
export const homeConfig: VenueTypeConfig = {
  type: "home",
  label: "Home Visit",
  icon: Home,
  accentToken: "--primary",
  terminology: {
    singular: "Home Visit",
    plural: "Home Visits",
    customer: "Client",
    session: "Home Treatment",
    area: "Home",
  },
  kpis: {
    primary: ["therapist_utilization", "travel_radius", "revenue_per_treatment"],
    secondary: ["review_score", "repeat_rate"],
  },
  shippable: true,
};
