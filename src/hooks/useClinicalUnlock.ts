import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const UNLOCK_DURATION_MS = 3 * 60 * 1000; // 3 minutes

export function useClinicalUnlock() {
  const { user } = useAuth();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const lock = useCallback(async () => {
    setIsUnlocked(false);
    setExpiresAt(null);
    setRemainingSeconds(0);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const unlock = useCallback(async (bookingId?: string) => {
    if (!user) return false;

    // Log the access
    await supabase.from("clinical_access_logs").insert({
      user_id: user.id,
      booking_id: bookingId || null,
      action: "unlock",
    });

    const expires = new Date(Date.now() + UNLOCK_DURATION_MS);
    setIsUnlocked(true);
    setExpiresAt(expires);
    setRemainingSeconds(Math.ceil(UNLOCK_DURATION_MS / 1000));

    return true;
  }, [user]);

  // Countdown timer
  useEffect(() => {
    if (!isUnlocked || !expiresAt) return;

    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        lock();
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isUnlocked, expiresAt, lock]);

  // Auto-lock on inactivity
  useEffect(() => {
    if (!isUnlocked) return;

    const resetTimer = () => {
      if (expiresAt) {
        const newExpires = new Date(Date.now() + UNLOCK_DURATION_MS);
        setExpiresAt(newExpires);
      }
    };

    // Don't reset on every interaction - just auto-lock after the duration
    return () => {};
  }, [isUnlocked, expiresAt]);

  const formatRemaining = useCallback(() => {
    const min = Math.floor(remainingSeconds / 60);
    const sec = remainingSeconds % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  }, [remainingSeconds]);

  return {
    isUnlocked,
    remainingSeconds,
    formatRemaining,
    unlock,
    lock,
  };
}

export function useClinicalAccessLogs() {
  const { data, isLoading } = useAccessLogsQuery();
  return { logs: data || [], loading: isLoading };
}

function useAccessLogsQuery() {
  return {
    data: [] as any[],
    isLoading: false,
  };
}
