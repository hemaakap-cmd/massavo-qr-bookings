import React from "react";
import { PRINT_STYLES } from "@/constants/branding";
import { REPORT_LAYOUT } from "@/constants/reportStyles";

interface ReportSectionProps {
  title: string;
  children: React.ReactNode;
  variant?: "default" | "highlight";
}

const ReportSection = ({ title, children, variant = "default" }: ReportSectionProps) => (
  <div className="print-no-break" style={{ marginBottom: "10px" }}>
    <h2
      style={{
        fontFamily: PRINT_STYLES.fonts.display,
        fontSize: "7.5px",
        fontWeight: "700",
        color: PRINT_STYLES.colors.primary,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        marginBottom: "4px",
        paddingBottom: "2px",
        borderBottom: variant === "highlight"
          ? `1px solid ${PRINT_STYLES.colors.accent}`
          : "1px solid #e8e5e0",
      }}
    >
      {title}
    </h2>
    {children}
  </div>
);

export default ReportSection;
