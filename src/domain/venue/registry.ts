import type { VenueType, VenueTypeConfig } from "./types";
import { gymConfig } from "./configs/gym";
import { hotelConfig } from "./configs/hotel";
import { homeConfig } from "./configs/home";
import { clinicConfig } from "./configs/clinic";

/**
 * Central registry for every partner/venue type the platform supports.
 * Adding a new partner type = adding one entry here + one DB enum value.
 * No new pages, hooks, or duplicated modules required.
 */
export const VENUE_TYPE_REGISTRY: Record<VenueType, VenueTypeConfig> = {
  gym: gymConfig,
  hotel: hotelConfig,
  home: homeConfig,
  clinic: clinicConfig,
  // Forward-declared placeholders — fill in as we onboard each segment.
  spa: { ...clinicConfig, type: "spa", label: "Spa", terminology: { ...clinicConfig.terminology, singular: "Spa", plural: "Spas", customer: "Guest", session: "Treatment", area: "Cabin" }, shippable: false },
  recovery: { ...clinicConfig, type: "recovery", label: "Recovery Center", terminology: { ...clinicConfig.terminology, singular: "Recovery Center", plural: "Recovery Centers", customer: "Athlete", session: "Recovery Session", area: "Pod" }, shippable: false },
  wellness: { ...clinicConfig, type: "wellness", label: "Wellness Studio", terminology: { ...clinicConfig.terminology, singular: "Wellness Studio", plural: "Wellness Studios", customer: "Client", session: "Session", area: "Studio" }, shippable: false },
  corporate: { ...clinicConfig, type: "corporate", label: "Corporate Wellness", terminology: { ...clinicConfig.terminology, singular: "Corporate Site", plural: "Corporate Sites", customer: "Employee", session: "On-site Session", area: "Office" }, shippable: false },
};

export function getVenueConfig(type: VenueType | string | null | undefined): VenueTypeConfig {
  if (type && type in VENUE_TYPE_REGISTRY) {
    return VENUE_TYPE_REGISTRY[type as VenueType];
  }
  return gymConfig;
}

/** All venue types currently shippable (have data + pages). */
export function listShippableVenueTypes(): VenueTypeConfig[] {
  return Object.values(VENUE_TYPE_REGISTRY).filter((c) => c.shippable);
}

/** All registered types, including future placeholders. */
export function listAllVenueTypes(): VenueTypeConfig[] {
  return Object.values(VENUE_TYPE_REGISTRY);
}