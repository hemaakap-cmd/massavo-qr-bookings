import { PRINT_STYLES } from "@/constants/branding";

interface ReportNoticeProps {
  type?: "privacy" | "info" | "warning";
  title: string;
  message: string;
}

/**
 * Styled notice/callout block for enterprise reports.
 */
const ReportNotice = ({ type = "info", title, message }: ReportNoticeProps) => {
  const colors = {
    privacy: { border: PRINT_STYLES.colors.primary, bg: PRINT_STYLES.colors.background },
    info: { border: PRINT_STYLES.colors.accent, bg: "#fffbeb" },
    warning: { border: "#dc2626", bg: "#fef2f2" },
  }[type];

  return (
    <div
      className="print-no-break"
      style={{
        marginBottom: "10px",
        padding: "5px 8px",
        backgroundColor: colors.bg,
        borderLeft: `2px solid ${colors.border}`,
        borderRadius: "0 3px 3px 0",
        fontSize: "6.5px",
      }}
    >
      <strong style={{ color: colors.border }}>{title}:</strong>{" "}
      <span style={{ color: PRINT_STYLES.colors.textMuted }}>{message}</span>
    </div>
  );
};

export default ReportNotice;
