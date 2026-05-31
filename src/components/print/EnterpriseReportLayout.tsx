import React from "react";
import { format } from "date-fns";
import massavoPrintLogo from "@/assets/massavo-print-logo.png";
import { COMPANY_INFO, PRINT_STYLES } from "@/constants/branding";
import {
  detectReportCategory,
  getReportStyle,
  REPORT_TYPOGRAPHY,
  REPORT_LAYOUT,
  CONFIDENTIALITY_NOTICES,
  type ReportCategory,
} from "@/constants/reportStyles";

interface EnterpriseReportLayoutProps {
  title: string;
  subtitle?: string;
  dateRange?: string;
  reportType?: string;
  category?: ReportCategory;
  documentId?: string;
  children: React.ReactNode;
  showSignatureArea?: boolean;
  hasFinancialData?: boolean;
}

const EnterpriseReportLayout = ({
  title,
  subtitle,
  dateRange,
  reportType,
  category: forcedCategory,
  documentId,
  children,
  showSignatureArea,
  hasFinancialData,
}: EnterpriseReportLayoutProps) => {
  const category = forcedCategory ?? detectReportCategory(reportType, title, hasFinancialData);
  const style = getReportStyle(category);
  const showSig = showSignatureArea ?? style.showSignature;
  const confidentialityNote = CONFIDENTIALITY_NOTICES[style.confidentialityLevel];
  const docId = documentId || `MAS-${format(new Date(), "yyyyMMdd-HHmm")}`;

  return (
    <div
      className="print-document bg-white text-black relative"
      style={{
        fontFamily: PRINT_STYLES.fonts.body,
        padding: "16px 18px 12px",
        maxWidth: REPORT_LAYOUT.page.width,
        minHeight: REPORT_LAYOUT.page.minHeight,
        margin: "0 auto",
        fontSize: "7px",
      }}
    >
      {/* ─── HEADER ─────────────────────────────────────────── */}
      <header
        className="print-no-break"
        style={{ marginBottom: "10px", position: "relative", zIndex: 10 }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "6px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <img
              src={massavoPrintLogo}
              alt={COMPANY_INFO.name}
              style={{ width: "24px", height: "24px", objectFit: "contain" }}
            />
            <div>
              <span
                style={{
                  fontFamily: PRINT_STYLES.fonts.display,
                  fontSize: "10px",
                  fontWeight: "700",
                  color: PRINT_STYLES.colors.primary,
                  letterSpacing: "0.05em",
                  display: "block",
                  lineHeight: "1.1",
                }}
              >
                {COMPANY_INFO.name}
              </span>
              <span
                style={{
                  fontSize: "5.5px",
                  color: PRINT_STYLES.colors.textMuted,
                  letterSpacing: "0.03em",
                  textTransform: "uppercase",
                }}
              >
                {COMPANY_INFO.services}
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "6px", color: PRINT_STYLES.colors.textMuted, display: "block" }}>
              {format(new Date(), "dd MMM yyyy · HH:mm")}
            </span>
            <span
              style={{
                fontSize: "5.5px",
                color: "#9ca3af",
                fontFamily: "monospace",
                display: "block",
                marginTop: "1px",
              }}
            >
              {docId}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            height: "1px",
            background: `linear-gradient(to right, ${PRINT_STYLES.colors.primary}, ${PRINT_STYLES.colors.accent}, transparent)`,
            marginBottom: "8px",
          }}
        />

        {/* Title block */}
        <div>
          <h1
            style={{
              fontFamily: PRINT_STYLES.fonts.display,
              fontSize: "11px",
              fontWeight: "700",
              color: PRINT_STYLES.colors.primary,
              margin: 0,
              lineHeight: "1.2",
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                fontSize: "7.5px",
                color: PRINT_STYLES.colors.text,
                margin: "1px 0 0",
                fontWeight: "500",
              }}
            >
              {subtitle}
            </p>
          )}
          {dateRange && (
            <p
              style={{
                fontSize: "6px",
                color: PRINT_STYLES.colors.textMuted,
                margin: "2px 0 0",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Period: {dateRange}
            </p>
          )}
        </div>

        {/* Category tag */}
        <div
          style={{
            display: "inline-block",
            marginTop: "4px",
            padding: "1px 5px",
            borderRadius: "2px",
            backgroundColor: category === "financial" ? "#fef3c7" : "#f1f5f9",
            border: `1px solid ${category === "financial" ? "#fbbf24" : "#cbd5e1"}`,
          }}
        >
          <span
            style={{
              fontSize: "5px",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: category === "financial" ? "#92400e" : "#475569",
            }}
          >
            {category === "financial" ? "Financial Report" : "Administrative Report"}
          </span>
        </div>
      </header>

      {/* ─── MAIN CONTENT ───────────────────────────────────── */}
      <main style={{ position: "relative", zIndex: 10, marginBottom: "10px" }}>
        {children}
      </main>

      {/* ─── SIGNATURE / STAMP AREA ────────────────────────── */}
      {showSig && (
        <div
          className="print-no-break"
          style={{
            marginTop: "12px",
            marginBottom: "10px",
            paddingTop: "8px",
            borderTop: `1px solid #e8e5e0`,
            position: "relative",
            zIndex: 10,
          }}
        >
          <h3
            style={{
              fontFamily: PRINT_STYLES.fonts.display,
              fontSize: "7px",
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: PRINT_STYLES.colors.primary,
              marginBottom: "8px",
            }}
          >
            Verification
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <div
                style={{
                  height: "40px",
                  border: "1px dashed #d1d5db",
                  borderRadius: "3px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: "6px", color: "#9ca3af" }}>
                  Company Stamp / Firmenstempel
                </span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div style={{ borderBottom: `1px solid ${PRINT_STYLES.colors.textMuted}`, marginBottom: "2px", height: "28px" }} />
              <p style={{ fontSize: "6px", color: "#9ca3af", margin: 0 }}>Authorized Signature</p>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                <div>
                  <div style={{ borderBottom: "1px solid #d1d5db", width: "50px", marginBottom: "2px" }} />
                  <p style={{ fontSize: "5px", color: "#9ca3af", margin: 0 }}>Date</p>
                </div>
                <div>
                  <div style={{ borderBottom: "1px solid #d1d5db", width: "65px", marginBottom: "2px" }} />
                  <p style={{ fontSize: "5px", color: "#9ca3af", margin: 0 }}>Name (Print)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── PAYMENT TERMS ─────────────────────────────────── */}
      {style.showPaymentTerms && (
        <div
          className="print-no-break"
          style={{
            padding: "4px 8px",
            backgroundColor: "#faf9f7",
            borderLeft: `2px solid ${PRINT_STYLES.colors.accent}`,
            borderRadius: "0 2px 2px 0",
            marginBottom: "10px",
            position: "relative",
            zIndex: 10,
          }}
        >
          <p style={{ fontSize: "6px", color: PRINT_STYLES.colors.text, margin: 0, fontWeight: "600" }}>
            Payment Terms
          </p>
          <p style={{ fontSize: "5.5px", color: PRINT_STYLES.colors.textMuted, margin: "1px 0 0", lineHeight: "1.4" }}>
            All amounts in EUR (€). Commission payments due within 30 days of statement date unless otherwise agreed.
          </p>
        </div>
      )}

      {/* ─── FOOTER ─────────────────────────────────────────── */}
      <footer
        className="print-no-break"
        style={{
          marginTop: "auto",
          paddingTop: "4px",
          borderTop: `1px solid ${PRINT_STYLES.colors.primary}`,
          position: "relative",
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "5.5px",
            color: PRINT_STYLES.colors.textMuted,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
            <img src={massavoPrintLogo} alt="" style={{ width: "10px", height: "10px", objectFit: "contain", opacity: 0.5 }} />
            <span style={{ fontWeight: "600", color: PRINT_STYLES.colors.primary, fontFamily: PRINT_STYLES.fonts.display, fontSize: "6px" }}>
              {COMPANY_INFO.name}
            </span>
          </div>
          <span>{COMPANY_INFO.email} · {COMPANY_INFO.address}</span>
          <span>{COMPANY_INFO.website}</span>
        </div>
        <div style={{ marginTop: "3px", paddingTop: "2px", borderTop: "1px solid #eeeeee", textAlign: "center" }}>
          <p style={{ fontSize: "4.5px", fontStyle: "italic", color: "#9ca3af", margin: 0, lineHeight: "1.4" }}>
            {confidentialityNote}
          </p>
          <p style={{ fontSize: "4.5px", color: "#9ca3af", margin: "1px 0 0" }}>
            © {new Date().getFullYear()} {COMPANY_INFO.name}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default EnterpriseReportLayout;
