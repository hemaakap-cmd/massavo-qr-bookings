import { Stethoscope } from "lucide-react";
import type { VenueTypeConfig } from "../types";

/**
 * Forward-looking config — proves the registry can absorb a new partner type
 * without code changes elsewhere. Marked non-shippable until the data layer
 * (DB enum value + venues row) is added.
 */
export const clinicConfig: VenueTypeConfig = {
  type: "clinic",
  label: "Clinic",
  icon: Stethoscope,
  accentToken: "--primary",
  terminology: {
    singular: "Clinic",
    plural: "Clinics",
    customer: "Patient",
    session: "Appointment",
    area: "Treatment Room",
  },
  kpis: {
    primary: ["appointment_volume", "clinical_outcomes", "therapist_utilization"],
    secondary: ["revenue_per_appointment", "follow_up_rate"],
  },
  shippable: false,
};