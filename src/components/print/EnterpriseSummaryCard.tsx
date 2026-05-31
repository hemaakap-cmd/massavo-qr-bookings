import { PRINT_STYLES } from "@/constants/branding";

interface EnterpriseSummaryCardProps {
  value: string | number;
  label: string;
  sublabel?: string;
  variant?: "primary" | "accent" | "neutral" | "success";
}

const EnterpriseSummaryCard = ({
  value,
  label,
  sublabel,
  variant = "neutral",
}: EnterpriseSummaryCardProps) => {
  const styles = {
    primary: { border: PRINT_STYLES.colors.primary, value: PRINT_STYLES.colors.primary },
    accent: { border: PRINT_STYLES.colors.accent, value: PRINT_STYLES.colors.accent },
    success: { border: "#16a34a", value: "#16a34a" },
    neutral: { border: "#cbd5e1", value: PRINT_STYLES.colors.text },
  }[variant];

  return (
    <div
      className="print-no-break"
      style={{
        borderLeft: `2px solid ${styles.border}`,
        padding: "4px 6px",
        backgroundColor: "#ffffff",
      }}
    >
      <div
        style={{
          fontFamily: PRINT_STYLES.fonts.display,
          fontSize: "11px",
          fontWeight: "700",
          color: styles.value,
          lineHeight: "1.1",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: "5.5px",
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: PRINT_STYLES.colors.textMuted,
          marginTop: "1px",
        }}
      >
        {label}
      </div>
      {sublabel && (
        <div style={{ fontSize: "5px", color: "#9ca3af", marginTop: "1px" }}>
          {sublabel}
        </div>
      )}
    </div>
  );
};

export default EnterpriseSummaryCard;
