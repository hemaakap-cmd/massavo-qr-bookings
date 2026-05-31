import { AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SelectedArea } from "@/components/body-diagram/BodyDiagram";

interface ChronicRiskAlertProps {
  currentAreas: SelectedArea[];
  history: {
    bookingId: string;
    date: string;
    isCurrent: boolean;
    areas: SelectedArea[];
  }[];
  className?: string;
}

interface RiskItem {
  type: "severe_pain" | "no_improvement";
  areaLabel: string;
  areaCode: string;
  detail: string;
}

export function ChronicRiskAlert({ currentAreas, history, className }: ChronicRiskAlertProps) {
  const risks: RiskItem[] = [];

  // Check for severe pain (≥8)
  currentAreas
    .filter(a => a.painIntensity >= 8)
    .forEach(a => {
      risks.push({
        type: "severe_pain",
        areaLabel: a.label,
        areaCode: a.code,
        detail: `Pain intensity ${a.painIntensity}/10 — immediate attention recommended`,
      });
    });

  // Check for no improvement over 3+ sessions
  const pastSessions = history.filter(h => !h.isCurrent && h.areas.length > 0).slice(0, 3);
  if (pastSessions.length >= 3) {
    currentAreas.forEach(area => {
      const pastValues = pastSessions
        .map(s => s.areas.find(a => a.code === area.code)?.painIntensity)
        .filter((v): v is number => v !== undefined);

      if (pastValues.length >= 3) {
        const allSameOrWorse = pastValues.every(v => v >= area.painIntensity - 1);
        const avgPast = pastValues.reduce((s, v) => s + v, 0) / pastValues.length;
        if (allSameOrWorse && area.painIntensity >= avgPast - 0.5) {
          // Avoid duplicate if already flagged as severe
          if (!risks.some(r => r.areaCode === area.code)) {
            risks.push({
              type: "no_improvement",
              areaLabel: area.label,
              areaCode: area.code,
              detail: `No improvement over ${pastValues.length} sessions — consider referral`,
            });
          }
        }
      }
    });
  }

  if (risks.length === 0) return null;

  return (
    <div className={cn("rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2", className)}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        <span className="text-sm font-semibold text-destructive">
          ⚠ Chronic Issue Alert ({risks.length})
        </span>
      </div>
      <div className="space-y-1.5">
        {risks.map(risk => (
          <div key={risk.areaCode} className="flex items-start gap-2 text-xs">
            <span className={cn(
              "shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold",
              risk.type === "severe_pain"
                ? "bg-destructive/10 text-destructive"
                : "bg-amber-100 text-amber-800"
            )}>
              {risk.type === "severe_pain" ? "SEVERE" : "CHRONIC"}
            </span>
            <span className="text-foreground">
              <strong>{risk.areaLabel}</strong> — {risk.detail}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-1 border-t border-border/50">
        <ArrowRight className="w-3 h-3" />
        Consider specialist referral or modified treatment plan
      </div>
    </div>
  );
}
