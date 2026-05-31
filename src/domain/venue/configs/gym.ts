import { Building2 } from "lucide-react";
import type { VenueTypeConfig } from "../types";

export const gymConfig: VenueTypeConfig = {
  type: "gym",
  label: "Gym",
  icon: Building2,
  accentToken: "--primary",
  terminology: {
    singular: "Gym",
    plural: "Gyms",
    customer: "Member",
    session: "Session",
    area: "Floor",
  },
  kpis: {
    primary: ["recurring_sessions", "peak_hours", "member_retention", "therapist_utilization"],
    secondary: ["revenue_per_session", "review_score"],
  },
  shippable: true,
};