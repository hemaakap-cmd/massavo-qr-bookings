import { cn } from "@/lib/utils";
import bodyFrontImg from "@/assets/body-front.png";
import bodyBackImg from "@/assets/body-back.png";

interface HeatmapArea {
  code: string;
  label: string;
  side: "front" | "back";
  painIntensity: number;
  isFocus?: boolean;
}

// Simplified positions for mini view
const AREA_POSITIONS: Record<string, { x: number; y: number; r: number }> = {
  head_front: { x: 50, y: 9, r: 7 },
  neck_front: { x: 50, y: 18, r: 4 },
  left_shoulder_front: { x: 33, y: 25, r: 6 },
  right_shoulder_front: { x: 67, y: 25, r: 6 },
  left_arm_upper: { x: 24, y: 37, r: 4 },
  right_arm_upper: { x: 76, y: 37, r: 4 },
  left_forearm: { x: 20, y: 50, r: 3 },
  right_forearm: { x: 80, y: 50, r: 3 },
  hips_front: { x: 50, y: 52, r: 8 },
  left_thigh_front: { x: 41, y: 65, r: 5 },
  right_thigh_front: { x: 59, y: 65, r: 5 },
  left_knee: { x: 41, y: 76, r: 4 },
  right_knee: { x: 59, y: 76, r: 4 },
  left_shin: { x: 41, y: 87, r: 4 },
  right_shin: { x: 59, y: 87, r: 4 },
  head_back: { x: 50, y: 9, r: 7 },
  neck_back: { x: 50, y: 18, r: 4 },
  left_shoulder_back: { x: 33, y: 25, r: 6 },
  right_shoulder_back: { x: 67, y: 25, r: 6 },
  upper_back: { x: 50, y: 32, r: 9 },
  left_arm_upper_back: { x: 24, y: 37, r: 4 },
  right_arm_upper_back: { x: 76, y: 37, r: 4 },
  lower_back: { x: 50, y: 42, r: 8 },
  left_forearm_back: { x: 20, y: 50, r: 3 },
  right_forearm_back: { x: 80, y: 50, r: 3 },
  glutes: { x: 50, y: 52, r: 8 },
  left_hamstring: { x: 41, y: 65, r: 5 },
  right_hamstring: { x: 59, y: 65, r: 5 },
  left_calf: { x: 41, y: 83, r: 5 },
  right_calf: { x: 59, y: 83, r: 5 },
};

function getColor(intensity: number): string {
  if (intensity <= 3) return "rgba(34, 197, 94, 0.85)";
  if (intensity <= 6) return "rgba(234, 179, 8, 0.85)";
  if (intensity <= 8) return "rgba(249, 115, 22, 0.85)";
  return "rgba(239, 68, 68, 0.90)";
}

interface MiniHeatmapPreviewProps {
  areas: HeatmapArea[];
  className?: string;
  size?: "xs" | "sm" | "md";
}

export function MiniHeatmapPreview({ areas, className, size = "sm" }: MiniHeatmapPreviewProps) {
  const sizeClasses = {
    xs: "w-8 h-14",
    sm: "w-12 h-20",
    md: "w-16 h-28",
  };

  const frontAreas = areas.filter(a => a.side === "front");
  const backAreas = areas.filter(a => a.side === "back");
  const showBack = backAreas.length > 0 && frontAreas.length === 0;
  const displayAreas = showBack ? backAreas : frontAreas.length > 0 ? frontAreas : areas;

  if (areas.length === 0) {
    return (
      <div className={cn(sizeClasses[size], "rounded bg-muted/30 flex items-center justify-center", className)}>
        <span className="text-[8px] text-muted-foreground">—</span>
      </div>
    );
  }

  return (
    <div className={cn("relative", sizeClasses[size], className)}>
      <img
        src={showBack ? bodyBackImg : bodyFrontImg}
        alt="Body"
        className="w-full h-full object-contain opacity-30"
      />
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          {displayAreas.map(area => {
            const pos = AREA_POSITIONS[area.code];
            if (!pos) return null;
            return (
              <radialGradient key={`grad-${area.code}`} id={`mini-grad-${area.code}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={getColor(area.painIntensity)} stopOpacity={0.7} />
                <stop offset="60%" stopColor={getColor(area.painIntensity)} stopOpacity={0.3} />
                <stop offset="100%" stopColor={getColor(area.painIntensity)} stopOpacity={0} />
              </radialGradient>
            );
          })}
        </defs>
        {displayAreas.map(area => {
          const pos = AREA_POSITIONS[area.code];
          if (!pos) return null;
          return (
            <g key={area.code}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={pos.r * 2}
                fill={`url(#mini-grad-${area.code})`}
              />
              <circle
                cx={pos.x}
                cy={pos.y}
                r={pos.r * 0.7}
                fill={getColor(area.painIntensity)}
                opacity={0.55}
                stroke={area.isFocus ? "white" : "none"}
                strokeWidth={area.isFocus ? 0.8 : 0}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
