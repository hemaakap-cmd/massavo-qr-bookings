import type { LucideIcon } from "lucide-react";

export type VenueType =
  | "gym"
  | "hotel"
  | "clinic"
  | "spa"
  | "recovery"
  | "wellness"
  | "corporate";

export interface VenueTerminology {
  /** Singular noun for one venue, e.g. "Gym", "Hotel". */
  singular: string;
  /** Plural noun for many venues. */
  plural: string;
  /** Customer noun, e.g. "Member", "Guest". */
  customer: string;
  /** Session noun, e.g. "Session", "Treatment". */
  session: string;
  /** Location/area inside the venue, e.g. "Floor", "Suite". */
  area: string;
}

export interface VenueKpiHints {
  /** KPIs that should be emphasised first on this venue type's dashboards. */
  primary: string[];
  /** KPIs that are nice-to-have for this venue type. */
  secondary: string[];
}

export interface VenueTypeConfig {
  type: VenueType;
  /** Display label for the type. */
  label: string;
  /** Lucide icon used everywhere this type is represented. */
  icon: LucideIcon;
  /** HSL token name (without `hsl(var(--…))`) used as the accent for this type. */
  accentToken: string;
  /** Vocabulary used by adaptive UI surfaces. */
  terminology: VenueTerminology;
  /** KPI emphasis hints for dashboards. */
  kpis: VenueKpiHints;
  /**
   * Whether this type is currently shippable (i.e. has data + pages wired up).
   * Future types ('clinic', 'spa', …) can live in the registry as `shippable: false`
   * until their data layer is ready.
   */
  shippable: boolean;
}