import { Hotel } from "lucide-react";
import type { VenueTypeConfig } from "../types";

export const hotelConfig: VenueTypeConfig = {
  type: "hotel",
  label: "Hotel",
  icon: Hotel,
  accentToken: "--accent",
  terminology: {
    singular: "Hotel",
    plural: "Hotels",
    customer: "Guest",
    session: "Treatment",
    area: "Suite",
  },
  kpis: {
    primary: ["occupancy_correlation", "in_room_delivery", "guest_length_of_stay", "therapist_utilization"],
    secondary: ["revenue_per_treatment", "review_score"],
  },
  shippable: true,
};