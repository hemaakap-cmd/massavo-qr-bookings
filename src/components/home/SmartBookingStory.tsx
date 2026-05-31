import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, MessageCircle, TrendingDown, Sparkles, ArrowRight, RotateCcw, FileText } from "lucide-react";
import { useTilt } from "@/hooks/useTilt";
import bodyFrontMale from "@/assets/body-front-male.png";
import bodyBackMale from "@/assets/body-back-male.png";

interface BodyArea {
  id: string;
  name: string;
  selected: boolean;
  focus: boolean;
  intensity: number;
  front: { x: number; y: number };
  back: { x: number; y: number };
}

// Area names are set dynamically in BodyMapMockup using translations
const createInitialAreas = (t: (key: string) => string): BodyArea[] => [
  { id: "neck", name: t("mockup.neck"), selected: true, focus: true, intensity: 7, front: { x: 75, y: 52 }, back: { x: 75, y: 48 } },
  { id: "l_shoulder", name: t("mockup.lShoulder"), selected: false, focus: false, intensity: 0, front: { x: 52, y: 68 }, back: { x: 98, y: 64 } },
  { id: "r_shoulder", name: t("mockup.rShoulder"), selected: true, focus: false, intensity: 4, front: { x: 98, y: 68 }, back: { x: 52, y: 64 } },
  { id: "upper_back", name: t("mockup.upperBack"), selected: true, focus: true, intensity: 8, front: { x: 75, y: 82 }, back: { x: 75, y: 78 } },
  { id: "lower_back", name: t("mockup.lowerBack"), selected: false, focus: false, intensity: 0, front: { x: 75, y: 108 }, back: { x: 75, y: 104 } },
  { id: "l_arm", name: t("mockup.lArm"), selected: false, focus: false, intensity: 0, front: { x: 40, y: 95 }, back: { x: 110, y: 91 } },
  { id: "r_arm", name: t("mockup.rArm"), selected: false, focus: false, intensity: 0, front: { x: 110, y: 95 }, back: { x: 40, y: 91 } },
];

function intensityColor(intensity: number): string {
  if (intensity <= 3) return "hsl(142 71% 45%)";
  if (intensity <= 6) return "hsl(32 70% 45%)";
  if (intensity <= 8) return "hsl(25 95% 53%)";
  return "hsl(0 72% 51%)";
}

function intensityOpacity(intensity: number): number {
  if (intensity === 0) return 0.3;
  return 0.4 + (intensity / 10) * 0.5;
}

