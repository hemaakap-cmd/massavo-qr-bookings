import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { DeliveryMethod } from "@/types/reporting";

export interface HotelContactFormData {
  hotel_id: string;
  manager_name?: string;
  manager_email?: string;
  manager_phone?: string;
  deputy_manager_name?: string;
  deputy_manager_email?: string;
  deputy_manager_phone?: string;
  preferred_delivery_channel?: DeliveryMethod;
  notes?: string;
}

export const useHotelContacts = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: hotelContacts, isLoading, error, refetch } = useQuery({
    queryKey: ["hotel-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotel_contacts")
        .select(`*, hotels:hotel_id(id, name, address, phone)`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const createHotelContact = useMutation({
    mutationFn: async (f: HotelContactFormData) => {
      const { data, error } = await supabase.from("hotel_contacts").insert({
        hotel_id: f.hotel_id,
        manager_name: f.manager_name || null,
        manager_email: f.manager_email || null,
        manager_phone: f.manager_phone || null,
        deputy_manager_name: f.deputy_manager_name || null,
        deputy_manager_email: f.deputy_manager_email || null,
        deputy_manager_phone: f.deputy_manager_phone || null,
        preferred_delivery_channel: f.preferred_delivery_channel || "email",
        notes: f.notes || null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hotel-contacts"] });
      toast({ title: "Contact Created", description: "Hotel contact profile created." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateHotelContact = useMutation({
    mutationFn: async ({ id, ...f }: HotelContactFormData & { id: string }) => {
      const { data, error } = await supabase.from("hotel_contacts").update({
        manager_name: f.manager_name || null,
        manager_email: f.manager_email || null,
        manager_phone: f.manager_phone || null,
        deputy_manager_name: f.deputy_manager_name || null,
        deputy_manager_email: f.deputy_manager_email || null,
        deputy_manager_phone: f.deputy_manager_phone || null,
        preferred_delivery_channel: f.preferred_delivery_channel || "email",
        notes: f.notes || null,
      }).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hotel-contacts"] });
      toast({ title: "Contact Updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteHotelContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hotel_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hotel-contacts"] });
      toast({ title: "Contact Deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return { hotelContacts, isLoading, error, refetch, createHotelContact, updateHotelContact, deleteHotelContact };
};
