import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RealtimeStatusBadge } from "@/components/admin/RealtimeStatusBadge";
import { useRealtimeHealth } from "@/hooks/useRealtimeHealth";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useSoftLaunchMode } from "@/hooks/useSoftLaunchMode";
import { Switch } from "@/components/ui/switch";

type Incident = {
  id: string;
  source: string;
  severity: "info" | "warning" | "error" | "critical";
  fingerprint: string;
  message: string;
  occurrences: number;
  first_seen: string;
  last_seen: string;
  resolved_at: string | null;
};

type EdgeFailure = {
  id: string;
  function_name: string;
  status_code: number | null;
  error_message: string | null;
  occurrences: number;
  last_seen: string;
};

const severityColor: Record<string, string> = {
  info: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  warning: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  error: "bg-red-500/15 text-red-500 border-red-500/30",
  critical: "bg-red-500/30 text-red-300 border-red-500/50",
};

export default function AdminSystemHealth() {
  const { status, lastMessageAt } = useRealtimeHealth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [edgeFailures, setEdgeFailures] = useState<EdgeFailure[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { enabled: softLaunch, toggle: toggleSoftLaunch } = useSoftLaunchMode();

  // Auto-refresh every 30s
  useEffect(() => {
    if (!autoRefresh) return;
    // Soft launch mode = faster refresh (15s)
    const interval = softLaunch ? 15_000 : 30_000;
    const id = window.setInterval(() => setRefreshKey((k) => k + 1), interval);
    return () => window.clearInterval(id);
  }, [autoRefresh, softLaunch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [inc, edge] = await Promise.all([
        supabase
          .from("system_incidents")
          .select("*")
          .order("last_seen", { ascending: false })
          .limit(100),
        supabase
          .from("edge_function_failures")
          .select("*")
          .order("last_seen", { ascending: false })
          .limit(100),
      ]);
      if (cancelled) return;
      setIncidents(((inc.data as unknown) as Incident[]) || []);
      setEdgeFailures(((edge.data as unknown) as EdgeFailure[]) || []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const unresolved = incidents.filter((i) => !i.resolved_at);
  const critical = unresolved.filter((i) => i.severity === "critical").length;
  const errors = unresolved.filter((i) => i.severity === "error").length;
  const warnings = unresolved.filter((i) => i.severity === "warning").length;

  // Top failing fingerprints (by occurrences)
  const topFingerprints = [...incidents]
    .filter((i) => !i.resolved_at)
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 5);

  // Top failing edge functions
  const topEdge = [...edgeFailures]
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 5);

  // Build hourly buckets for last 24h
  const buckets: { hour: string; count: number }[] = (() => {
    const arr: { hour: string; count: number }[] = [];
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const map = new Map<string, number>();
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 3600_000);
      const key = d.toISOString().slice(11, 13) + ":00";
      map.set(key, 0);
    }
    incidents.forEach((i) => {
      const t = new Date(i.last_seen);
      if (now.getTime() - t.getTime() > 24 * 3600_000) return;
      const key = t.toISOString().slice(11, 13) + ":00";
      map.set(key, (map.get(key) || 0) + (i.occurrences || 1));
    });
    map.forEach((count, hour) => arr.push({ hour, count }));
    return arr;
  })();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Activity className="w-6 h-6" /> System Health
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Realtime status, edge function failures, and incident timeline.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <RealtimeStatusBadge />
            <div className="flex items-center gap-2 px-3 py-1 rounded-md border bg-card">
              <span className="text-xs text-muted-foreground">Soft Launch</span>
              <Switch checked={softLaunch} onCheckedChange={toggleSoftLaunch} />
            </div>
            <Button
              size="sm"
              variant={autoRefresh ? "default" : "outline"}
              onClick={() => setAutoRefresh((v) => !v)}
            >
              {autoRefresh ? "Auto-refresh: on" : "Auto-refresh: off"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="gap-1"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground">Realtime</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              {status === "connected" ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              )}
              <span className="text-lg font-semibold capitalize">{status}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground">Critical</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-red-500">{critical}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground">Errors</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-orange-500">{errors}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground">Warnings</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-amber-500">{warnings}</span>
            </CardContent>
          </Card>
        </div>

        {/* Critical unresolved widget */}
        {critical > 0 && (
          <Card className="border-red-500/40 bg-red-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-red-500">
                <AlertTriangle className="w-4 h-4" /> Unresolved Critical Incidents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {unresolved.filter((i) => i.severity === "critical").slice(0, 5).map((i) => (
                  <div key={i.id} className="text-sm">
                    <span className="font-medium">{i.source}</span>
                    <span className="text-muted-foreground"> · {i.message}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top fingerprints + top edge failures */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Incident Fingerprints</CardTitle>
            </CardHeader>
            <CardContent>
              {topFingerprints.length === 0 ? (
                <p className="text-sm text-muted-foreground">No unresolved incidents.</p>
              ) : (
                <div className="space-y-2">
                  {topFingerprints.map((i) => (
                    <div key={i.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate min-w-0 flex-1 font-mono text-xs">{i.fingerprint}</span>
                      <Badge variant="outline">{i.occurrences}×</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Failing Edge Functions</CardTitle>
            </CardHeader>
            <CardContent>
              {topEdge.length === 0 ? (
                <p className="text-sm text-muted-foreground">No edge failures recorded.</p>
              ) : (
                <div className="space-y-2">
                  {topEdge.map((f) => (
                    <div key={f.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate min-w-0 flex-1 font-medium">{f.function_name}</span>
                      <Badge variant="outline">{f.occurrences}×</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Incidents */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Incidents</CardTitle>
          </CardHeader>
          <CardContent>
            {!loading && incidents.length > 0 && (
              <div className="h-40 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={buckets} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={3} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : incidents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No incidents recorded yet — system healthy.
              </p>
            ) : (
              <div className="space-y-2">
                {incidents.slice(0, 30).map((i) => (
                  <div
                    key={i.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-md border bg-card"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={severityColor[i.severity]}>
                          {i.severity}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{i.source}</span>
                        {i.resolved_at && (
                          <Badge variant="outline" className="text-xs text-green-500 border-green-500/30">
                            resolved
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm mt-1 truncate">{i.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {i.occurrences}× · last {new Date(i.last_seen).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edge function failures */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4" /> Edge Function Failures
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : edgeFailures.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No edge function failures recorded.
              </p>
            ) : (
              <div className="space-y-2">
                {edgeFailures.slice(0, 30).map((f) => (
                  <div
                    key={f.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-md border bg-card"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{f.function_name}</span>
                        {f.status_code != null && (
                          <Badge variant="outline" className="text-xs">
                            {f.status_code}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {f.error_message || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {f.occurrences}× · last {new Date(f.last_seen).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {lastMessageAt && (
          <p className="text-xs text-muted-foreground text-center">
            Last realtime message: {new Date(lastMessageAt).toLocaleTimeString()}
          </p>
        )}
      </div>
    </AdminLayout>
  );
}