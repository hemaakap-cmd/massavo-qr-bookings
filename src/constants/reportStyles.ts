/**
 * Global Report Styling System
 * 
 * Automatically detects report type and applies enterprise-grade
 * layout patterns for financial and administrative output.
 * 
 * Report Categories:
 * - Financial: revenue, payouts, KPIs, commission statements
 * - Administrative: booking logs, attendance, cancellations, schedules
 */

import { COMPANY_INFO, PRINT_STYLES } from "./branding";

// ─── Report Type Detection ─────────────────────────────────────
export type ReportCategory = "financial" | "administrative";

export interface ReportStyleConfig {
  category: ReportCategory;
  accentColor: string;
  headerGradient: [string, string];
  summaryCardStyle: "metric" | "badge";
  tableStyle: "striped" | "bordered";
  showSignature: boolean;
  showPaymentTerms: boolean;
  confidentialityLevel: "standard" | "financial";
  sectionDivider: "line" | "gradient";
}

const FINANCIAL_STYLE: ReportStyleConfig = {
  category: "financial",
  accentColor: PRINT_STYLES.colors.accent,
  headerGradient: [PRINT_STYLES.colors.primary, "#5c3520"],
  summaryCardStyle: "metric",
  tableStyle: "bordered",
  showSignature: true,
  showPaymentTerms: true,
  confidentialityLevel: "financial",
  sectionDivider: "gradient",
};

const ADMINISTRATIVE_STYLE: ReportStyleConfig = {
  category: "administrative",
  accentColor: PRINT_STYLES.colors.primary,
  headerGradient: [PRINT_STYLES.colors.primary, PRINT_STYLES.colors.accent],
  summaryCardStyle: "badge",
  tableStyle: "striped",
  showSignature: false,
  showPaymentTerms: false,
  confidentialityLevel: "standard",
  sectionDivider: "line",
};

// Keywords that classify report as financial
const FINANCIAL_KEYWORDS = [
  "financial", "commission", "revenue", "payout", "invoice",
  "balance", "payment", "profit", "net", "gross", "kpi",
  "gym_commission", "admin_overview",
];

// Keywords that classify report as administrative
const ADMIN_KEYWORDS = [
  "booking", "schedule", "attendance", "cancellation", "therapist",
  "assignment", "daily", "weekly", "session", "log",
  "therapist_summary", "daily_booking", "weekly_booking", "monthly_booking",
];

/**
 * Auto-detect report category from report type, title, or data shape
 */
export function detectReportCategory(
  reportType?: string,
  title?: string,
  hasFinancialData?: boolean
): ReportCategory {
  const searchText = `${reportType || ""} ${title || ""}`.toLowerCase();

  // Check financial keywords first (higher priority)
  if (FINANCIAL_KEYWORDS.some((kw) => searchText.includes(kw))) return "financial";
  if (hasFinancialData) return "financial";
  if (ADMIN_KEYWORDS.some((kw) => searchText.includes(kw))) return "administrative";

  // Default based on data shape
  return hasFinancialData ? "financial" : "administrative";
}

/**
 * Get the full style config for a report
 */
export function getReportStyle(category: ReportCategory): ReportStyleConfig {
  return category === "financial" ? FINANCIAL_STYLE : ADMINISTRATIVE_STYLE;
}

// ─── Typography System ─────────────────────────────────────────
export const REPORT_TYPOGRAPHY = {
  documentTitle: {
    fontFamily: PRINT_STYLES.fonts.display,
    fontSize: "20px",
    fontWeight: "700" as const,
    letterSpacing: "0.02em",
    color: "#ffffff",
  },
  documentSubtitle: {
    fontFamily: PRINT_STYLES.fonts.body,
    fontSize: "12px",
    fontWeight: "400" as const,
    color: "rgba(255,255,255,0.85)",
  },
  sectionHeading: {
    fontFamily: PRINT_STYLES.fonts.display,
    fontSize: "13px",
    fontWeight: "700" as const,
    color: PRINT_STYLES.colors.primary,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    marginBottom: "10px",
    paddingBottom: "6px",
  },
  tableHeader: {
    fontFamily: PRINT_STYLES.fonts.body,
    fontSize: "9px",
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    color: PRINT_STYLES.colors.primary,
  },
  tableCell: {
    fontFamily: PRINT_STYLES.fonts.body,
    fontSize: "9.5px",
    fontWeight: "400" as const,
    color: PRINT_STYLES.colors.text,
  },
  metricValue: {
    fontFamily: PRINT_STYLES.fonts.display,
    fontSize: "22px",
    fontWeight: "700" as const,
  },
  metricLabel: {
    fontFamily: PRINT_STYLES.fonts.body,
    fontSize: "9px",
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  },
  footerText: {
    fontFamily: PRINT_STYLES.fonts.body,
    fontSize: "8px",
    fontWeight: "400" as const,
    color: PRINT_STYLES.colors.textMuted,
  },
  pageNumber: {
    fontFamily: PRINT_STYLES.fonts.body,
    fontSize: "8px",
    fontWeight: "500" as const,
    color: PRINT_STYLES.colors.textMuted,
  },
} as const;

// ─── Layout Constants ──────────────────────────────────────────
export const REPORT_LAYOUT = {
  page: {
    width: "210mm",
    minHeight: "297mm",
    paddingX: "24px",
    paddingY: "20px",
  },
  header: {
    height: "72px",
    borderRadius: "6px",
    padding: "16px 20px",
  },
  margins: {
    sectionGap: "20px",
    tableToSection: "16px",
    cardGap: "10px",
  },
  table: {
    headerPadding: "8px 10px",
    cellPadding: "7px 10px",
    borderColor: "#e8e5e0",
    alternateRowBg: "#faf9f7",
    headerBg: PRINT_STYLES.colors.background,
  },
} as const;

// ─── Confidentiality Notices ───────────────────────────────────
export const CONFIDENTIALITY_NOTICES = {
  standard:
    "This document contains confidential information intended solely for the authorized recipient. Unauthorized distribution is prohibited.",
  financial:
    "CONFIDENTIAL – This document contains sensitive financial data protected under GDPR. Unauthorized access, distribution, or reproduction is strictly prohibited. For authorized personnel only.",
} as const;

// ─── Document Metadata ────────────────────────────────────────
export const REPORT_METADATA = {
  company: COMPANY_INFO,
  generatedLabel: "Report Generated",
  periodLabel: "Reporting Period",
  pageLabel: "Page",
  preparedByLabel: "Prepared by",
  documentIdLabel: "Document ID",
} as const;