function BodySilhouette({ view, areas, onToggle }: { view: "front" | "back"; areas: BodyArea[]; onToggle: (id: string) => void }) {
  const imgSrc = view === "front" ? bodyFrontMale : bodyBackMale;

  return (
    <div className="relative w-full" style={{ maxHeight: 220 }}>
      <img src={imgSrc} alt={`Body ${view} view`} className="w-full h-full object-contain" style={{ maxHeight: 220 }} draggable={false} />
      <svg viewBox="0 0 150 240" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
        {areas.map((area) => {
          const pos = view === "front" ? area.front : area.back;
          const isActive = area.selected;
          return (
            <g key={area.id} onClick={() => onToggle(area.id)} className="cursor-pointer" role="button" aria-label={`Toggle ${area.name}`}>
              {isActive && (
                <circle cx={pos.x} cy={pos.y} r="12" fill="none" stroke={intensityColor(area.intensity)} strokeWidth="1" opacity="0.4">
                  <animate attributeName="r" values="10;14;10" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={pos.x} cy={pos.y} r={isActive ? "8" : "6"} fill={isActive ? intensityColor(area.intensity) : "hsl(var(--muted-foreground))"} opacity={isActive ? intensityOpacity(area.intensity) : 0.2} className="transition-all duration-300" />
              {isActive && <circle cx={pos.x} cy={pos.y} r="3" fill={intensityColor(area.intensity)} opacity="0.9" />}
              {area.focus && isActive && (
                <>
                  <line x1={pos.x - 12} y1={pos.y} x2={pos.x - 5} y2={pos.y} stroke={intensityColor(area.intensity)} strokeWidth="1" opacity="0.6" />
                  <line x1={pos.x + 5} y1={pos.y} x2={pos.x + 12} y2={pos.y} stroke={intensityColor(area.intensity)} strokeWidth="1" opacity="0.6" />
                  <line x1={pos.x} y1={pos.y - 12} x2={pos.x} y2={pos.y - 5} stroke={intensityColor(area.intensity)} strokeWidth="1" opacity="0.6" />
                  <line x1={pos.x} y1={pos.y + 5} x2={pos.x} y2={pos.y + 12} stroke={intensityColor(area.intensity)} strokeWidth="1" opacity="0.6" />
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function BodyMapMockup() {
  const { t, i18n } = useTranslation();
  const [areas, setAreas] = useState<BodyArea[]>(() => createInitialAreas(t));
  const [view, setView] = useState<"front" | "back">("front");

  // Update area names when language changes
  useEffect(() => {
    setAreas((prev) => {
      const fresh = createInitialAreas(t);
      return prev.map((a) => {
        const match = fresh.find((f) => f.id === a.id);
        return match ? { ...a, name: match.name } : a;
      });
    });
  }, [i18n.language, t]);

  const toggleArea = (id: string) => {
    setAreas((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, selected: !a.selected, intensity: !a.selected ? (a.intensity || 5) : 0 } : a
      )
    );
  };

  return (
    <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/60 shadow-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-muted/30">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-destructive/50" />
          <div className="w-2 h-2 rounded-full bg-gold/50" />
          <div className="w-2 h-2 rounded-full bg-success/50" />
        </div>
        <span className="text-[9px] text-muted-foreground ml-2 font-mono">massavo.com/gym/booking</span>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
              <MapPin className="w-3.5 h-3.5 text-accent" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-foreground">{t("mockup.painPoints")}</h4>
              <p className="text-[10px] text-muted-foreground">{t("mockup.tapToSelect")}</p>
            </div>
          </div>
          <button
            onClick={() => setView(view === "front" ? "back" : "front")}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/40 border border-border/30 text-[9px] text-muted-foreground hover:bg-muted/60 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            {view === "front" ? t("mockup.back") : t("mockup.front")}
          </button>
        </div>

        <div className="flex gap-3">
          <div className="flex-shrink-0 w-[130px] bg-muted/20 rounded-xl border border-border/20 p-2 flex items-center justify-center">
            <BodySilhouette view={view} areas={areas} onToggle={toggleArea} />
          </div>
          <div className="flex-1 space-y-1 min-w-0">
            {areas.map((a) => (
              <button
                key={a.id}
                onClick={() => toggleArea(a.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                  a.selected ? "border-accent/30 bg-accent/5" : "border-border/20 bg-muted/20 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {a.selected && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: intensityColor(a.intensity) }} />}
                  <span className={`text-[11px] font-medium ${a.selected ? "text-foreground" : "text-muted-foreground"}`}>{a.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  {a.focus && a.selected && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-semibold">{t("mockup.focus")}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/20">
          {[
            { color: "bg-success", label: "1-3" },
            { color: "bg-gold", label: "4-6" },
            { color: "bg-orange-400", label: "7-8" },
            { color: "bg-destructive", label: "9-10" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${l.color}`} />
              <span className="text-[9px] text-muted-foreground">{l.label}</span>
            </div>
          ))}
          <span className="text-[8px] text-muted-foreground ml-auto">{t("mockup.focusZone")}</span>
        </div>
      </div>
    </div>
  );
}

function CommPrefMockup() {
  const { t } = useTranslation();
  const prefs = [
    { emoji: "🤫", label: t("mockup.silent"), desc: t("mockup.silentDesc"), active: false },
    { emoji: "💬", label: t("mockup.lightTalk"), desc: t("mockup.lightTalkDesc"), active: true },
    { emoji: "🗣️", label: t("mockup.normal"), desc: t("mockup.normalDesc"), active: false },
  ];

  return (
    <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/60 shadow-xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageCircle className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground">{t("mockup.commPref")}</h4>
            <p className="text-[10px] text-muted-foreground">{t("mockup.commPrefSub")}</p>
          </div>
        </div>
        <div className="space-y-2">
          {prefs.map((p) => (
            <div key={p.label} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${p.active ? "border-accent/40 bg-accent/5 shadow-sm" : "border-border/20 bg-muted/20"}`}>
              <span className="text-lg">{p.emoji}</span>
              <div className="flex-1">
                <span className={`text-xs font-medium ${p.active ? "text-accent" : "text-foreground"}`}>{p.label}</span>
                <p className="text-[10px] text-muted-foreground">{p.desc}</p>
              </div>
              {p.active && (
                <div className="w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                  <span className="text-[8px] text-accent-foreground font-bold">✓</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PainEvolutionMockup() {
  const { t } = useTranslation();
  return (
    <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/60 shadow-xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center">
            <TrendingDown className="w-3.5 h-3.5 text-success" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground">{t("mockup.painTracker")}</h4>
            <p className="text-[10px] text-muted-foreground">{t("mockup.lowerBackSessions")}</p>
          </div>
        </div>
        <div className="relative h-20 flex items-end gap-1 px-1">
          {[{ h: 85, label: "S1" }, { h: 65, label: "S2" }, { h: 45, label: "S3" }, { h: 25, label: "S4" }].map((bar) => (
            <div key={bar.label} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t-md bg-gradient-to-t from-accent/80 to-accent/40 transition-all" style={{ height: `${bar.h}%` }} />
              <span className="text-[8px] text-muted-foreground">{bar.label}</span>
            </div>
          ))}
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10">
            <TrendingDown className="w-3 h-3 text-success" />
            <span className="text-[9px] text-success font-bold">−70%</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border/20 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">{t("mockup.intensity")}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success font-semibold">{t("mockup.improving")}</span>
        </div>
      </div>
    </div>
  );
}

function NotesMockup() {
  const { t } = useTranslation();
  return (
    <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/60 shadow-xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground">{t("mockup.notes")}</h4>
            <p className="text-[10px] text-muted-foreground">{t("mockup.notesSub")}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border/30 bg-muted/20 p-3 min-h-[80px]">
          <p className="text-[11px] text-foreground leading-relaxed">
            {t("mockup.notesExample")}
          </p>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[9px] text-muted-foreground">{t("mockup.notesVisible")}</span>
          <span className="text-[9px] text-muted-foreground">142/500</span>
        </div>
      </div>
    </div>
  );
}

export default function SmartBookingStory() {
  const { t } = useTranslation();

  const steps = [
    {
      number: "01",
      title: t("smartBooking.step1Title"),
      description: t("smartBooking.step1Desc"),
      mockup: <BodyMapMockup />,
    },
    {
      number: "02",
      title: t("smartBooking.step2Title"),
      description: t("smartBooking.step2Desc"),
      mockup: <NotesMockup />,
    },
    {
      number: "03",
      title: t("smartBooking.step3Title"),
      description: t("smartBooking.step3Desc"),
      mockup: <CommPrefMockup />,
    },
    {
      number: "04",
      title: t("smartBooking.step4Title"),
      description: t("smartBooking.step4Desc"),
      mockup: <PainEvolutionMockup />,
    },
  ];

  return (
    <section className="relative py-24 md:py-32 overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.03),transparent_70%)]" />
      {/* Floating ambient orbs */}
      <span className="orb hidden md:block" style={{ left: "8%", top: "20%", width: 10, height: 10, background: "hsl(var(--gold) / 0.5)", ['--orb-x' as any]: "30px", ['--orb-dur' as any]: "14s" } as React.CSSProperties} aria-hidden />
      <span className="orb hidden md:block" style={{ right: "10%", top: "60%", width: 8, height: 8, background: "hsl(var(--accent) / 0.4)", ['--orb-x' as any]: "-25px", ['--orb-dur' as any]: "16s", ['--orb-delay' as any]: "-5s" } as React.CSSProperties} aria-hidden />

      <div className="container relative mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-20">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary/8 text-primary text-xs font-semibold tracking-wide uppercase mb-4 border border-primary/10">
            <Sparkles className="w-3.5 h-3.5" />
            {t("smartBooking.badge")}
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            {t("smartBooking.title")}{" "}
            <span className="text-primary">{t("smartBooking.titleHighlight")}</span>
          </h2>
          <p className="mt-4 text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            {t("smartBooking.subtitle")}
          </p>
        </div>

        <div className="space-y-24 md:space-y-32">
          {steps.map((step, i) => (
            <StoryRow key={step.number} step={step} index={i} seeHow={t("smartBooking.seeHow")} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StoryRow({
  step,
  index,
  seeHow,
}: {
  step: { number: string; title: string; description: string; mockup: React.ReactNode };
  index: number;
  seeHow: string;
}) {
  const tiltRef = useTilt<HTMLDivElement>({ max: 7, scale: 1.02 });
  const reversed = index % 2 === 1;
  return (
    <div className={`grid lg:grid-cols-2 gap-10 lg:gap-16 items-center ${reversed ? "lg:direction-rtl" : ""}`}>
      <div className={`space-y-4 ${reversed ? "lg:order-2 lg:text-left" : ""}`}>
        <span className="text-5xl md:text-6xl font-display font-bold text-accent/15">{step.number}</span>
        <h3 className="font-display text-2xl md:text-3xl font-bold text-foreground -mt-2">{step.title}</h3>
        <p className="text-muted-foreground text-base leading-relaxed max-w-md">{step.description}</p>
        <div className="flex items-center gap-2 text-accent text-sm font-medium pt-2 group cursor-default">
          <span>{seeHow}</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
      <div className={`${reversed ? "lg:order-1" : ""}`} style={{ perspective: "1200px" }}>
        <div className="relative max-w-sm mx-auto lg:mx-0">
          {/* Multi-layer ambient glow */}
          <div className="absolute -inset-6 bg-gradient-to-br from-primary/15 via-accent/10 to-transparent rounded-3xl blur-2xl animate-aura" />
          <div
            className="absolute -inset-10 rounded-3xl blur-3xl opacity-50"
            style={{ background: "radial-gradient(circle, hsl(var(--gold) / 0.15), transparent 70%)" }}
            aria-hidden
          />
          <div ref={tiltRef} className="relative rounded-2xl">
            <span className="glare-overlay rounded-2xl" aria-hidden />
            {step.mockup}
          </div>
        </div>
      </div>
    </div>
  );
}
