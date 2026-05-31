import { useState, useCallback } from "react";
import { BodyDiagram, SelectedArea, BODY_AREAS, BodyArea } from "@/components/body-diagram/BodyDiagram";
import { useBookingBodyAreas, useSaveBodyAreas, useBodyAreaHistory, useBodyAreaChangeLogs } from "@/hooks/useBodyAreas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Crosshair, History, FileText, Activity } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ClinicalBodyPanelProps {
  bookingId: string;
  customerEmail?: string;
  readOnly?: boolean;
}

export function ClinicalBodyPanel({ bookingId, customerEmail, readOnly = false }: ClinicalBodyPanelProps) {
  const { data: dbAreas = [], isLoading } = useBookingBodyAreas(bookingId);
  const { saveArea, removeArea } = useSaveBodyAreas(bookingId);
  const { data: history = [] } = useBodyAreaHistory(customerEmail || null, bookingId);
  const { data: changeLogs = [] } = useBodyAreaChangeLogs(bookingId);
  const { toast } = useToast();

  // Local state mirrors DB but allows immediate UI updates
  const [localAreas, setLocalAreas] = useState<SelectedArea[] | null>(null);
  const areas = localAreas ?? dbAreas;

  const handleToggleArea = useCallback((area: BodyArea) => {
    const current = localAreas ?? dbAreas;
    const existing = current.find(a => a.code === area.code);

    if (existing) {
      const next = current.filter(a => a.code !== area.code);
      setLocalAreas(next);
      removeArea.mutate(area.code, {
        onError: () => {
          setLocalAreas(null);
          toast({ title: "Error", description: "Failed to remove area", variant: "destructive" });
        },
      });
    } else {
      const newArea: SelectedArea = {
        code: area.code,
        label: area.label,
        side: area.side,
        painIntensity: 5,
        isFocus: false,
        notes: "",
      };
      const next = [...current, newArea];
      setLocalAreas(next);
      saveArea.mutate(newArea, {
        onError: () => {
          setLocalAreas(null);
          toast({ title: "Error", description: "Failed to add area", variant: "destructive" });
        },
      });
    }
  }, [localAreas, dbAreas, saveArea, removeArea, toast]);

  const handleIntensityChange = useCallback((code: string, intensity: number) => {
    const current = localAreas ?? dbAreas;
    const updated = current.map(a => a.code === code ? { ...a, painIntensity: intensity } : a);
    setLocalAreas(updated);
    const area = updated.find(a => a.code === code);
    if (area) saveArea.mutate(area);
  }, [localAreas, dbAreas, saveArea]);

  const handleToggleFocus = useCallback((code: string) => {
    const current = localAreas ?? dbAreas;
    const updated = current.map(a => a.code === code ? { ...a, isFocus: !a.isFocus } : a);
    setLocalAreas(updated);
    const area = updated.find(a => a.code === code);
    if (area) saveArea.mutate(area);
  }, [localAreas, dbAreas, saveArea]);

  const handleNotesChange = useCallback((code: string, notes: string) => {
    const current = localAreas ?? dbAreas;
    const updated = current.map(a => a.code === code ? { ...a, notes } : a);
    setLocalAreas(updated);
  }, [localAreas, dbAreas]);

  const handleNotesBlur = useCallback((code: string) => {
    const current = localAreas ?? dbAreas;
    const area = current.find(a => a.code === code);
    if (area) saveArea.mutate(area);
  }, [localAreas, dbAreas, saveArea]);

  const focusCount = areas.filter(a => a.isFocus).length;
  const highPainCount = areas.filter(a => a.painIntensity >= 7).length;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Clinical Body Areas
          </CardTitle>
          <div className="flex items-center gap-2">
            {focusCount > 0 && (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Crosshair className="w-3 h-3" /> {focusCount} Focus
              </Badge>
            )}
            {highPainCount > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {highPainCount} High Pain
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="diagram" className="space-y-3">
          <TabsList className="grid grid-cols-3 h-8">
            <TabsTrigger value="diagram" className="text-xs">Diagram</TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              <History className="w-3 h-3 mr-1" />
              History
            </TabsTrigger>
            <TabsTrigger value="logs" className="text-xs">
              <FileText className="w-3 h-3 mr-1" />
              Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="diagram">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">Loading...</div>
            ) : (
              <BodyDiagram
                selectedAreas={areas}
                onToggleArea={readOnly ? undefined : handleToggleArea}
                onIntensityChange={readOnly ? undefined : handleIntensityChange}
                onToggleFocus={readOnly ? undefined : handleToggleFocus}
                onNotesChange={readOnly ? undefined : handleNotesChange}
                readOnly={readOnly}
              />
            )}
          </TabsContent>

          <TabsContent value="history">
            <SessionHistory history={history} />
          </TabsContent>

          <TabsContent value="logs">
            <ChangeLogList logs={changeLogs} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function SessionHistory({ history }: { history: any[] }) {
  if (!history.length) {
    return <p className="text-sm text-muted-foreground text-center py-6">No previous sessions found.</p>;
  }

  return (
    <ScrollArea className="max-h-[400px]">
      <div className="space-y-3">
        {history.map((session, i) => (
          <div
            key={session.bookingId}
            className={cn(
              "rounded-lg border p-3 text-sm space-y-2",
              session.isCurrent ? "border-primary/40 bg-primary/5" : "border-border"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  {format(new Date(session.date), "MMM d, yyyy")}
                </span>
                <span className="text-xs text-muted-foreground">{session.time?.slice(0, 5)}</span>
                {session.isCurrent && (
                  <Badge variant="secondary" className="text-[10px]">Current</Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{session.serviceName}</span>
            </div>
            {session.areas.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {session.areas.map((a: SelectedArea) => (
                  <span
                    key={a.code}
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full border",
                      a.isFocus ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground"
                    )}
                  >
                    {a.label} ({a.side}) — {a.painIntensity}/10
                    {a.isFocus && " ◎"}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No body areas recorded</p>
            )}

            {/* Progress indicator vs previous session */}
            {i < history.length - 1 && session.areas.length > 0 && history[i + 1]?.areas?.length > 0 && (
              <ProgressIndicator current={session.areas} previous={history[i + 1].areas} />
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function ProgressIndicator({ current, previous }: { current: SelectedArea[]; previous: SelectedArea[] }) {
  const commonAreas = current.filter(c => previous.some(p => p.code === c.code));
  if (!commonAreas.length) return null;

  const totalDiff = commonAreas.reduce((sum, c) => {
    const prev = previous.find(p => p.code === c.code);
    return sum + (prev ? c.painIntensity - prev.painIntensity : 0);
  }, 0);

  const avgDiff = totalDiff / commonAreas.length;

  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className="text-muted-foreground">vs previous:</span>
      <span className={cn(
        "font-semibold",
        avgDiff < 0 ? "text-green-500" : avgDiff > 0 ? "text-red-500" : "text-muted-foreground"
      )}>
        {avgDiff < 0 ? "↓ Improved" : avgDiff > 0 ? "↑ Worsened" : "→ Stable"}
        {Math.abs(avgDiff) > 0 && ` (${avgDiff > 0 ? "+" : ""}${avgDiff.toFixed(1)})`}
      </span>
    </div>
  );
}

function ChangeLogList({ logs }: { logs: any[] }) {
  if (!logs.length) {
    return <p className="text-sm text-muted-foreground text-center py-6">No changes logged yet.</p>;
  }

  return (
    <ScrollArea className="max-h-[300px]">
      <div className="space-y-1.5">
        {logs.map(log => (
          <div key={log.id} className="text-xs flex items-start gap-2 py-1 border-b border-border/50 last:border-0">
            <span className="text-muted-foreground whitespace-nowrap">
              {format(new Date(log.created_at), "MMM d HH:mm")}
            </span>
            <span className={cn(
              "font-medium",
              log.change_type === "created" ? "text-green-500" :
              log.change_type === "deleted" ? "text-red-500" : "text-primary"
            )}>
              {log.change_type}
            </span>
            <span className="text-foreground">
              {log.field_changed}
              {log.old_value && log.new_value && (
                <span className="text-muted-foreground"> {log.old_value} → {log.new_value}</span>
              )}
              {!log.old_value && log.new_value && (
                <span className="text-muted-foreground"> → {log.new_value}</span>
              )}
              {log.old_value && !log.new_value && (
                <span className="text-muted-foreground"> {log.old_value}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
