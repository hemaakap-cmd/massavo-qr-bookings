import { PRINT_STYLES } from "@/constants/branding";

interface PrintSummaryCardProps {
  value: string | number;
  label: string;
  sublabel?: string;
  variant?: "primary" | "accent" | "neutral";
}

/**
 * Print-optimized summary card
 * Uses two-color palette for professional appearance
 */
const PrintSummaryCard = ({ 
  value, 
  label, 
  sublabel,
  variant = "neutral",
}: PrintSummaryCardProps) => {
  const getStyles = () => {
    switch (variant) {
      case "primary":
        return {
          backgroundColor: PRINT_STYLES.colors.background,
          borderColor: PRINT_STYLES.colors.primary,
          valueColor: PRINT_STYLES.colors.primary,
          labelColor: PRINT_STYLES.colors.primary,
        };
      case "accent":
        return {
          backgroundColor: "#fffbeb",
          borderColor: PRINT_STYLES.colors.accent,
          valueColor: PRINT_STYLES.colors.accent,
          labelColor: PRINT_STYLES.colors.accent,
        };
      default:
        return {
          backgroundColor: "#f9fafb",
          borderColor: "#d1d5db",
          valueColor: PRINT_STYLES.colors.text,
          labelColor: PRINT_STYLES.colors.textMuted,
        };
    }
  };

  const styles = getStyles();

  return (
    <div
      className="print-no-break"
      style={{
        backgroundColor: styles.backgroundColor,
        border: `2px solid ${styles.borderColor}`,
        borderRadius: "6px",
        padding: "12px 8px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "20px",
          fontWeight: "bold",
          color: styles.valueColor,
          fontFamily: PRINT_STYLES.fonts.display,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: "10px",
          fontWeight: "500",
          color: styles.labelColor,
          marginTop: "4px",
        }}
      >
        {label}
      </div>
      {sublabel && (
        <div
          style={{
            fontSize: "8px",
            color: PRINT_STYLES.colors.textMuted,
            marginTop: "2px",
          }}
        >
          {sublabel}
        </div>
      )}
    </div>
  );
};

export default PrintSummaryCard;
