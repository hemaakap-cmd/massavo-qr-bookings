import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ManagedUser {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
  branch_id: string | null;
  created_at: string;
}

interface RoleChangeLog {
  id: string;
  changed_by: string;
  target_user_id: string;
  target_email: string;
  old_role: string | null;
  new_role: string | null;
  action: string;
  reason: string | null;
  created_at: string;
}

export function useRoleManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [logs, setLogs] = useState<RoleChangeLog[]>([]);
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
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-roles`,
      { method: "POST", headers, body: JSON.stringify(body) }
    );
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callApi({ action: "list_users" });
      setUsers(data.users || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await callApi({ action: "get_logs" });
      setLogs(data.logs || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }, []);

  const addUser = async (email: string, role: string, reason?: string) => {
    try {
      const data = await callApi({ action: "add_user", targetEmail: email, role, reason });
      toast({ title: "Success", description: data.message });
      await fetchUsers();
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return false;
    }
  };

  const removeRole = async (userId: string, role: string, reason?: string) => {
    try {
      const data = await callApi({ action: "remove_role", targetUserId: userId, role, reason });
      toast({ title: "Success", description: data.message });
      await fetchUsers();
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return false;
    }
  };

  const promote = async (userId: string, reason?: string) => {
    try {
      const data = await callApi({ action: "promote", targetUserId: userId, reason });
      toast({ title: "Success", description: data.message });
      await fetchUsers();
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return false;
    }
  };

  const demote = async (userId: string, reason?: string) => {
    try {
      const data = await callApi({ action: "demote", targetUserId: userId, reason });
      toast({ title: "Success", description: data.message });
      await fetchUsers();
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return false;
    }
  };

  return { users, logs, loading, fetchUsers, fetchLogs, addUser, removeRole, promote, demote };
}
