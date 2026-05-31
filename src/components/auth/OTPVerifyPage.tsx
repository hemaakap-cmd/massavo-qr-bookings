import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, Clock, AlertTriangle } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import massavoLogo from "@/assets/massavo-logo-3d.png";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";

interface OTPVerifyPageProps {
  title: string;
  loginPath: string;
  redirectMap: Record<string, string>;
}

const OTP_EXPIRY_SECONDS = 300; // 5 minutes

export default function OTPVerifyPage({ title, loginPath, redirectMap }: OTPVerifyPageProps) {
  const { t } = useTranslation();
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [expiryCountdown, setExpiryCountdown] = useState(OTP_EXPIRY_SECONDS);
  const [attempts, setAttempts] = useState(0);
  const [pendingRedirectRole, setPendingRedirectRole] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { roles, loading, user } = useAuth();
  const hasRedirected = useRef(false);

  const email = (location.state as { email?: string })?.email;
  const allowedRoles = (location.state as { allowedRoles?: AppRole[] })?.allowedRoles;

  useEffect(() => {
    if (!email || !allowedRoles) {
      navigate(loginPath, { replace: true });
    }
  }, [email, allowedRoles, navigate, loginPath]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Expiry countdown timer
  useEffect(() => {
    if (expiryCountdown > 0) {
      const timer = setTimeout(() => setExpiryCountdown(expiryCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [expiryCountdown]);

  const isExpired = expiryCountdown <= 0;
  const isLocked = attempts >= 5;

  const navigateToRole = useCallback((role: string) => {
    if (hasRedirected.current) return;

    hasRedirected.current = true;
    const redirect = redirectMap[role] || "/";
    console.log("[OTP-VERIFY] Redirecting to:", redirect, "for role:", role);
    toast({ title: t("auth.welcome"), description: t("auth.authenticated") });
    navigate(redirect, { replace: true });
  }, [navigate, redirectMap, t, toast]);

  // When useAuth reports the expected role, navigate
  useEffect(() => {
    if (pendingRedirectRole && !loading && user && !hasRedirected.current) {
      const hasRole = roles.includes(pendingRedirectRole as AppRole);
      console.log("[OTP-VERIFY] useAuth sync check:", { pendingRedirectRole, roles, hasRole, loading, userId: user?.id });
      if (hasRole) {
        navigateToRole(pendingRedirectRole);
      }
    }
  }, [pendingRedirectRole, roles, loading, user, navigateToRole]);

  // Timeout: if useAuth doesn't sync within 5 seconds, verify session exists and force redirect
  useEffect(() => {
    if (!pendingRedirectRole) return;
    const timeout = setTimeout(async () => {
      if (!hasRedirected.current) {
        // Double-check session exists before forcing redirect
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          console.log("[OTP-VERIFY] Timeout reached, session valid, forcing redirect for role:", pendingRedirectRole);
          navigateToRole(pendingRedirectRole);
        } else {
          console.error("[OTP-VERIFY] Timeout reached but no session found");
          toast({ title: t("auth.error"), description: t("auth.sessionExpired"), variant: "destructive" });
          setPendingRedirectRole(null);
        }
      }
    }, 5000);
    return () => clearTimeout(timeout);
  }, [pendingRedirectRole, navigateToRole, t, toast]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleVerify = async () => {
    if (otp.length < 6 || !email || !allowedRoles || isExpired || isLocked) return;
    setIsVerifying(true);

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ email, token: otp, allowedRoles }),
        }
      );

      const data = await resp.json();
      console.log("[OTP-VERIFY] Response:", { status: resp.status, role: data.role, hasSession: !!data.session });

      if (!resp.ok) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (resp.status === 429) {
          toast({
            title: t("auth.accountLocked"),
            description: t("auth.tooManyAttemptsWait"),
            variant: "destructive",
          });
        } else {
          toast({
            title: t("auth.verificationFailed"),
            description: data.error || t("auth.invalidCodeAttempts", { count: Math.max(0, 5 - newAttempts) }),
            variant: "destructive",
          });
        }
        setOtp("");
        return;
      }

      const matchedRole = typeof data.role === "string" ? data.role : null;

      // Set session — useAuth's onAuthStateChange will pick this up
      if (data.session) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        console.log("[OTP-VERIFY] setSession result:", { error: sessionError?.message || null });
        
        if (sessionError) {
          console.error("[OTP-VERIFY] setSession failed:", sessionError.message);
          toast({ title: t("auth.error"), description: t("auth.sessionCouldNotStart"), variant: "destructive" });
          setOtp("");
          return;
        }

        if (!matchedRole) {
          toast({ title: t("auth.error"), description: t("auth.verificationFailed"), variant: "destructive" });
          setOtp("");
          return;
        }

        setPendingRedirectRole(matchedRole);
        navigateToRole(matchedRole);
      }
    } catch {
      toast({ title: t("auth.error"), description: t("auth.networkError"), variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email || !allowedRoles) return;

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ email, allowedRoles }),
        }
      );

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        toast({
          title: t("auth.error"),
          description: data.error || t("auth.resendCodeFailed"),
          variant: "destructive",
        });
        return;
      }

      setResendCooldown(60);
      setExpiryCountdown(OTP_EXPIRY_SECONDS);
      setAttempts(0);
      setOtp("");
      toast({ title: t("auth.codeResent"), description: t("auth.checkEmailNewCode") });
    } catch {
      toast({ title: t("auth.error"), description: t("auth.resendCodeFailed"), variant: "destructive" });
    }
  };

  if (!email) return null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={massavoLogo} alt="MASSAVO" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="font-display text-3xl font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground mt-2">
            {t("auth.enterCodeSentTo")} <strong>{email}</strong>
          </p>
        </div>

        <div className="bg-card rounded-2xl p-8 shadow-card border border-border">
          {/* Status Banner */}
          {isExpired ? (
            <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-destructive/5 border border-destructive/10">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{t("auth.codeExpired")}</p>
            </div>
          ) : isLocked ? (
            <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-destructive/5 border border-destructive/10">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{t("auth.temporarilyLocked")}</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-success/5 border border-success/10">
              <ShieldCheck className="w-5 h-5 text-success flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  {t("auth.codeExpiresIn")} <strong className="text-foreground">{formatTime(expiryCountdown)}</strong>
                </p>
              </div>
              {attempts > 0 && (
                <span className="text-xs text-muted-foreground">
                  {t("auth.triesLeft", { count: 5 - attempts })}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-col items-center gap-6">
            <InputOTP maxLength={8} value={otp} onChange={setOtp} disabled={isExpired || isLocked}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
                <InputOTPSlot index={6} />
                <InputOTPSlot index={7} />
              </InputOTPGroup>
            </InputOTP>

            <Button
              variant="sage"
              className="w-full"
              disabled={otp.length < 6 || isVerifying || isExpired || isLocked || !!pendingRedirectRole}
              onClick={handleVerify}
            >
              {isVerifying || pendingRedirectRole ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {pendingRedirectRole ? t("auth.signingIn") : t("auth.verifying")}
                </>
              ) : (
                t("auth.verifyAndSignIn")
              )}
            </Button>

            <div className="flex flex-col items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={resendCooldown > 0}
                onClick={handleResend}
                className="text-muted-foreground"
              >
                {resendCooldown > 0
                  ? t("auth.resendCodeIn", { seconds: resendCooldown })
                  : t("auth.resendCode")}
              </Button>

              <Button
                variant="link"
                size="sm"
                onClick={() => navigate(loginPath, { replace: true })}
                className="text-muted-foreground/60 text-xs"
              >
                {t("auth.useDifferentEmail")}
              </Button>
            </div>
          </div>
        </div>

        {/* Security note */}
        <p className="text-center text-[10px] text-muted-foreground/50 mt-4">
          {t("auth.securityNote")}
        </p>
      </div>
    </div>
  );
}
