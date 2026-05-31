import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { GymContact, DeliveryMethod } from "@/types/reporting";

export interface GymContactFormData {
  gym_id: string;
  manager_name?: string;
  manager_email?: string;
  manager_phone?: string;
  deputy_manager_name?: string;
  deputy_manager_email?: string;
  deputy_manager_phone?: string;
  preferred_delivery_channel?: DeliveryMethod;
  notes?: string;
}

export const useGymContacts = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all gym contacts with gym info
  const { data: gymContacts, isLoading, error, refetch } = useQuery({
    queryKey: ["gym-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gym_contacts")
        .select(`
          *,
          gyms:gym_id(id, name, address, phone)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as GymContact[];
    },
  });

  // Fetch gym contact by gym ID
  const getGymContact = async (gymId: string): Promise<GymContact | null> => {
    const { data, error } = await supabase
      .from("gym_contacts")
      .select(`
        *,
        gyms:gym_id(id, name, address, phone)
      `)
      .eq("gym_id", gymId)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data as GymContact | null;
  };

  // Create gym contact
  const createGymContact = useMutation({
    mutationFn: async (formData: GymContactFormData) => {
      const { data, error } = await supabase
        .from("gym_contacts")
        .insert({
          gym_id: formData.gym_id,
          manager_name: formData.manager_name || null,
          manager_email: formData.manager_email || null,
          manager_phone: formData.manager_phone || null,
          deputy_manager_name: formData.deputy_manager_name || null,
          deputy_manager_email: formData.deputy_manager_email || null,
          deputy_manager_phone: formData.deputy_manager_phone || null,
          preferred_delivery_channel: formData.preferred_delivery_channel || "email",
          notes: formData.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gym-contacts"] });
      toast({
        title: "Contact Created",
        description: "Gym contact profile has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update gym contact
  const updateGymContact = useMutation({
    mutationFn: async ({ id, ...formData }: GymContactFormData & { id: string }) => {
      const { data, error } = await supabase
        .from("gym_contacts")
        .update({
          manager_name: formData.manager_name || null,
          manager_email: formData.manager_email || null,
          manager_phone: formData.manager_phone || null,
          deputy_manager_name: formData.deputy_manager_name || null,
          deputy_manager_email: formData.deputy_manager_email || null,
          deputy_manager_phone: formData.deputy_manager_phone || null,
          preferred_delivery_channel: formData.preferred_delivery_channel || "email",
          notes: formData.notes || null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gym-contacts"] });
      toast({
        title: "Contact Updated",
        description: "Gym contact profile has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete gym contact
  const deleteGymContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("gym_contacts")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gym-contacts"] });
      toast({
        title: "Contact Deleted",
        description: "Gym contact profile has been deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    gymContacts,
    isLoading,
    error,
    refetch,
    getGymContact,
    createGymContact,
    updateGymContact,
    deleteGymContact,
  };
};
