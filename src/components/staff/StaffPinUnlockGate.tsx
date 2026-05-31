import { useState, useRef, useEffect, useCallback, ReactNode } from "react";
import { EyeOff, Eye, Lock, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const CLINICAL_PIN = "1234";
const AUTO_LOCK_MS = 3 * 60 * 1000; // 3 minutes

interface StaffPinUnlockGateProps {
  children: ReactNode;
  label?: string;
}

export function StaffPinUnlockGate({ children, label }: StaffPinUnlockGateProps) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t("staff.pinGate.protectedData");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const expiresRef = useRef<Date | null>(null);

  const lock = useCallback(() => {
    setIsUnlocked(false);
    setPin(["", "", "", ""]);
    setRemainingSeconds(0);
    expiresRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const unlock = useCallback(() => {
    setIsUnlocked(true);
    const expires = new Date(Date.now() + AUTO_LOCK_MS);
    expiresRef.current = expires;
    setRemainingSeconds(Math.ceil(AUTO_LOCK_MS / 1000));

    timerRef.current = setInterval(() => {
      if (!expiresRef.current) return;
      const remaining = Math.max(0, Math.ceil((expiresRef.current.getTime() - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining <= 0) lock();
    }, 1000);
  }, [lock]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleDigit = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    setError(false);

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    // Auto-focus next
    if (value && index < 3) {
      inputsRef.current[index + 1]?.focus();
    }

    // Check PIN when all 4 digits entered
    if (value && index === 3) {
      const entered = newPin.join("");
      if (entered === CLINICAL_PIN) {
        unlock();
      } else {
        setError(true);
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setPin(["", "", "", ""]);
          inputsRef.current[0]?.focus();
        }, 500);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const formatRemaining = () => {
    const min = Math.floor(remainingSeconds / 60);
    const sec = remainingSeconds % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  if (isUnlocked) {
    return (
      <div className="space-y-3">
        {/* Unlocked banner */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-foreground">
              {t("staff.pinGate.visibleNotice", { time: formatRemaining() })}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={lock}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <Lock className="w-3 h-3" /> {t("staff.pinGate.lock")}
          </Button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 to-muted/10 overflow-hidden">
      <div className="flex flex-col items-center justify-center py-10 px-6">
        {/* Closed eye icon */}
        <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-4 border border-border/40">
          <EyeOff className="w-7 h-7 text-muted-foreground" />
        </div>

        <h3 className="text-sm font-semibold text-foreground mb-1">{resolvedLabel}</h3>
        <p className="text-xs text-muted-foreground text-center mb-5 max-w-[240px]">
          {t("staff.pinGate.enterPin")}
        </p>

        {/* PIN input */}
        <div
          className={cn(
            "flex gap-2.5 mb-3 transition-transform",
            shake && "animate-[shake_0.4s_ease-in-out]"
          )}
        >
          {pin.map((digit, i) => (
            <input
              key={i}
              ref={el => { inputsRef.current[i] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className={cn(
                "w-11 h-12 text-center text-lg font-bold rounded-lg border-2 bg-background transition-colors outline-none",
                "focus:border-primary focus:ring-2 focus:ring-primary/20",
                error
                  ? "border-destructive text-destructive"
                  : digit
                    ? "border-primary/50 text-foreground"
                    : "border-border text-muted-foreground"
              )}
            />
          ))}
        </div>

        {error && (
          <p className="text-xs text-destructive font-medium mb-2">{t("staff.pinGate.wrongPin")}</p>
        )}

        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1">
          <Clock className="w-3 h-3" />
          <span>{t("staff.pinGate.expiresIn3Min")}</span>
        </div>
      </div>
    </div>
  );
}
