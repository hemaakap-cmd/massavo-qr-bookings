import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ManagedUser {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
}

export function useAdminRoleManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
  };

  const callApi = async (body: Record<string, unknown>) => {
    const headers = await getAuthHeaders();
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-admin-role`,
      { method: "POST", headers, body: JSON.stringify(body) }
    );
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callApi({ action: "list_users", targetUserId: "_" });
      setUsers(data.users || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  const addAdmin = async (targetUserId: string) => {
    try {
      const data = await callApi({ action: "add_admin", targetUserId });
      toast({ title: "Success", description: data.message });
      await fetchUsers();
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return false;
    }
  };

  const removeAdmin = async (targetUserId: string) => {
    try {
      const data = await callApi({ action: "remove_admin", targetUserId });
      toast({ title: "Success", description: data.message });
      await fetchUsers();
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return false;
    }
  };

  return { users, loading, fetchUsers, addAdmin, removeAdmin };
}
