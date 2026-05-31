import { useState, useCallback, useRef, useEffect } from "react";

interface BotProtectionState {
  isVerified: boolean;
  token: string;
  formLoadTime: number;
}

export const useBotProtection = () => {
  const formLoadTimeRef = useRef<number>(Date.now());
  const [state, setState] = useState<BotProtectionState>({
    isVerified: false,
    token: "",
    formLoadTime: formLoadTimeRef.current,
  });

  // Reset form load time when component mounts
  useEffect(() => {
    formLoadTimeRef.current = Date.now();
    setState(prev => ({
      ...prev,
      formLoadTime: formLoadTimeRef.current,
    }));
  }, []);

  const handleVerification = useCallback((verified: boolean, token: string) => {
    setState(prev => ({
      ...prev,
      isVerified: verified,
      token: verified ? token : "",
    }));
  }, []);

  const validateToken = useCallback((token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token));
      
      // Check if token has required fields
      if (!payload.t || !payload.d || !payload.v) {
        return false;
      }
      
      // Check if form wasn't filled too fast (< 3 seconds)
      if (payload.d < 3000) {
        return false;
      }
      
      // Check if token isn't too old (> 30 minutes)
      const tokenAge = Date.now() - payload.v;
      if (tokenAge > 30 * 60 * 1000) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    isVerified: state.isVerified,
    token: state.token,
    formLoadTime: state.formLoadTime,
    handleVerification,
    validateToken,
  };
};
