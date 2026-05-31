import massavoPrintLogo from "@/assets/massavo-print-logo.png";
import { COMPANY_INFO, PRINT_STYLES } from "@/constants/branding";
import { format } from "date-fns";

interface PrintDocumentLayoutProps {
  title: string;
  subtitle?: string;
  dateRange?: string;
  children: React.ReactNode;
  showSignatureArea?: boolean;
  confidentialityNote?: string;
}

/**
 * Professional print document layout with Massavo branding
 * 
 * Design principles:
 * - Two-color palette (Primary terracotta + Accent amber)
 * - Clean, minimalist design suitable for official documents
 * - Subtle watermark for brand protection
 * - Optimized for A4 printing on mobile and desktop
 * - GDPR-compliant confidentiality notices
 */
const PrintDocumentLayout = ({
  title,
  subtitle,
  dateRange,
  children,
  showSignatureArea = true,
  confidentialityNote = "This document contains confidential information. For authorized use only.",
}: PrintDocumentLayoutProps) => {
  return (
    <div 
      className="print-document bg-white text-black min-h-screen relative"
      style={{ 
        fontFamily: PRINT_STYLES.fonts.body,
        padding: "24px 28px",
        maxWidth: "210mm",
        margin: "0 auto",
      }}
    >
      {/* Subtle Centered Watermark */}
      <div 
        className="print-watermark"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 0,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: 0.03,
        }}
      >
        <img 
          src={massavoPrintLogo} 
          alt="" 
          style={{
            width: "280px",
            height: "280px",
            objectFit: "contain",
          }}
        />
        <span 
          style={{ 
            fontSize: "48px",
            fontWeight: "bold",
            letterSpacing: "0.25em",
            marginTop: "12px",
            fontFamily: PRINT_STYLES.fonts.display,
            color: "black",
          }}
        >
          {COMPANY_INFO.name}
        </span>
      </div>

      {/* Document Header */}
      <header 
        className="print-no-break"
        style={{ 
          paddingBottom: "16px",
          marginBottom: "20px",
          borderBottom: `3px solid ${PRINT_STYLES.colors.primary}`,
          position: "relative",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          {/* Left: Document Title */}
          <div style={{ flex: 1 }}>
            <h1 
              style={{ 
                fontSize: "22px",
                fontWeight: "bold",
                margin: 0,
                color: PRINT_STYLES.colors.primary,
                fontFamily: PRINT_STYLES.fonts.display,
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p style={{ 
                fontSize: "15px",
                margin: "4px 0 0 0",
                color: PRINT_STYLES.colors.text,
              }}>
                {subtitle}
              </p>
            )}
            {dateRange && (
              <p style={{ 
                fontSize: "11px",
                margin: "6px 0 0 0",
                color: PRINT_STYLES.colors.textMuted,
              }}>
                Period: {dateRange}
              </p>
            )}
            <p style={{ 
              fontSize: "10px",
              margin: "2px 0 0 0",
              color: PRINT_STYLES.colors.textMuted,
            }}>
              Generated: {format(new Date(), "dd MMM yyyy, HH:mm")}
            </p>
          </div>

          {/* Right: Company Logo & Name */}
          <div style={{ 
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}>
            <div style={{ textAlign: "right" }}>
              <span 
                style={{ 
                  fontSize: "18px",
                  fontWeight: "bold",
                  color: PRINT_STYLES.colors.primary,
                  fontFamily: PRINT_STYLES.fonts.display,
                  display: "block",
                }}
              >
                {COMPANY_INFO.name}
              </span>
              <span style={{ 
                fontSize: "9px",
                color: PRINT_STYLES.colors.textMuted,
                display: "block",
              }}>
                {COMPANY_INFO.tagline}
              </span>
            </div>
            <img 
              src={massavoPrintLogo} 
              alt={COMPANY_INFO.name}
              style={{
                width: "52px",
                height: "52px",
                objectFit: "contain",
              }}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ position: "relative", zIndex: 10, marginBottom: "24px" }}>
        {children}
      </main>

      {/* Signature/Stamp Area */}
      {showSignatureArea && (
        <div 
          className="print-no-break"
          style={{
            marginTop: "32px",
            marginBottom: "24px",
            paddingTop: "16px",
            borderTop: `2px solid ${PRINT_STYLES.colors.accent}`,
            position: "relative",
            zIndex: 10,
          }}
        >
          <h3 
            style={{ 
              fontSize: "13px",
              fontWeight: "bold",
              marginBottom: "16px",
              color: PRINT_STYLES.colors.primary,
              fontFamily: PRINT_STYLES.fonts.display,
            }}
          >
            Official Verification
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>
            {/* Stamp Area */}
            <div>
              <div 
                style={{
                  height: "80px",
                  border: "2px dashed #d1d5db",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: "10px", color: PRINT_STYLES.colors.textMuted }}>
                  Company Stamp / Firmenstempel
                </span>
              </div>
            </div>
            
            {/* Signature Area */}
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div 
                style={{
                  borderBottom: `1px solid ${PRINT_STYLES.colors.text}`,
                  marginBottom: "6px",
                  height: "60px",
                }}
              />
              <p style={{ fontSize: "10px", color: PRINT_STYLES.colors.textMuted, margin: 0 }}>
                Authorized Signature / Unterschrift
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
                <div>
                  <div style={{ 
                    borderBottom: `1px solid ${PRINT_STYLES.colors.textMuted}`,
                    width: "80px",
                    marginBottom: "4px",
                  }} />
                  <p style={{ fontSize: "9px", color: PRINT_STYLES.colors.textMuted, margin: 0 }}>
                    Date / Datum
                  </p>
                </div>
                <div>
                  <div style={{ 
                    borderBottom: `1px solid ${PRINT_STYLES.colors.textMuted}`,
                    width: "100px",
                    marginBottom: "4px",
                  }} />
                  <p style={{ fontSize: "9px", color: PRINT_STYLES.colors.textMuted, margin: 0 }}>
                    Name (Print)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer with Contact Details */}
      <footer 
        className="print-no-break"
        style={{ 
          marginTop: "auto",
          paddingTop: "12px",
          borderTop: `1px solid ${PRINT_STYLES.colors.accent}`,
          position: "relative",
          zIndex: 10,
        }}
      >
        <div style={{ 
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          fontSize: "9px",
          color: PRINT_STYLES.colors.textMuted,
        }}>
          {/* Left: Logo & Services */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <img 
              src={massavoPrintLogo} 
              alt={COMPANY_INFO.name}
              style={{
                width: "32px",
                height: "32px",
                objectFit: "contain",
                opacity: 0.7,
              }}
            />
            <div>
              <p style={{ 
                fontWeight: "bold",
                fontSize: "11px",
                color: PRINT_STYLES.colors.primary,
                fontFamily: PRINT_STYLES.fonts.display,
                margin: 0,
              }}>
                {COMPANY_INFO.name}
              </p>
              <p style={{ margin: "2px 0 0 0" }}>{COMPANY_INFO.services}</p>
            </div>
          </div>

          {/* Center: Contact */}
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: 0 }}>{COMPANY_INFO.email}</p>
            <p style={{ margin: "2px 0 0 0" }}>{COMPANY_INFO.address}</p>
          </div>

          {/* Right: Web */}
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0 }}>{COMPANY_INFO.website}</p>
            <p style={{ margin: "2px 0 0 0" }}>IG: {COMPANY_INFO.social.instagram}</p>
          </div>
        </div>

        {/* Confidentiality Notice */}
        <div style={{ 
          marginTop: "10px",
          paddingTop: "8px",
          borderTop: "1px solid #e5e5e5",
          textAlign: "center",
        }}>
          <p style={{ 
            fontSize: "8px",
            fontStyle: "italic",
            color: PRINT_STYLES.colors.textMuted,
            margin: 0,
          }}>
            {confidentialityNote}
          </p>
          <p style={{ 
            fontSize: "8px",
            color: "#9ca3af",
            margin: "3px 0 0 0",
          }}>
            © {new Date().getFullYear()} {COMPANY_INFO.name}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PrintDocumentLayout;
