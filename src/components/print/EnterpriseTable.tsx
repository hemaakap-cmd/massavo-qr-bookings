import React from "react";
import { PRINT_STYLES } from "@/constants/branding";
import { REPORT_LAYOUT } from "@/constants/reportStyles";

interface EnterpriseTableProps<T> {
  data: T[];
  columns: {
    key: string;
    header: string;
    align?: "left" | "center" | "right";
    width?: string;
    render?: (item: T, index: number) => React.ReactNode;
    isNumeric?: boolean;
    isHighlight?: boolean;
  }[];
  emptyMessage?: string;
  showRowNumbers?: boolean;
  footer?: {
    label: string;
    values: { key: string; value: React.ReactNode }[];
  };
  variant?: "striped" | "bordered";
  caption?: string;
}

function EnterpriseTable<T extends { id?: string }>({
  data,
  columns,
  emptyMessage = "No data available.",
  showRowNumbers = false,
  footer,
  variant = "striped",
  caption,
}: EnterpriseTableProps<T>) {
  return (
    <table
      className="print-table"
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: "6.5px",
        fontFamily: PRINT_STYLES.fonts.body,
        color: PRINT_STYLES.colors.text,
      }}
    >
      {caption && (
        <caption
          style={{
            textAlign: "left",
            fontSize: "5.5px",
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: PRINT_STYLES.colors.textMuted,
            marginBottom: "3px",
            captionSide: "top",
          }}
        >
          {caption}
        </caption>
      )}
      <thead>
        <tr style={{ borderBottom: `1px solid ${PRINT_STYLES.colors.primary}` }}>
          {showRowNumbers && (
            <th style={{ fontSize: "5.5px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em", color: PRINT_STYLES.colors.textMuted, textAlign: "center", padding: "3px 4px", width: "18px" }}>
              #
            </th>
          )}
          {columns.map((col) => (
            <th
              key={col.key}
              style={{
                fontSize: "5.5px",
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: PRINT_STYLES.colors.textMuted,
                textAlign: col.align || (col.isNumeric ? "right" : "left"),
                padding: "3px 4px",
                width: col.width,
              }}
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.length === 0 ? (
          <tr>
            <td
              colSpan={columns.length + (showRowNumbers ? 1 : 0)}
              style={{ padding: "10px 4px", textAlign: "center", color: PRINT_STYLES.colors.textMuted, fontStyle: "italic", fontSize: "6px" }}
            >
              {emptyMessage}
            </td>
          </tr>
        ) : (
          data.map((item, index) => (
            <tr
              key={item.id || index}
              className="print-no-break"
              style={{
                backgroundColor: index % 2 === 0 ? "#fafaf9" : "white",
                borderBottom: "1px solid #f0eeeb",
              }}
            >
              {showRowNumbers && (
                <td style={{ padding: "3px 4px", textAlign: "center", color: "#9ca3af", fontSize: "5.5px" }}>
                  {index + 1}
                </td>
              )}
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    padding: "3px 4px",
                    textAlign: col.align || (col.isNumeric ? "right" : "left"),
                    color: col.isHighlight ? PRINT_STYLES.colors.accent : PRINT_STYLES.colors.text,
                    fontWeight: col.isHighlight ? "600" : "400",
                    fontVariantNumeric: col.isNumeric ? "tabular-nums" : "normal",
                  }}
                >
                  {col.render
                    ? col.render(item, index)
                    : String((item as Record<string, unknown>)[col.key] ?? "-")}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
      {footer && data.length > 0 && (
        <tfoot>
          <tr style={{ borderTop: `1px solid ${PRINT_STYLES.colors.primary}`, backgroundColor: "#faf9f7" }}>
            <td
              colSpan={columns.length - footer.values.length + (showRowNumbers ? 1 : 0)}
              style={{ padding: "3px 4px", fontWeight: "700", fontSize: "6.5px", color: PRINT_STYLES.colors.primary, letterSpacing: "0.03em" }}
            >
              {footer.label}
            </td>
            {footer.values.map((val) => (
              <td
                key={val.key}
                style={{ padding: "3px 4px", textAlign: "right", fontWeight: "700", fontSize: "6.5px", color: PRINT_STYLES.colors.primary, fontVariantNumeric: "tabular-nums" }}
              >
                {val.value}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
}

export default EnterpriseTable;
