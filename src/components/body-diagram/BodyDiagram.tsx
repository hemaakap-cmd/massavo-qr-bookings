import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Crosshair, Ban, Sparkles, Zap, ChevronRight, ChevronDown, ArrowRight } from "lucide-react";
import bodyFrontImg from "@/assets/body-front.png";
import bodyBackImg from "@/assets/body-back.png";
import bodyFrontMaleImg from "@/assets/body-front-male.png";
import bodyBackMaleImg from "@/assets/body-back-male.png";
import bodyFrontFemaleImg from "@/assets/body-front-female.png";
import bodyBackFemaleImg from "@/assets/body-back-female.png";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { getZoneExtra } from "@/utils/intensityPricing";

const PERMANENTLY_BLOCKED_AREAS = new Set(["genital", "pubic", "chest", "abdomen"]);

export interface BodyArea {
  code: string;
  label: string;
  side: "front" | "back";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

const BODY_AREAS: BodyArea[] = [
  // Front
  { code: "head_front", label: "Head", side: "front", cx: 100, cy: 30, rx: 20, ry: 22 },
  { code: "neck_front", label: "Neck", side: "front", cx: 100, cy: 62, rx: 12, ry: 10 },
  { code: "left_shoulder_front", label: "L Shoulder", side: "front", cx: 65, cy: 85, rx: 18, ry: 12 },
  { code: "right_shoulder_front", label: "R Shoulder", side: "front", cx: 135, cy: 85, rx: 18, ry: 12 },
  { code: "left_arm_upper", label: "L Upper Arm", side: "front", cx: 48, cy: 125, rx: 10, ry: 25 },
  { code: "right_arm_upper", label: "R Upper Arm", side: "front", cx: 152, cy: 125, rx: 10, ry: 25 },
  { code: "hips_front", label: "Hips", side: "front", cx: 100, cy: 172, rx: 28, ry: 15 },
  { code: "left_thigh_front", label: "L Thigh", side: "front", cx: 82, cy: 215, rx: 16, ry: 28 },
  { code: "right_thigh_front", label: "R Thigh", side: "front", cx: 118, cy: 215, rx: 16, ry: 28 },
  // Back
  { code: "neck_back", label: "Neck", side: "back", cx: 100, cy: 62, rx: 12, ry: 10 },
  { code: "left_shoulder_back", label: "L Shoulder", side: "back", cx: 65, cy: 85, rx: 18, ry: 12 },
  { code: "right_shoulder_back", label: "R Shoulder", side: "back", cx: 135, cy: 85, rx: 18, ry: 12 },
  { code: "upper_back", label: "Upper Back", side: "back", cx: 100, cy: 105, rx: 30, ry: 18 },
  { code: "lower_back", label: "Lower Back", side: "back", cx: 100, cy: 140, rx: 25, ry: 18 },
  { code: "glutes", label: "Glutes", side: "back", cx: 100, cy: 172, rx: 28, ry: 15 },
  { code: "left_hamstring", label: "L Hamstring", side: "back", cx: 82, cy: 215, rx: 16, ry: 28 },
  { code: "right_hamstring", label: "R Hamstring", side: "back", cx: 118, cy: 215, rx: 16, ry: 28 },
  { code: "left_calf", label: "L Calf", side: "back", cx: 82, cy: 275, rx: 10, ry: 28 },
  { code: "right_calf", label: "R Calf", side: "back", cx: 118, cy: 275, rx: 10, ry: 28 },
];

export interface SelectedArea {
  code: string;
  label: string;
  side: "front" | "back";
  painIntensity: number;
  isFocus?: boolean;
  notes?: string;
}

interface BodyDiagramProps {
  selectedAreas: SelectedArea[];
  onToggleArea?: (area: BodyArea) => void;
  onIntensityChange?: (code: string, intensity: number) => void;
  onToggleFocus?: (code: string) => void;
  onNotesChange?: (code: string, notes: string) => void;
  readOnly?: boolean;
  className?: string;
  disallowedAreas?: Set<string>;
  clientGender?: "male" | "female" | null;
  basePrice?: number;
  isUpgradeActive?: boolean;
  heatmapMode?: boolean;
}

function getBodyImage(side: "front" | "back", gender?: "male" | "female" | null): string {
  if (gender === "male") return side === "front" ? bodyFrontMaleImg : bodyBackMaleImg;
  if (gender === "female") return side === "front" ? bodyFrontFemaleImg : bodyBackFemaleImg;
  return side === "front" ? bodyFrontImg : bodyBackImg;
}

function getIntensityColor(intensity: number): string {
  if (intensity <= 3) return "hsl(142, 71%, 45%)";
  if (intensity <= 6) return "hsl(45, 93%, 47%)";
  if (intensity <= 8) return "hsl(25, 95%, 53%)";
  return "hsl(0, 84%, 60%)";
}

const AREA_LABEL_KEYS: Record<string, string> = {
  head_front: "head", neck_front: "neck",
  left_shoulder_front: "lShoulder", right_shoulder_front: "rShoulder",
  left_arm_upper: "lUpperArm", right_arm_upper: "rUpperArm",
  hips_front: "hips",
  left_thigh_front: "lThigh", right_thigh_front: "rThigh",
  neck_back: "neck",
  left_shoulder_back: "lShoulder", right_shoulder_back: "rShoulder",
  upper_back: "upperBack",
  lower_back: "lowerBack",
  glutes: "glutes",
  left_hamstring: "lHamstring", right_hamstring: "rHamstring",
  left_calf: "lCalf", right_calf: "rCalf",
};

/** Group L/R pair codes so they render as one row in the list. */
function groupSideAreas(areas: BodyArea[]): BodyArea[][] {
  const groups: BodyArea[][] = [];
  const used = new Set<string>();
  for (const a of areas) {
    if (used.has(a.code)) continue;
    if (a.code.startsWith("left_")) {
      const partnerCode = "right_" + a.code.slice("left_".length);
      const partner = areas.find(x => x.code === partnerCode);
      if (partner) {
        groups.push([a, partner]);
        used.add(a.code);
        used.add(partner.code);
        continue;
      }
    }
    if (a.code.startsWith("right_")) {
      const partnerCode = "left_" + a.code.slice("right_".length);
      const partner = areas.find(x => x.code === partnerCode);
      if (partner) {
        groups.push([partner, a]);
        used.add(a.code);
        used.add(partner.code);
        continue;
      }
    }
    groups.push([a]);
    used.add(a.code);
  }
  return groups;
}

function useAreaLabel() {
  const { t } = useTranslation();
  return (code: string, fallback: string) => {
    const key = AREA_LABEL_KEYS[code];
    return key ? t(`bodyDiagram.${key}`) : fallback;
  };
}

function CrosshairMarker({ cx, cy, intensity, isFocus }: { cx: number; cy: number; intensity: number; isFocus?: boolean }) {
  const color = getIntensityColor(intensity);
  const size = isFocus ? 14 : 10;
  return (
    <g>
      <circle cx={cx} cy={cy} r={size} fill="none" stroke={color} strokeWidth={2} opacity={0.9} />
      <line x1={cx - size - 4} y1={cy} x2={cx - size + 3} y2={cy} stroke={color} strokeWidth={1.5} />
      <line x1={cx + size - 3} y1={cy} x2={cx + size + 4} y2={cy} stroke={color} strokeWidth={1.5} />
      <line x1={cx} y1={cy - size - 4} x2={cx} y2={cy - size + 3} stroke={color} strokeWidth={1.5} />
      <line x1={cx} y1={cy + size - 3} x2={cx} y2={cy + size + 4} stroke={color} strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={2.5} fill={color} />
      <text x={cx} y={cy - size - 7} textAnchor="middle" fontSize="9" fontWeight="bold" fill={color} className="pointer-events-none select-none">
        {intensity}
      </text>
      {isFocus && (
        <circle cx={cx} cy={cy} r={size + 4} fill="none" stroke={color} strokeWidth={1} strokeDasharray="3 2" opacity={0.6} />
      )}
    </g>
  );
}

/** Clinical heatmap marker with radial gradient glow */
function HeatmapMarker({ cx, cy, rx, ry, intensity, isFocus, id }: {
  cx: number; cy: number; rx: number; ry: number; intensity: number; isFocus?: boolean; id: string;
}) {
  const color = getIntensityColor(intensity);
  const glowOpacity = 0.25 + (intensity / 10) * 0.4;
  const outerScale = 1.6;
  const pulseScale = isFocus ? 2.0 : 1.8;

  return (
    <g>
      {/* Outer soft glow */}
      <defs>
        <radialGradient id={`heatmap-grad-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity={glowOpacity + 0.15} />
          <stop offset="40%" stopColor={color} stopOpacity={glowOpacity} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Heatmap glow zone */}
      <ellipse
        cx={cx} cy={cy}
        rx={rx * pulseScale} ry={ry * pulseScale}
        fill={`url(#heatmap-grad-${id})`}
      />

      {/* Inner solid zone */}
      <ellipse
        cx={cx} cy={cy}
        rx={rx * 0.85} ry={ry * 0.85}
        fill={color}
        opacity={0.35}
        stroke={color}
        strokeWidth={1.2}
        strokeOpacity={0.7}
      />

      {/* Focus ring */}
      {isFocus && (
        <ellipse
          cx={cx} cy={cy}
          rx={rx * outerScale} ry={ry * outerScale}
          fill="none"
          stroke="white"
          strokeWidth={1.2}
          strokeDasharray="4 3"
          opacity={0.7}
        />
      )}

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={3} fill="white" opacity={0.9} />
      <circle cx={cx} cy={cy} r={2} fill={color} />

      {/* Intensity label */}
      <rect
        x={cx - 8} y={cy - ry * 0.85 - 16}
        width={16} height={13}
        rx={3}
        fill="hsl(var(--card))"
        stroke={color}
        strokeWidth={1}
        opacity={0.95}
      />
      <text
        x={cx} y={cy - ry * 0.85 - 7}
        textAnchor="middle"
        fontSize="9"
        fontWeight="bold"
        fill={color}
        className="pointer-events-none select-none"
      >
        {intensity}
      </text>
    </g>
  );
}

function BodyImageWithMarkers({ side, areas, selectedAreas, clientGender, onAreaClick, heatmapMode }: {
  side: "front" | "back";
  areas: BodyArea[];
  selectedAreas: SelectedArea[];
  clientGender?: "male" | "female" | null;
  onAreaClick?: (area: BodyArea) => void;
  heatmapMode?: boolean;
}) {
  const sideAreas = areas.filter(a => a.side === side);
  const imgSrc = getBodyImage(side, clientGender);

  return (
    <div className="relative w-full flex items-center justify-center">
      <img
        src={imgSrc}
        alt={`Body ${side} view`}
        className="w-full"
        style={{ objectFit: 'contain', maxHeight: '480px', opacity: heatmapMode ? 0.75 : 0.85 }}
      />
      <svg viewBox="0 0 200 330" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
        {sideAreas.map(area => {
          const selected = selectedAreas.find(s => s.code === area.code);
          return (
            <g key={area.code}>
              <ellipse
                cx={area.cx} cy={area.cy} rx={area.rx + 4} ry={area.ry + 4}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => onAreaClick?.(area)}
              />
              {selected && (
                <>
                  {heatmapMode && (
                    <HeatmapMarker
                      cx={area.cx} cy={area.cy}
                      rx={area.rx} ry={area.ry}
                      intensity={selected.painIntensity}
                      isFocus={selected.isFocus}
                      id={area.code}
                    />
                  )}
                  <CrosshairMarker
                    cx={area.cx} cy={area.cy}
                    intensity={selected.painIntensity}
                    isFocus={selected.isFocus}
                  />
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

type AreaState = "none" | "selected" | "focus";

function AreaToggleRow({ area, state, painIntensity, readOnly, isDisallowed, onToggle, onIntensityChange }: {
  area: BodyArea;
  state: AreaState;
  painIntensity: number;
  readOnly?: boolean;
  isDisallowed?: boolean;
  onToggle: (area: BodyArea, newState: AreaState) => void;
  onIntensityChange?: (code: string, intensity: number) => void;
}) {
  const { t } = useTranslation();
  const getLabel = useAreaLabel();
  const label = getLabel(area.code, area.label);
  const zoneExtra = getZoneExtra(painIntensity);

  if (isDisallowed && !readOnly) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 opacity-40 cursor-not-allowed select-none py-1">
              <span className="text-sm font-medium text-muted-foreground min-w-0 flex-1 line-through">{label}</span>
              <Ban className="w-4 h-4 text-destructive" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>{t("bodyDiagram.areaBlocked")}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const isActive = state !== "none";

  return (
    <div className={cn(
      "rounded-lg px-3 py-2 transition-all border",
      isActive ? "bg-primary/5 border-primary/20" : "bg-transparent border-transparent hover:bg-muted/30"
    )}>
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className={cn(
          "text-sm font-medium",
          isActive ? "text-foreground" : "text-muted-foreground"
        )}>{label}</span>
        {!readOnly ? (
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => onToggle(area, "none")}
              className={cn(
                "text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full border transition-colors font-medium whitespace-nowrap",
                state === "none"
                  ? "bg-muted text-foreground border-border"
                  : "bg-transparent text-muted-foreground border-transparent hover:bg-muted/50"
              )}
            >
              {t("bodyDiagram.no")}
            </button>
            <button
              type="button"
              onClick={() => onToggle(area, "selected")}
              className={cn(
                "text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full border transition-colors font-medium whitespace-nowrap",
                state === "selected"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-transparent hover:bg-primary/10"
              )}
            >
              {t("bodyDiagram.yesPlease")}
            </button>
            <button
              type="button"
              onClick={() => onToggle(area, "focus")}
              className={cn(
                "text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full border transition-colors font-medium whitespace-nowrap",
                state === "focus"
                  ? "bg-accent text-accent-foreground border-accent"
                  : "bg-transparent text-muted-foreground border-transparent hover:bg-accent/10"
              )}
            >
              {t("bodyDiagram.focus")}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {state === "selected" && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary/15 text-primary font-medium">{t("bodyDiagram.yes")}</span>
            )}
            {state === "focus" && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-accent/15 text-accent font-medium flex items-center gap-1">
                <Crosshair className="w-3 h-3" /> {t("bodyDiagram.focus")}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Intensity slider with live price */}
      {isActive && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 min-w-0">
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{t("bodyDiagram.pressure")}</span>
          {!readOnly && onIntensityChange ? (
            <>
              <input
                type="range" min={1} max={10}
                value={painIntensity}
                onChange={e => onIntensityChange(area.code, parseInt(e.target.value))}
                className="flex-1 min-w-[70px] h-1.5 accent-primary max-w-[100px]"
              />
              <span className="text-xs font-bold w-5 text-center shrink-0" style={{ color: getIntensityColor(painIntensity) }}>
                {painIntensity}
              </span>
              {zoneExtra > 0 && (
                <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0">
                  +{zoneExtra.toFixed(2)} €
                </span>
              )}
            </>

          ) : (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded"
              style={{ color: getIntensityColor(painIntensity), backgroundColor: getIntensityColor(painIntensity) + "20" }}>
              {painIntensity}/10
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Professional intro banner for intensity customization */
function IntensityInfoBanner() {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-primary/15 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">{t("bodyDiagram.intensityTitle")}</h4>
          <p className="text-[11px] text-muted-foreground">{t("bodyDiagram.intensitySubtitle")}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/60">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "hsl(142, 71%, 45%)" }} />
          <span className="text-muted-foreground">1-3 {t("bodyDiagram.gentle")}</span>
          <span className="ml-auto text-muted-foreground/60">+0</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/60">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "hsl(45, 93%, 47%)" }} />
          <span className="text-muted-foreground">4-5 {t("bodyDiagram.medium")}</span>
          <span className="ml-auto text-muted-foreground/60">+0.50</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/60">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "hsl(25, 95%, 53%)" }} />
          <span className="text-muted-foreground">6-7 {t("bodyDiagram.intense")}</span>
          <span className="ml-auto text-muted-foreground/60">+1</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/60">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "hsl(0, 84%, 60%)" }} />
          <span className="text-muted-foreground">8-10 {t("bodyDiagram.strong")}</span>
          <span className="ml-auto text-muted-foreground/60">+1.50-2</span>
        </div>
      </div>
    </div>
  );
}

/** Live total price display */
function LiveTotalPrice({ selectedAreas, basePrice, isUpgradeActive }: { selectedAreas: SelectedArea[]; basePrice: number; isUpgradeActive?: boolean }) {
  const { t } = useTranslation();
  const getLabel = useAreaLabel();
  const totalExtra = useMemo(() => {
    if (isUpgradeActive) return 9;
    return selectedAreas.reduce((sum, z) => sum + getZoneExtra(z.painIntensity), 0);
  }, [selectedAreas, isUpgradeActive]);

  const total = basePrice + totalExtra;

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 p-3 space-y-2 animate-in fade-in-0 duration-300">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 w-full min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/15 shrink-0">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground leading-snug break-words min-w-0">{t("bodyDiagram.totalPrice")}</span>
        </div>
        <span className="text-xl font-bold text-primary whitespace-nowrap shrink-0 ms-auto">{total.toFixed(2)} €</span>
      </div>



      <div className="space-y-1 text-[11px]">
        <div className="flex justify-between gap-2 text-muted-foreground min-w-0">
          <span className="min-w-0 break-words">{t("bodyDiagram.basePrice")}</span>
          <span className="whitespace-nowrap shrink-0">{basePrice.toFixed(2)} €</span>
        </div>
        {totalExtra > 0 && (
          <div className="flex justify-between gap-2 text-primary font-medium min-w-0">
            <span className="min-w-0 break-words">{isUpgradeActive ? t("bodyDiagram.deepTissueUpgrade") : t("bodyDiagram.intensitySurcharge")}</span>
            <span className="whitespace-nowrap shrink-0">+{totalExtra.toFixed(2)} €</span>
          </div>
        )}
        {!isUpgradeActive && selectedAreas.filter(z => getZoneExtra(z.painIntensity) > 0).length > 0 && (
          <div className="pl-2 border-l-2 border-primary/20 space-y-0.5 mt-1">
            {selectedAreas.filter(z => getZoneExtra(z.painIntensity) > 0).map(z => (
              <div key={z.code} className="flex justify-between gap-2 text-muted-foreground min-w-0">
                <span className="min-w-0 break-words">{getLabel(z.code, z.label)} ({t("bodyDiagram.level")} {z.painIntensity})</span>
                <span className="whitespace-nowrap shrink-0">+{getZoneExtra(z.painIntensity).toFixed(2)} €</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

/** Smart guidance nudge component */
function GuidanceNudge({ icon, text, onClick, variant = "default" }: {
  icon: React.ReactNode;
  text: string;
  onClick?: () => void;
  variant?: "default" | "pulse";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border text-left transition-all",
        "bg-gradient-to-r from-primary/8 to-accent/8 border-primary/25 hover:border-primary/40",
        variant === "pulse" && "animate-[nudge-pulse_2s_ease-in-out_infinite]"
      )}
    >
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/15 shrink-0">
        {icon}
      </div>
      <span className="text-xs font-medium text-foreground flex-1">{text}</span>
      <ArrowRight className="w-4 h-4 text-primary shrink-0" />
    </button>
  );
}

export function BodyDiagram({
  selectedAreas,
  onToggleArea,
  onIntensityChange,
  onToggleFocus,
  onNotesChange,
  readOnly = false,
  className,
  disallowedAreas,
  clientGender,
  basePrice,
  isUpgradeActive,
  heatmapMode = false,
}: BodyDiagramProps) {
  const { t } = useTranslation();
  const getLabel = useAreaLabel();
  const defaultSide = useMemo(() => {
    if (!readOnly || selectedAreas.length === 0) return "front";
    const frontCount = selectedAreas.filter(a => a.side === "front").length;
    const backCount = selectedAreas.filter(a => a.side === "back").length;
    if (backCount > 0 && frontCount === 0) return "back";
    return "front";
  }, [readOnly, selectedAreas]);

  const [activeSide, setActiveSide] = useState<"front" | "back">(defaultSide);
  const [hasVisitedBack, setHasVisitedBack] = useState(false);
  const notesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (readOnly) setActiveSide(defaultSide);
  }, [defaultSide, readOnly]);

  useEffect(() => {
    if (activeSide === "back") setHasVisitedBack(true);
  }, [activeSide]);

  const effectiveDisallowed = new Set([
    ...PERMANENTLY_BLOCKED_AREAS,
    ...(disallowedAreas ?? []),
  ]);

  const sideAreas = BODY_AREAS.filter(a => a.side === activeSide);

  const getAreaState = (code: string): AreaState => {
    const sel = selectedAreas.find(s => s.code === code);
    if (!sel) return "none";
    return sel.isFocus ? "focus" : "selected";
  };

  const handleToggle = (area: BodyArea, newState: AreaState) => {
    if (effectiveDisallowed.has(area.code)) return;
    const current = getAreaState(area.code);

    if (newState === "none" && current !== "none") {
      onToggleArea?.(area);
    } else if (newState === "selected") {
      if (current === "none") onToggleArea?.(area);
      if (current === "focus") onToggleFocus?.(area.code);
    } else if (newState === "focus") {
      if (current === "none") onToggleArea?.(area);
      if (current !== "focus") onToggleFocus?.(area.code);
    }
  };

  const handleImageClick = (area: BodyArea) => {
    if (readOnly || effectiveDisallowed.has(area.code)) return;
    const current = getAreaState(area.code);
    if (current === "none") {
      handleToggle(area, "selected");
    } else {
      handleToggle(area, "none");
    }
  };

  // Guidance logic
  const frontSelected = selectedAreas.filter(a => a.side === "front").length;
  const backSelected = selectedAreas.filter(a => a.side === "back").length;
  const showBackNudge = !readOnly && activeSide === "front" && frontSelected > 0 && backSelected === 0 && !hasVisitedBack;

  const scrollToNotes = useCallback(() => {
    notesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const switchToBack = useCallback(() => {
    setActiveSide("back");
  }, []);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Nudge pulse animation */}
      <style>{`
        @keyframes nudge-pulse {
          0%, 100% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0.2); }
          50% { box-shadow: 0 0 0 6px hsl(var(--primary) / 0); }
        }
        @keyframes tab-glow {
          0%, 100% { background-color: transparent; box-shadow: none; }
          50% { background-color: hsl(var(--primary) / 0.15); box-shadow: 0 0 12px hsl(var(--primary) / 0.3); }
        }
      `}</style>

      {!readOnly && <IntensityInfoBanner />}

      {/* Side tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["front", "back"] as const).map(side => {
          const isBackGlow = side === "back" && showBackNudge;
          return (
            <button
              key={side}
              type="button"
              onClick={() => setActiveSide(side)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors relative",
                activeSide === side
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
                isBackGlow && "animate-[tab-glow_1.5s_ease-in-out_infinite]"
              )}
            >
              {side === "front" ? t("bodyDiagram.frontSide") : t("bodyDiagram.backSide")}
              {isBackGlow && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-primary border-2 border-background" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Back-side nudge banner */}
      {showBackNudge && (
        <GuidanceNudge
          icon={<ArrowRight className="w-3.5 h-3.5 text-primary" />}
          text={t("bodyDiagram.backNudge")}
          onClick={switchToBack}
          variant="pulse"
        />
      )}

      {/* Side-by-side layout */}
      <div className="flex flex-row items-start gap-2 sm:gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          {selectedAreas.filter(a => a.side === activeSide).length > 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                <Crosshair className="w-3.5 h-3.5" />
                {selectedAreas.filter(a => a.side === activeSide).length} {t("bodyDiagram.areasSelected")}
              </div>
            </div>
          ) : readOnly && selectedAreas.length > 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">
              {t("bodyDiagram.noAreasThisSide")}
            </p>
          ) : null}

          <div className="space-y-1">
            {groupSideAreas(sideAreas).map(group => {
              const primary = group[0];
              const states = group.map(a => getAreaState(a.code));
              const combinedState: AreaState = states.includes("focus")
                ? "focus"
                : states.includes("selected") ? "selected" : "none";
              const intensities = group
                .map(a => selectedAreas.find(s => s.code === a.code)?.painIntensity)
                .filter((v): v is number => typeof v === "number");
              const combinedIntensity = intensities.length ? Math.max(...intensities) : 5;
              const allDisallowed = group.every(a => effectiveDisallowed.has(a.code));
              return (
                <AreaToggleRow
                  key={primary.code}
                  area={primary}
                  state={combinedState}
                  painIntensity={combinedIntensity}
                  readOnly={readOnly}
                  isDisallowed={allDisallowed}
                  onToggle={(_a, newState) => {
                    group.forEach(a => {
                      if (!effectiveDisallowed.has(a.code)) handleToggle(a, newState);
                    });
                  }}
                  onIntensityChange={onIntensityChange ? (_code, intensity) => {
                    group.forEach(a => {
                      if (selectedAreas.find(s => s.code === a.code)) {
                        onIntensityChange(a.code, intensity);
                      }
                    });
                  } : undefined}
                />
              );
            })}
          </div>

          {!readOnly && basePrice != null && selectedAreas.length > 0 && (
            <LiveTotalPrice selectedAreas={selectedAreas} basePrice={basePrice} isUpgradeActive={isUpgradeActive} />
          )}

          {/* Notes section with ref for scroll-to */}
          {!readOnly && onNotesChange && selectedAreas.filter(a => a.side === activeSide).length > 0 && (
            <div ref={notesRef} className="space-y-2 pt-2 border-t border-border">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("bodyDiagram.notes")}</h4>
              {(() => {
                const sideSelected = selectedAreas.filter(a => a.side === activeSide);
                const seen = new Set<string>();
                const groups: { primaryCode: string; label: string; areaCodes: string[]; note: string }[] = [];
                for (const a of sideSelected) {
                  if (seen.has(a.code)) continue;
                  let primaryCode = a.code;
                  let partnerCode: string | null = null;
                  if (a.code.startsWith("right_")) {
                    primaryCode = "left_" + a.code.slice("right_".length);
                    partnerCode = primaryCode;
                  } else if (a.code.startsWith("left_")) {
                    partnerCode = "right_" + a.code.slice("left_".length);
                  }
                  const partner = partnerCode ? sideSelected.find(x => x.code === partnerCode) : undefined;
                  const codes = partner ? [a.code, partner.code] : [a.code];
                  codes.forEach(c => seen.add(c));
                  const primary = sideSelected.find(x => x.code === primaryCode) ?? a;
                  groups.push({
                    primaryCode: primary.code,
                    label: getLabel(primary.code, primary.label),
                    areaCodes: codes,
                    note: a.notes || partner?.notes || "",
                  });
                }
                return groups.map(g => (
                  <div key={g.primaryCode} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground min-w-[80px]">{g.label}:</span>
                    <input
                      type="text"
                      placeholder={t("bodyDiagram.notePlaceholder")}
                      value={g.note}
                      onChange={e => g.areaCodes.forEach(c => onNotesChange(c, e.target.value))}
                      className="flex-1 text-xs px-2 py-1 rounded bg-background border border-border text-foreground placeholder:text-muted-foreground/50"
                    />
                  </div>
                ));
              })()}
            </div>
          )}

          {readOnly && selectedAreas.filter(a => a.notes && a.side === activeSide).length > 0 && (
            <div className="space-y-1 pt-2 border-t border-border">
              {selectedAreas.filter(a => a.notes && a.side === activeSide).map(area => (
                <p key={area.code} className="text-xs text-muted-foreground italic">
                  {getLabel(area.code, area.label)}: {area.notes}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Body image */}
        <div className="w-[108px] min-[400px]:w-[126px] sm:w-[200px] md:w-[280px] lg:w-[320px] flex-shrink-0 sticky top-20 self-start z-10">
          <div className="rounded-xl border border-border/50 bg-muted/20 p-2 backdrop-blur-sm">
            <BodyImageWithMarkers
              side={activeSide}
              areas={BODY_AREAS}
              selectedAreas={selectedAreas}
              clientGender={clientGender}
              onAreaClick={handleImageClick}
              heatmapMode={heatmapMode}
            />
            {!readOnly && (
              <p className="text-[10px] text-muted-foreground text-center mt-1 flex items-center justify-center gap-1">
                <ChevronRight className="w-3 h-3" />
                {t("bodyDiagram.tapToSelect")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Scroll-to-notes nudge when areas selected but currently scrolled away from notes */}
      {!readOnly && selectedAreas.length > 0 && onNotesChange && (
        <GuidanceNudge
          icon={<ChevronDown className="w-3.5 h-3.5 text-primary" />}
          text={t("bodyDiagram.notesNudge")}
          onClick={scrollToNotes}
        />
      )}
    </div>
  );
}

export { BODY_AREAS, getIntensityColor };
