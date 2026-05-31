import React from "react";
import { format } from "date-fns";
import EnterpriseReportLayout from "@/components/print/EnterpriseReportLayout";
import { PRINT_STYLES } from "@/constants/branding";
import type { SelectedArea } from "@/components/body-diagram/BodyDiagram";
import { BODY_AREAS } from "@/components/body-diagram/BodyDiagram";

interface ClinicalPdfReportProps {
  booking: {
    customerName: string;
    customerEmail: string;
    bookingDate: string;
    bookingTime: string;
    gymName: string;
    serviceName: string;
    therapistName: string;
    status: string;
    totalAmount: number;
  };
  areas: SelectedArea[];
  history: {
    bookingId: string;
    date: string;
    time: string;
    serviceName: string;
    isCurrent: boolean;
    areas: SelectedArea[];
  }[];
}

function getIntensityColor(i: number): string {
  if (i <= 3) return "#22c55e";
  if (i <= 6) return "#eab308";
  if (i <= 8) return "#f97316";
  return "#ef4444";
}

function getIntensityLabel(i: number): string {
  if (i <= 3) return "Low";
  if (i <= 6) return "Moderate";
  if (i <= 8) return "High";
  return "Severe";
}

/** Static SVG body diagram for print */
function PrintBodyDiagram({ areas, side }: { areas: SelectedArea[]; side: "front" | "back" }) {
  const sideAreas = BODY_AREAS.filter(a => a.side === side);
  const sideSelected = areas.filter(a => a.side === side);

  return (
    <div style={{ textAlign: "center" }}>
      <p style={{ fontSize: "6px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: PRINT_STYLES.colors.textMuted, marginBottom: "4px" }}>
        {side === "front" ? "Front View" : "Back View"}
      </p>
      <svg viewBox="0 0 200 330" style={{ width: "120px", height: "auto" }}>
        {/* Body outline */}
        <g opacity={0.12} stroke="#57534e" strokeWidth="1.5" fill="none">
          <ellipse cx="100" cy="30" rx="22" ry="25" />
          <rect x="90" y="52" width="20" height="18" rx="4" />
          <path d="M60 72 Q55 72 50 90 L42 155 Q40 170 55 185 L75 190 Q100 195 125 190 L145 185 Q160 170 158 155 L150 90 Q145 72 140 72 Z" />
          <path d="M50 85 Q35 95 30 135 Q28 155 33 195" />
          <path d="M150 85 Q165 95 170 135 Q172 155 167 195" />
          <path d="M75 190 Q70 220 68 260 Q65 290 68 320" />
          <path d="M125 190 Q130 220 132 260 Q135 290 132 320" />
        </g>
        {sideAreas.map(area => {
          const sel = sideSelected.find(s => s.code === area.code);
          if (!sel) return null;
          return (
            <g key={area.code}>
              <ellipse
                cx={area.cx} cy={area.cy} rx={area.rx} ry={area.ry}
                fill={getIntensityColor(sel.painIntensity)} opacity={0.55}
                stroke={getIntensityColor(sel.painIntensity)} strokeWidth={1.5}
              />
              <text x={area.cx} y={area.cy + 4} textAnchor="middle" fontSize="9" fontWeight="bold" fill="white">
                {sel.painIntensity}
              </text>
              {sel.isFocus && (
                <circle cx={area.cx + area.rx * 0.7} cy={area.cy - area.ry * 0.7} r="5"
                  fill="#c9782a" stroke="white" strokeWidth="0.8" />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function ClinicalPdfReport({ booking, areas, history }: ClinicalPdfReportProps) {
  const frontAreas = areas.filter(a => a.side === "front");
  const backAreas = areas.filter(a => a.side === "back");
  const focusAreas = areas.filter(a => a.isFocus);
  const highPainAreas = areas.filter(a => a.painIntensity >= 7);
  const avgPain = areas.length > 0 ? (areas.reduce((s, a) => s + a.painIntensity, 0) / areas.length).toFixed(1) : "N/A";

  // Previous session for comparison
  const previousSession = history.find(h => !h.isCurrent && h.areas.length > 0);

  return (
    <EnterpriseReportLayout
      title="Clinical Body Mapping Report"
      subtitle={`${booking.customerName || booking.customerEmail}`}
      dateRange={`${format(new Date(booking.bookingDate), "dd MMM yyyy")} at ${booking.bookingTime?.slice(0, 5)}`}
      reportType="administrative"
      category="administrative"
      showSignatureArea={true}
    >
      {/* Session Info */}
      <div style={{ marginBottom: "10px" }} className="print-no-break">
        <h3 style={{ fontFamily: PRINT_STYLES.fonts.display, fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: PRINT_STYLES.colors.primary, marginBottom: "6px", paddingBottom: "3px", borderBottom: `1px solid ${PRINT_STYLES.colors.primary}20` }}>
          Session Information
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", fontSize: "7px" }}>
          <div><span style={{ color: PRINT_STYLES.colors.textMuted }}>Client:</span> <strong>{booking.customerName || "N/A"}</strong></div>
          <div><span style={{ color: PRINT_STYLES.colors.textMuted }}>Location:</span> <strong>{booking.gymName}</strong></div>
          <div><span style={{ color: PRINT_STYLES.colors.textMuted }}>Treatment:</span> <strong>{booking.serviceName}</strong></div>
          <div><span style={{ color: PRINT_STYLES.colors.textMuted }}>Therapist:</span> <strong>{booking.therapistName || "Unassigned"}</strong></div>
          <div><span style={{ color: PRINT_STYLES.colors.textMuted }}>Status:</span> <strong style={{ textTransform: "capitalize" }}>{booking.status}</strong></div>
          <div><span style={{ color: PRINT_STYLES.colors.textMuted }}>Amount:</span> <strong>€{booking.totalAmount}</strong></div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", marginBottom: "10px" }} className="print-no-break">
        {[
          { label: "Affected Areas", value: String(areas.length), color: PRINT_STYLES.colors.primary },
          { label: "Focus Zones", value: String(focusAreas.length), color: "#c9782a" },
          { label: "Avg Pain", value: avgPain, color: PRINT_STYLES.colors.text },
          { label: "High Pain (≥7)", value: String(highPainAreas.length), color: highPainAreas.length > 0 ? "#ef4444" : "#22c55e" },
        ].map(card => (
          <div key={card.label} style={{ padding: "5px 8px", borderLeft: `2px solid ${card.color}`, backgroundColor: "#faf9f7", borderRadius: "0 2px 2px 0" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, fontFamily: PRINT_STYLES.fonts.display, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: "5.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: PRINT_STYLES.colors.textMuted }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Body Diagram */}
      <div className="print-no-break" style={{ marginBottom: "10px" }}>
        <h3 style={{ fontFamily: PRINT_STYLES.fonts.display, fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: PRINT_STYLES.colors.primary, marginBottom: "6px", paddingBottom: "3px", borderBottom: `1px solid ${PRINT_STYLES.colors.primary}20` }}>
          Body Diagram
        </h3>
        <div style={{ display: "flex", justifyContent: "center", gap: "24px" }}>
          <PrintBodyDiagram areas={areas} side="front" />
          <PrintBodyDiagram areas={areas} side="back" />
        </div>
        {/* Legend */}
        <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "6px", fontSize: "5.5px", color: PRINT_STYLES.colors.textMuted }}>
          {[
            { label: "1–3 Low", color: "#22c55e" },
            { label: "4–6 Moderate", color: "#eab308" },
            { label: "7–8 High", color: "#f97316" },
            { label: "9–10 Severe", color: "#ef4444" },
          ].map(l => (
            <span key={l.label} style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: l.color, display: "inline-block" }} />
              {l.label}
            </span>
          ))}
          <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#c9782a", display: "inline-block" }} />
            Focus Zone
          </span>
        </div>
      </div>

      {/* Detailed Area Table */}
      {areas.length > 0 && (
        <div className="print-no-break" style={{ marginBottom: "10px" }}>
          <h3 style={{ fontFamily: PRINT_STYLES.fonts.display, fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: PRINT_STYLES.colors.primary, marginBottom: "6px", paddingBottom: "3px", borderBottom: `1px solid ${PRINT_STYLES.colors.primary}20` }}>
            Pain Assessment Details
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "7px" }}>
            <thead>
              <tr style={{ backgroundColor: "#faf9f7" }}>
                <th style={{ textAlign: "left", padding: "4px 6px", fontWeight: 700, fontSize: "6px", textTransform: "uppercase", letterSpacing: "0.05em", color: PRINT_STYLES.colors.primary, borderBottom: `1px solid #e8e5e0` }}>Area</th>
                <th style={{ textAlign: "center", padding: "4px 6px", fontWeight: 700, fontSize: "6px", textTransform: "uppercase", letterSpacing: "0.05em", color: PRINT_STYLES.colors.primary, borderBottom: `1px solid #e8e5e0` }}>Side</th>
                <th style={{ textAlign: "center", padding: "4px 6px", fontWeight: 700, fontSize: "6px", textTransform: "uppercase", letterSpacing: "0.05em", color: PRINT_STYLES.colors.primary, borderBottom: `1px solid #e8e5e0` }}>Pain</th>
                <th style={{ textAlign: "center", padding: "4px 6px", fontWeight: 700, fontSize: "6px", textTransform: "uppercase", letterSpacing: "0.05em", color: PRINT_STYLES.colors.primary, borderBottom: `1px solid #e8e5e0` }}>Level</th>
                <th style={{ textAlign: "center", padding: "4px 6px", fontWeight: 700, fontSize: "6px", textTransform: "uppercase", letterSpacing: "0.05em", color: PRINT_STYLES.colors.primary, borderBottom: `1px solid #e8e5e0` }}>Focus</th>
                <th style={{ textAlign: "center", padding: "4px 6px", fontWeight: 700, fontSize: "6px", textTransform: "uppercase", letterSpacing: "0.05em", color: PRINT_STYLES.colors.primary, borderBottom: `1px solid #e8e5e0` }}>Trend</th>
                <th style={{ textAlign: "left", padding: "4px 6px", fontWeight: 700, fontSize: "6px", textTransform: "uppercase", letterSpacing: "0.05em", color: PRINT_STYLES.colors.primary, borderBottom: `1px solid #e8e5e0` }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((area, idx) => {
                const prev = previousSession?.areas.find(p => p.code === area.code);
                const diff = prev ? area.painIntensity - prev.painIntensity : null;
                return (
                  <tr key={area.code} style={{ backgroundColor: idx % 2 === 1 ? "#faf9f7" : "transparent" }}>
                    <td style={{ padding: "3px 6px", fontWeight: 500 }}>{area.label}</td>
                    <td style={{ padding: "3px 6px", textAlign: "center", textTransform: "capitalize" }}>{area.side}</td>
                    <td style={{ padding: "3px 6px", textAlign: "center", fontWeight: 700, color: getIntensityColor(area.painIntensity) }}>{area.painIntensity}/10</td>
                    <td style={{ padding: "3px 6px", textAlign: "center" }}>{getIntensityLabel(area.painIntensity)}</td>
                    <td style={{ padding: "3px 6px", textAlign: "center" }}>{area.isFocus ? "◎ Yes" : "—"}</td>
                    <td style={{ padding: "3px 6px", textAlign: "center", fontWeight: 600, color: diff === null ? "#9ca3af" : diff < 0 ? "#22c55e" : diff > 0 ? "#ef4444" : "#9ca3af" }}>
                      {diff === null ? "—" : diff < 0 ? `↓ ${Math.abs(diff)}` : diff > 0 ? `↑ +${diff}` : "→ Stable"}
                    </td>
                    <td style={{ padding: "3px 6px", color: PRINT_STYLES.colors.textMuted, fontStyle: area.notes ? "normal" : "italic" }}>{area.notes || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Session Comparison */}
      {previousSession && (
        <div className="print-no-break" style={{ marginBottom: "10px" }}>
          <h3 style={{ fontFamily: PRINT_STYLES.fonts.display, fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: PRINT_STYLES.colors.primary, marginBottom: "6px", paddingBottom: "3px", borderBottom: `1px solid ${PRINT_STYLES.colors.primary}20` }}>
            Session Comparison
          </h3>
          <div style={{ fontSize: "6.5px", color: PRINT_STYLES.colors.textMuted, marginBottom: "4px" }}>
            Comparing with previous session on {format(new Date(previousSession.date), "dd MMM yyyy")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
            {(() => {
              const commonAreas = areas.filter(c => previousSession.areas.some(p => p.code === c.code));
              const improved = commonAreas.filter(c => {
                const p = previousSession.areas.find(a => a.code === c.code);
                return p && c.painIntensity < p.painIntensity;
              }).length;
              const worsened = commonAreas.filter(c => {
                const p = previousSession.areas.find(a => a.code === c.code);
                return p && c.painIntensity > p.painIntensity;
              }).length;
              const stable = commonAreas.length - improved - worsened;
              return [
                { label: "Improved", value: improved, color: "#22c55e" },
                { label: "Stable", value: stable, color: "#9ca3af" },
                { label: "Worsened", value: worsened, color: "#ef4444" },
              ].map(s => (
                <div key={s.label} style={{ padding: "4px 8px", borderLeft: `2px solid ${s.color}`, backgroundColor: "#faf9f7", borderRadius: "0 2px 2px 0" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: "5.5px", color: PRINT_STYLES.colors.textMuted, fontWeight: 600, textTransform: "uppercase" }}>{s.label}</div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Chronic Risk Alerts */}
      {(areas.some(a => a.painIntensity >= 8) || (() => {
        if (!previousSession) return false;
        const thirdSession = history.filter(h => !h.isCurrent && h.areas.length > 0).slice(0, 3);
        if (thirdSession.length < 3) return false;
        return areas.some(a => {
          return thirdSession.every(s => {
            const prev = s.areas.find(p => p.code === a.code);
            return prev && prev.painIntensity >= a.painIntensity;
          });
        });
      })()) && (
        <div className="print-no-break" style={{ padding: "6px 10px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "3px", marginBottom: "10px" }}>
          <p style={{ fontSize: "7px", fontWeight: 700, color: "#dc2626", marginBottom: "2px" }}>⚠ Chronic Issue Alert</p>
          <p style={{ fontSize: "6px", color: "#991b1b", lineHeight: 1.4 }}>
            {areas.filter(a => a.painIntensity >= 8).length > 0 && `${areas.filter(a => a.painIntensity >= 8).map(a => a.label).join(", ")} — severe pain detected (≥8/10). `}
            Consider specialist referral or modified treatment plan. Flag client for clinical review.
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <div style={{ padding: "4px 8px", backgroundColor: "#faf9f7", borderLeft: `2px solid ${PRINT_STYLES.colors.primary}`, borderRadius: "0 2px 2px 0", marginTop: "8px" }}>
        <p style={{ fontSize: "5.5px", color: PRINT_STYLES.colors.textMuted, lineHeight: 1.4, margin: 0 }}>
          <strong>Disclaimer:</strong> This clinical body mapping report is for internal therapeutic documentation only and does not constitute a medical diagnosis. 
          All pain assessments are self-reported by the client and verified by the attending therapist. 
          This document is protected under GDPR regulations. Unauthorized distribution is prohibited.
        </p>
      </div>
    </EnterpriseReportLayout>
  );
}
