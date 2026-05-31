import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "client" | "therapist" | "admin" | "super_admin";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [countryId, setCountryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Derived convenience booleans
  const isAdmin = roles.includes("admin") || roles.includes("super_admin");
  const isSuperAdmin = roles.includes("super_admin");
  const isTherapist = roles.includes("therapist");
  const isClient = roles.includes("client");

  const fetchRoles = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, branch_id, country_id")
        .eq("user_id", userId);

      if (error) {
        console.error("Error fetching roles:", error);
        return { roles: [] as AppRole[], branchId: null, countryId: null };
      }

      const userRoles = (data || []).map((r) => r.role as AppRole);
      const userBranch = data?.find((r) => r.branch_id)?.branch_id || null;
      const userCountry = data?.find((r) => r.country_id)?.country_id || null;
      return { roles: userRoles, branchId: userBranch, countryId: userCountry };
    } catch (err) {
      console.error("Exception fetching roles:", err);
      return { roles: [] as AppRole[], branchId: null };
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("[useAuth] onAuthStateChange:", { event, userId: session?.user?.id || null });
        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Keep loading=true until roles are fetched so ProtectedRoute waits
          setLoading(true);
          // Use queueMicrotask for faster execution than setTimeout
          queueMicrotask(async () => {
            if (!mounted) return;
            try {
              const result = await fetchRoles(session.user.id);
              console.log("[useAuth] Roles fetched (onChange):", { roles: result.roles, branchId: result.branchId, countryId: result.countryId });
              if (mounted) {
                setRoles(result.roles);
                setBranchId(result.branchId);
                setCountryId(result.countryId);
                setLoading(false);
              }
            } catch (err) {
              console.error("[useAuth] Role fetch failed:", err);
              if (mounted) setLoading(false);
            }
          });
        } else {
          setRoles([]);
          setBranchId(null);
          setCountryId(null);
          setLoading(false);
        }
      }
    );

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const result = await fetchRoles(session.user.id);
          console.log("[useAuth] Roles fetched (init):", { roles: result.roles, branchId: result.branchId, countryId: result.countryId });
          if (mounted) {
            setRoles(result.roles);
            setBranchId(result.branchId);
            setCountryId(result.countryId);
          }
        }

        if (mounted) setLoading(false);
      } catch (err) {
        console.error("Error initializing auth:", err);
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchRoles]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      setSession(null);
      setRoles([]);
      setBranchId(null);
      setCountryId(null);
    }
    return { error };
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  return {
    user,
    session,
    roles,
    branchId,
    countryId,
    isAdmin,
    isSuperAdmin,
    isTherapist,
    isClient,
    loading,
    signIn,
    signUp,
    signOut,
    hasRole,
  };
};
