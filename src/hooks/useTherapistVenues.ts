import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { VenueType } from "@/domain/venue/types";

export interface TherapistVenueLink {
  id: string;
  therapist_id: string;
  venue_type: VenueType;
  venue_id: string;
  is_primary: boolean;
  is_active: boolean;
  notes: string | null;
}

const KEY = (therapistId: string) => ["therapist-venues", therapistId];

/**
 * Unified therapist↔venue link hook.
 * Reads/writes the normalized `therapist_venues` table, and dual-writes to the
 * legacy per-type tables (`therapist_gyms`, `therapist_hotels`) so existing
 * RLS, queries, and edge functions continue to work during the migration window.
 */
export function useTherapistVenues(therapistId: string | null | undefined) {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: KEY(therapistId || ""),
    enabled: !!therapistId,
    queryFn: async (): Promise<TherapistVenueLink[]> => {
      const { data, error } = await supabase
        .from("therapist_venues" as any)
        .select("*")
        .eq("therapist_id", therapistId);
      if (error) throw error;
      return ((data || []) as unknown) as TherapistVenueLink[];
    },
  });

  const groupedByType = (list.data || []).reduce<Record<string, TherapistVenueLink[]>>(
    (acc, l) => {
      (acc[l.venue_type] ||= []).push(l);
      return acc;
    },
    {},
  );

  const assign = useMutation({
    mutationFn: async (params: { venueType: VenueType; venueId: string; isPrimary?: boolean }) => {
      if (!therapistId) throw new Error("missing therapist");
      const { error } = await supabase.from("therapist_venues" as any).upsert(
        {
          therapist_id: therapistId,
          venue_type: params.venueType,
          venue_id: params.venueId,
          is_primary: !!params.isPrimary,
          is_active: true,
        },
        { onConflict: "therapist_id,venue_type,venue_id" },
      );
      if (error) throw error;

      // Dual-write to legacy tables for backward compat.
      if (params.venueType === "gym") {
        await supabase.from("therapist_gyms").upsert(
          { therapist_id: therapistId, gym_id: params.venueId, is_primary: !!params.isPrimary },
          { onConflict: "therapist_id,gym_id" },
        );
      } else if (params.venueType === "hotel") {
        await supabase.from("therapist_hotels" as any).upsert(
          { therapist_id: therapistId, hotel_id: params.venueId, is_primary: !!params.isPrimary },
          { onConflict: "therapist_id,hotel_id" },
        );
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(therapistId || "") }),
  });

  const remove = useMutation({
    mutationFn: async (link: TherapistVenueLink) => {
      const { error } = await supabase
        .from("therapist_venues" as any)
        .delete()
        .eq("id", link.id);
      if (error) throw error;
      if (link.venue_type === "gym") {
        await supabase
          .from("therapist_gyms")
          .delete()
          .eq("therapist_id", link.therapist_id)
          .eq("gym_id", link.venue_id);
      } else if (link.venue_type === "hotel") {
        await supabase
          .from("therapist_hotels" as any)
          .delete()
          .eq("therapist_id", link.therapist_id)
          .eq("hotel_id", link.venue_id);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(therapistId || "") }),
  });

  const setPrimary = useMutation({
    mutationFn: async (link: TherapistVenueLink) => {
      if (!therapistId) throw new Error("missing therapist");
      // Clear all primaries, then set selected.
      await supabase
        .from("therapist_venues" as any)
        .update({ is_primary: false })
        .eq("therapist_id", therapistId);
      const { error } = await supabase
        .from("therapist_venues" as any)
        .update({ is_primary: true })
        .eq("id", link.id);
      if (error) throw error;

      // Mirror to legacy tables.
      await supabase
        .from("therapist_gyms")
        .update({ is_primary: false })
        .eq("therapist_id", therapistId);
      await supabase
        .from("therapist_hotels" as any)
        .update({ is_primary: false })
        .eq("therapist_id", therapistId);
      if (link.venue_type === "gym") {
        await supabase
          .from("therapist_gyms")
          .update({ is_primary: true })
          .eq("therapist_id", therapistId)
          .eq("gym_id", link.venue_id);
      } else if (link.venue_type === "hotel") {
        await supabase
          .from("therapist_hotels" as any)
          .update({ is_primary: true })
          .eq("therapist_id", therapistId)
          .eq("hotel_id", link.venue_id);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(therapistId || "") }),
  });

  return { ...list, links: list.data || [], groupedByType, assign, remove, setPrimary };
}