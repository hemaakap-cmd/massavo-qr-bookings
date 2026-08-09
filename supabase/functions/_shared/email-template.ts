/**
 * MASSAVO Premium Email Template System
 * Ultra-clean, minimal, high-end design consistent across all emails.
 * Now with RTL support for Arabic.
 */

import type { EmailLang } from "./email-i18n.ts";
import { t, isRTL } from "./email-i18n.ts";

// Hosted on Supabase Storage CDN for reliable delivery across all email clients
const LOGO_URL = "https://lugzhjfguftlfcgjfnbj.supabase.co/storage/v1/object/public/email-assets/massavo-logo.png";
const BRAND_COLOR = "#7a4a2a";
const ACCENT_COLOR = "#c9782a";
const TEXT_COLOR = "#2d2926";
const TEXT_MUTED = "#6b6560";
const BG_WARM = "#faf8f5";
const BORDER_LIGHT = "#e8e4df";

export function emailLayout(content: string, footerExtra?: string, lang: EmailLang = "de"): string {
  const dir = isRTL(lang) ? "rtl" : "ltr";
  const align = isRTL(lang) ? "right" : "left";
  const htmlLang = lang === "ar" ? "ar" : lang === "en" ? "en" : "de";
  const fontFamily = lang === "ar" 
    ? "'Noto Kufi Arabic','Segoe UI',Tahoma,Arial,sans-serif"
    : "'Helvetica Neue',Helvetica,Arial,sans-serif";

  return `<!DOCTYPE html>
<html lang="${htmlLang}" dir="${dir}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Massavo</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f2efeb;font-family:${fontFamily};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;word-spacing:normal;direction:${dir};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2efeb;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04),0 0 1px rgba(0,0,0,0.08);">
        
        <!-- Logo Header -->
        <tr><td align="center" style="padding:36px 40px 24px;">
          <a href="https://massavo.com" target="_blank" style="text-decoration:none;">
            <img src="${LOGO_URL}" alt="Massavo" width="56" height="56" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;border-radius:50%;-ms-interpolation-mode:bicubic;">
          </a>
          <p style="margin:14px 0 0;font-size:13px;font-weight:600;letter-spacing:3px;color:${BRAND_COLOR};text-transform:uppercase;font-family:${fontFamily};">MASSAVO</p>
        </td></tr>
        
        <!-- Divider -->
        <tr><td style="padding:0 40px;"><div style="height:1px;background:${BORDER_LIGHT};"></div></td></tr>
        
        <!-- Content -->
        <tr><td style="padding:32px 40px 28px;color:${TEXT_COLOR};font-size:13px;line-height:1.7;text-align:${align};direction:${dir};font-family:${fontFamily};">
          ${content}
        </td></tr>
        
        <!-- Footer Divider -->
        <tr><td style="padding:0 40px;"><div style="height:1px;background:${BORDER_LIGHT};"></div></td></tr>
        
        <!-- Footer -->
        <tr><td style="padding:24px 40px 32px;text-align:center;">
          ${footerExtra || ""}
          <p style="margin:${footerExtra ? "12px" : "0"} 0 0;font-size:10px;color:#b5b0ab;line-height:1.6;letter-spacing:0.2px;font-family:${fontFamily};">
            &copy; ${new Date().getFullYear()} Massavo &middot; <a href="mailto:info@massavo.com" style="color:#b5b0ab;text-decoration:none;">info@massavo.com</a><br>
            ${t("auto_generated", lang)}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function emailHeading(text: string, lang: EmailLang = "de"): string {
  const align = isRTL(lang) ? "right" : "left";
  return `<h1 style="margin:0 0 18px;font-size:17px;font-weight:600;color:${TEXT_COLOR};letter-spacing:${isRTL(lang) ? '0' : '-0.3px'};line-height:1.3;text-align:${align};">${text}</h1>`;
}

export function emailSubheading(text: string, lang: EmailLang = "de"): string {
  const align = isRTL(lang) ? "right" : "left";
  return `<h2 style="margin:24px 0 10px;font-size:10px;font-weight:700;color:#a09a94;text-transform:uppercase;letter-spacing:${isRTL(lang) ? '0' : '1.2px'};text-align:${align};">${text}</h2>`;
}

export function emailGreeting(name: string, lang: EmailLang = "de"): string {
  const align = isRTL(lang) ? "right" : "left";
  const prefix = t("greeting_prefix", lang);
  return `<p style="margin:0 0 18px;font-size:13px;color:${TEXT_COLOR};line-height:1.6;text-align:${align};">${prefix} ${name},</p>`;
}

export function emailParagraph(text: string, lang: EmailLang = "de"): string {
  const align = isRTL(lang) ? "right" : "left";
  return `<p style="margin:0 0 14px;font-size:12px;color:${TEXT_MUTED};line-height:1.7;text-align:${align};">${text}</p>`;
}

export function emailDetailRow(label: string, value: string, lang: EmailLang = "de"): string {
  const labelAlign = isRTL(lang) ? "right" : "left";
  return `<tr>
    <td style="padding:5px 12px 5px 0;font-size:11px;color:${TEXT_MUTED};width:100px;vertical-align:top;white-space:nowrap;text-align:${labelAlign};">${label}</td>
    <td style="padding:5px 0;font-size:12px;color:${TEXT_COLOR};font-weight:500;text-align:${labelAlign};">${value}</td>
  </tr>`;
}

export function emailDetailTable(rows: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 18px;background:${BG_WARM};border-radius:10px;">
    <tr><td style="padding:14px 18px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
    </td></tr>
  </table>`;
}

