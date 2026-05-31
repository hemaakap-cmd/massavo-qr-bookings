import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useClinicalUnlock } from "@/hooks/useClinicalUnlock";
import { Shield, ShieldCheck, Lock, Clock } from "lucide-react";

interface ClinicalUnlockGateProps {
  children: ReactNode;
  bookingId?: string;
  compact?: boolean;
}

export function ClinicalUnlockGate({ children, bookingId, compact = false }: ClinicalUnlockGateProps) {
  const { isUnlocked, formatRemaining, unlock, lock } = useClinicalUnlock();

  if (isUnlocked) {
    return (
      <div className="relative">
        {/* Warning Banner */}
        <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 rounded-lg bg-accent/10 border border-accent/30">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span className="text-xs font-medium text-accent-foreground">
              Clinical data unlocked — Auto-lock in {formatRemaining()}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={lock} className="h-6 px-2 text-xs text-accent-foreground hover:text-foreground">
            <Lock className="w-3 h-3 mr-1" /> Lock Now
          </Button>
        </div>
        {children}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
        <Shield className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground flex-1">Clinical data is protected</span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => unlock(bookingId)}
        >
          <Lock className="w-3 h-3" />
          Unlock
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 rounded-lg border border-border bg-muted/20">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Shield className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="font-display text-lg font-semibold text-foreground mb-1">Protected Clinical Data</h3>
      <p className="text-sm text-muted-foreground text-center mb-4 max-w-sm">
        This data is protected under GDPR medical data standards. Unlock to view clinical body mapping, pain records, and treatment notes.
      </p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
        <Clock className="w-3 h-3" />
        <span>Access expires after 3 minutes</span>
      </div>
      <Button onClick={() => unlock(bookingId)} className="gap-2">
        <Lock className="w-4 h-4" />
        Unlock Clinical Data
      </Button>
    </div>
  );
}
