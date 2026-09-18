/**
 * useVenueSession — client side of the server-side QR/venue gate (N-2).
 *
 * The token is issued and validated by the `venue-access` edge function; the
 * browser only carries it. sessionStorage is used as transport/UI convenience
 * ONLY — it is not the authorization boundary. Every protected read and the
 * checkout call are validated server-side against the signed token.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { grantQRAccess } from "@/lib/qrAccess";

export type VenueSessionType = "gym" | "hotel";

export interface VenueInfo {
  id: string;
  type: VenueSessionType;
  name: string;
  address: string;
  city_id: string;
  city_name: string | null;
  rating: number | null;
  review_count: number | null;
  image_url: string | null;
  open_hours: string | null;
  star_rating: number | null;
}

export interface VenueService {
  id: string;
  name: string;
  name_ar?: string | null;
  description: string | null;
  description_ar?: string | null;
  duration_minutes: number;
  icon: string | null;
  price: number;
  original_price: number | null;
  promo_label: string | null;
}

const storageKey = (type: VenueSessionType, id: string) => `massavo_venue_token_${type}_${id}`;


function writeCached(type: VenueSessionType, id: string, token: string, expiresAt: number) {
  try {
    sessionStorage.setItem(storageKey(type, id), JSON.stringify({ token, expiresAt }));
  } catch {
    /* ignore */
  }
}

export async function callVenueAccess<T>(body: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke("venue-access", { body });
  if (error) return { data: null, error: error.message || "venue-access failed" };
  const payload = data as (T & { error?: string }) | null;
  if (payload && typeof payload === "object" && "error" in payload && payload.error) {
    return { data: null, error: String(payload.error) };
  }
  return { data: payload as T, error: null };
}

/**
 * Claims (or reuses) a venue token for a QR entry point and loads the
 * venue + its authoritative service catalogue with server-resolved prices.
 */
export function useVenueSession(type: VenueSessionType, venueId: string | undefined, qrCode?: string) {
  const [token, setToken] = useState<string | null>(null);
  const [venue, setVenue] = useState<VenueInfo | null>(null);
  const [services, setServices] = useState<VenueService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    // H-1: only the venue's physical QR secret can start a venue session.
    // A venue id alone is never accepted by the server.
    if (!qrCode) {
      setError("QR_REQUIRED");
      setLoading(false);
      return;
    }

    let activeToken: string | null = null;
    let claimedVenue: VenueInfo | null = null;

    const { data, error: claimErr } = await callVenueAccess<{ token: string; expiresAt: number; venue: VenueInfo }>({
      action: "claim",
      venueType: type,
      venueId,
      code: qrCode,
    });
    if (claimErr || !data?.token) {
      setError(claimErr || "Venue authorization failed");
      setLoading(false);
      return;
    }
    activeToken = data.token;
    claimedVenue = data.venue;
    writeCached(type, data.venue.id, data.token, data.expiresAt);

    setToken(activeToken);
    if (claimedVenue) setVenue(claimedVenue);
    // Keep the legacy UI flag in sync (navigation/labels only, never security).
    grantQRAccess(type);

    const { data: cat, error: catErr } = await callVenueAccess<{ services: VenueService[] }>({
      action: "catalogue",
      venueType: type,
      venueId: claimedVenue?.id ?? venueId,
      token: activeToken,
    });
    if (catErr) setError(catErr);
    setServices(cat?.services ?? []);
    setLoading(false);
  }, [type, venueId, qrCode]);

  useEffect(() => {
    void load();
  }, [load]);

  return { token, venue, services, loading, error, reload: load };
}
