import { Wifi, WifiOff, Activity, Radio } from "lucide-react";

interface MonitoringHeaderProps {
  realtimeConnected: boolean;
}

export function MonitoringHeader({ realtimeConnected }: MonitoringHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">
              Live Monitoring
            </h2>
            <p className="text-xs text-muted-foreground">
              Real-time booking events, conflicts & audit trail
            </p>
          </div>
        </div>
      </div>

      {realtimeConnected ? (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <Radio className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
            Live
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20">
          <span className="h-2 w-2 rounded-full bg-destructive" />
          <WifiOff className="w-3.5 h-3.5 text-destructive" />
          <span className="text-xs font-semibold text-destructive uppercase tracking-wider">
            Offline
          </span>
        </div>
      )}
    </div>
  );
}
