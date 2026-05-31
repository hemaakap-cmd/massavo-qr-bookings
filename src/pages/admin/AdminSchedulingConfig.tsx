import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Settings, Clock, Route, Brain, Save, Loader2 } from "lucide-react";

interface SchedulingConfigRow {
  id: string;
  key: string;
  value: any;
  description: string | null;
}

interface ServiceWithBuffers {
  id: string;
  name: string;
  duration_minutes: number;
  buffer_before_minutes: number | null;
  buffer_after_minutes: number | null;
}

export default function AdminSchedulingConfig() {
  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["scheduling-config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("scheduling_config")
        .select("*")
        .order("key");
      if (error) throw error;
      return data as SchedulingConfigRow[];
    },
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services-buffers"],
    queryFn: async () => {
      // Use raw query to access new columns not yet in generated types
      const { data, error } = await (supabase as any)
        .from("services")
        .select("id, name, duration_minutes, buffer_before_minutes, buffer_after_minutes")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as ServiceWithBuffers[];
    },
  });

  const getConfigValue = (key: string): any => {
    const cfg = configs.find(c => c.key === key);
    return cfg?.value;
  };

  const [bufferBefore, setBufferBefore] = useState<string>("");
  const [bufferAfter, setBufferAfter] = useState<string>("");
  const [smartSpreading, setSmartSpreading] = useState(true);
  const [travelEnabled, setTravelEnabled] = useState(false);
  const [travelMinutes, setTravelMinutes] = useState<string>("30");

  const initialized = configs.length > 0;
  if (initialized && bufferBefore === "") {
    const bb = getConfigValue("default_buffer_before");
    const ba = getConfigValue("default_buffer_after");
    const ss = getConfigValue("smart_spreading_enabled");
    const te = getConfigValue("travel_time_enabled");
    const tm = getConfigValue("travel_time_minutes");
    if (bb !== undefined) setBufferBefore(String(bb));
    if (ba !== undefined) setBufferAfter(String(ba));
    if (ss !== undefined) setSmartSpreading(ss === true || ss === "true");
    if (te !== undefined) setTravelEnabled(te === true || te === "true");
    if (tm !== undefined) setTravelMinutes(String(tm));
  }

  const updateConfig = useMutation({
    mutationFn: async (updates: { key: string; value: any }[]) => {
      for (const u of updates) {
        const { error } = await (supabase as any)
          .from("scheduling_config")
          .update({ value: u.value })
          .eq("key", u.key);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduling-config"] });
      toast.success("Scheduling configuration saved");
    },
    onError: (err: any) => toast.error("Failed to save: " + err.message),
  });

  const updateServiceBuffer = useMutation({
    mutationFn: async ({ serviceId, bufferBefore, bufferAfter }: { serviceId: string; bufferBefore: number | null; bufferAfter: number | null }) => {
      const { error } = await (supabase as any)
        .from("services")
        .update({ buffer_before_minutes: bufferBefore, buffer_after_minutes: bufferAfter })
        .eq("id", serviceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services-buffers"] });
      toast.success("Service buffer updated");
    },
    onError: (err: any) => toast.error("Failed to update: " + err.message),
  });

  const handleSaveGlobal = () => {
    updateConfig.mutate([
      { key: "default_buffer_before", value: parseInt(bufferBefore) || 5 },
      { key: "default_buffer_after", value: parseInt(bufferAfter) || 5 },
      { key: "smart_spreading_enabled", value: smartSpreading },
      { key: "travel_time_enabled", value: travelEnabled },
      { key: "travel_time_minutes", value: parseInt(travelMinutes) || 30 },
    ]);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Intelligent Scheduling
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure AI-powered buffer times, workload optimization, and travel logic
          </p>
        </div>

        {/* Global Buffer Defaults */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Default Buffer Times
            </CardTitle>
            <CardDescription>
              Internal preparation and cleanup time added around each session. Not visible to clients.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preparation Time (before)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={30}
                    value={bufferBefore}
                    onChange={(e) => setBufferBefore(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cleanup Time (after)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={30}
                    value={bufferAfter}
                    onChange={(e) => setBufferAfter(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Workload Optimization */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Workload Optimization
            </CardTitle>
            <CardDescription>
              Intelligent scheduling features for therapist efficiency
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Smart Slot Spreading</p>
                <p className="text-sm text-muted-foreground">
                  Distribute bookings evenly across the day and highlight recommended time slots
                </p>
              </div>
              <Switch checked={smartSpreading} onCheckedChange={setSmartSpreading} />
            </div>
          </CardContent>
        </Card>

        {/* Travel Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5 text-primary" />
              Travel Time Logic
              <Badge variant="secondary" className="text-xs">Future</Badge>
            </CardTitle>
            <CardDescription>
              Account for therapist travel between gym locations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Enable Travel Time</p>
                <p className="text-sm text-muted-foreground">
                  Add transit buffers when therapists switch locations
                </p>
              </div>
              <Switch checked={travelEnabled} onCheckedChange={setTravelEnabled} />
            </div>
            {travelEnabled && (
              <div className="space-y-2">
                <Label>Default Travel Time</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={120}
                    value={travelMinutes}
                    onChange={(e) => setTravelMinutes(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">minutes between gyms</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Button onClick={handleSaveGlobal} disabled={updateConfig.isPending} className="w-full">
          {updateConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Global Settings
        </Button>

        <Separator />

        {/* Per-Service Buffer Overrides */}
        <Card>
          <CardHeader>
            <CardTitle>Service-Specific Buffer Overrides</CardTitle>
            <CardDescription>
              Override default buffers for specific service types. Leave empty to use global defaults ({bufferBefore || 5}/{bufferAfter || 5} min).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {services.map((service) => (
                <ServiceBufferRow
                  key={service.id}
                  service={service}
                  defaultBefore={parseInt(bufferBefore) || 5}
                  defaultAfter={parseInt(bufferAfter) || 5}
                  onSave={(before, after) =>
                    updateServiceBuffer.mutate({
                      serviceId: service.id,
                      bufferBefore: before,
                      bufferAfter: after,
                    })
                  }
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function ServiceBufferRow({
  service,
  defaultBefore,
  defaultAfter,
  onSave,
}: {
  service: ServiceWithBuffers;
  defaultBefore: number;
  defaultAfter: number;
  onSave: (before: number | null, after: number | null) => void;
}) {
  const [before, setBefore] = useState(service.buffer_before_minutes?.toString() ?? "");
  const [after, setAfter] = useState(service.buffer_after_minutes?.toString() ?? "");
  const hasOverride = service.buffer_before_minutes != null || service.buffer_after_minutes != null;

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg border bg-card">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{service.name}</p>
        <p className="text-xs text-muted-foreground">{service.duration_minutes} min</p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          max={30}
          placeholder={String(defaultBefore)}
          value={before}
          onChange={(e) => setBefore(e.target.value)}
          className="w-16 h-8 text-xs"
        />
        <span className="text-xs text-muted-foreground">/</span>
        <Input
          type="number"
          min={0}
          max={30}
          placeholder={String(defaultAfter)}
          value={after}
          onChange={(e) => setAfter(e.target.value)}
          className="w-16 h-8 text-xs"
        />
        <Button
          size="sm"
          variant={hasOverride ? "default" : "outline"}
          className="h-8 text-xs"
          onClick={() => onSave(
            before === "" ? null : parseInt(before),
            after === "" ? null : parseInt(after)
          )}
        >
          {hasOverride ? "Update" : "Set"}
        </Button>
      </div>
    </div>
  );
}