export function emailButton(text: string, url: string, variant: "primary" | "secondary" | "danger" = "primary"): string {
  const styles = {
    primary: `background:${BRAND_COLOR};color:#ffffff;`,
    secondary: `background:#f2efeb;color:${BRAND_COLOR};`,
    danger: `background:#c53030;color:#ffffff;`,
  }[variant];
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px auto;">
    <tr><td align="center" style="border-radius:8px;${styles}">
      <a href="${url}" target="_blank" style="display:inline-block;padding:10px 32px;font-size:12px;font-weight:600;color:inherit;text-decoration:none;letter-spacing:0.4px;">${text}</a>
    </td></tr>
  </table>`;
}

export function emailNotice(text: string, variant: "info" | "success" | "warning" | "error" = "info", lang: EmailLang = "de"): string {
  const colors = {
    info: { bg: "#f5f3f0", border: BRAND_COLOR, text: TEXT_COLOR },
    success: { bg: "#f0faf0", border: "#22c55e", text: "#166534" },
    warning: { bg: "#fffbeb", border: "#e5a00d", text: "#7c5e00" },
    error: { bg: "#fef2f2", border: "#dc2626", text: "#991b1b" },
  }[variant];
  const borderSide = isRTL(lang) ? "border-right" : "border-left";
  const radius = isRTL(lang) ? "8px 0 0 8px" : "0 8px 8px 0";
  const align = isRTL(lang) ? "right" : "left";
  return `<div style="margin:16px 0;padding:11px 14px;background:${colors.bg};${borderSide}:2px solid ${colors.border};border-radius:${radius};text-align:${align};">
    <p style="margin:0;font-size:11px;color:${colors.text};line-height:1.6;">${text}</p>
  </div>`;
}

export function emailDivider(): string {
  return `<div style="height:1px;background:${BORDER_LIGHT};margin:22px 0;"></div>`;
}

export function emailSignature(lang: EmailLang = "de"): string {
  const align = isRTL(lang) ? "right" : "left";
  return `<p style="margin:22px 0 0;font-size:12px;color:${TEXT_MUTED};line-height:1.6;text-align:${align};">${t("signature_regards", lang)}<br><span style="font-weight:600;color:${BRAND_COLOR};">${t("signature_team", lang)}</span></p>`;
}

export function emailDataTable(headers: string[], rows: string[][]): string {
  const thStyle = `padding:7px 10px;font-size:9px;font-weight:700;color:#a09a94;text-transform:uppercase;letter-spacing:0.8px;border-bottom:2px solid ${BORDER_LIGHT};text-align:left;`;
  const tdStyle = `padding:6px 10px;font-size:11px;color:${TEXT_COLOR};border-bottom:1px solid ${BORDER_LIGHT};`;
  
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 18px;border-collapse:collapse;">
    <thead><tr>${headers.map(h => `<th style="${thStyle}">${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(row => `<tr>${row.map(cell => `<td style="${tdStyle}">${cell}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>`;
}

export function emailMetricCard(value: string, label: string): string {
  return `<div style="display:inline-block;padding:14px 18px;background:${BG_WARM};border-radius:10px;text-align:center;margin:4px;">
    <div style="font-size:18px;font-weight:700;color:${BRAND_COLOR};line-height:1;">${value}</div>
    <div style="font-size:9px;color:#a09a94;margin-top:5px;text-transform:uppercase;letter-spacing:0.8px;">${label}</div>
  </div>`;
}

export { BRAND_COLOR, ACCENT_COLOR, TEXT_COLOR, TEXT_MUTED, BG_WARM, BORDER_LIGHT, LOGO_URL };
