import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { VenueType, VenueTypeConfig } from "./types";
import { getVenueConfig, listShippableVenueTypes } from "./registry";

const STORAGE_KEY = "massavo:venueTypeFilter";

/**
 * Active venue-type filter for the admin shell.
 * `null` means "all venue types" (cross-type view).
 */
export interface VenueContextValue {
  /** Currently selected venue type, or null for "All". */
  activeType: VenueType | null;
  /** Set the active venue type. Pass null for "All". */
  setActiveType: (t: VenueType | null) => void;
  /** Resolved config for the currently active type (falls back to gym for null). */
  config: VenueTypeConfig;
  /** All shippable venue type configs — useful for filter chips. */
  shippable: VenueTypeConfig[];
}

const VenueContext = createContext<VenueContextValue | undefined>(undefined);

export function VenueProvider({ children }: { children: ReactNode }) {
  const [activeType, setActiveTypeState] = useState<VenueType | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw || raw === "all") return null;
    return raw as VenueType;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, activeType ?? "all");
  }, [activeType]);

  const value = useMemo<VenueContextValue>(
    () => ({
      activeType,
      setActiveType: setActiveTypeState,
      config: getVenueConfig(activeType),
      shippable: listShippableVenueTypes(),
    }),
    [activeType],
  );

  return <VenueContext.Provider value={value}>{children}</VenueContext.Provider>;
}

export function useVenueContext(): VenueContextValue {
  const ctx = useContext(VenueContext);
  if (!ctx) {
    // Soft fallback so components don't crash if rendered outside the admin shell.
    return {
      activeType: null,
      setActiveType: () => {},
      config: getVenueConfig(null),
      shippable: listShippableVenueTypes(),
    };
  }
  return ctx;
}