import { useRealtimeHealth } from "@/hooks/useRealtimeHealth";
import { Wifi, WifiOff, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Batch E: tiny header indicator for realtime connection health.
 * Safe to embed in admin/staff layouts; passive — no postgres subscriptions.
 */
export function RealtimeStatusBadge({ className }: { className?: string }) {
  const { status } = useRealtimeHealth();

  const map = {
    connecting: { icon: Loader2, label: "Connecting", color: "text-muted-foreground", spin: true },
    connected: { icon: Wifi, label: "Live", color: "text-green-500", spin: false },
    reconnecting: { icon: Loader2, label: "Reconnecting", color: "text-amber-500", spin: true },
    disconnected: { icon: WifiOff, label: "Offline", color: "text-destructive", spin: false },
    lag: { icon: AlertTriangle, label: "Lag", color: "text-amber-500", spin: false },
  } as const;

  const { icon: Icon, label, color, spin } = map[status];

  return (
    <div
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium", color, className)}
      title={`Realtime: ${label}`}
      aria-live="polite"
    >
      <Icon className={cn("w-3.5 h-3.5", spin && "animate-spin")} />
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}