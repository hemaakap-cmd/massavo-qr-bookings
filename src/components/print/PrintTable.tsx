import { PRINT_STYLES } from "@/constants/branding";
import React from "react";

interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  width?: string;
  render?: (item: T, index: number) => React.ReactNode;
}

interface PrintTableProps<T> {
  data: T[];
  columns: Column<T>[];
  emptyMessage?: string;
  showRowNumbers?: boolean;
  footer?: {
    label: string;
    values: { key: string; value: React.ReactNode }[];
  };
}

/**
 * Optimized print table component
 * 
 * Features:
 * - Two-color design (primary + accent)
 * - Optimal font size for A4 printing
 * - Alternating row colors for readability
 * - Intelligent column widths
 * - Page break aware
 */
function PrintTable<T extends { id?: string }>({ 
  data, 
  columns, 
  emptyMessage = "No data available.",
  showRowNumbers = false,
  footer,
}: PrintTableProps<T>) {
  return (
    <table 
      className="print-table"
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: "10px",
        fontFamily: PRINT_STYLES.fonts.body,
      }}
    >
      <thead>
        <tr style={{ backgroundColor: PRINT_STYLES.colors.background }}>
          {showRowNumbers && (
            <th 
              style={{
                textAlign: "center",
                padding: "8px 6px",
                fontWeight: "bold",
                color: PRINT_STYLES.colors.primary,
                borderBottom: `2px solid ${PRINT_STYLES.colors.accent}`,
                width: "30px",
              }}
            >
              #
            </th>
          )}
          {columns.map((col) => (
            <th 
              key={col.key}
              style={{
                textAlign: col.align || "left",
                padding: "8px 6px",
                fontWeight: "bold",
                color: PRINT_STYLES.colors.primary,
                borderBottom: `2px solid ${PRINT_STYLES.colors.accent}`,
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
              style={{
                padding: "32px 8px",
                textAlign: "center",
                color: PRINT_STYLES.colors.textMuted,
                fontStyle: "italic",
              }}
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
                backgroundColor: index % 2 === 0 ? PRINT_STYLES.colors.background : "white",
              }}
            >
              {showRowNumbers && (
                <td 
                  style={{
                    padding: "6px",
                    textAlign: "center",
                    color: PRINT_STYLES.colors.textMuted,
                    fontSize: "9px",
                  }}
                >
                  {index + 1}
                </td>
              )}
              {columns.map((col) => (
                <td 
                  key={col.key}
                  style={{
                    padding: "6px",
                    textAlign: col.align || "left",
                    color: PRINT_STYLES.colors.text,
                    borderBottom: "1px solid #e5e5e5",
                  }}
                >
                  {col.render 
                    ? col.render(item, index) 
                    : String((item as Record<string, unknown>)[col.key] ?? "-")
                  }
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
      {footer && data.length > 0 && (
        <tfoot>
          <tr 
            style={{ 
              backgroundColor: PRINT_STYLES.colors.background,
              fontWeight: "bold",
            }}
          >
            <td 
              colSpan={columns.length - footer.values.length + (showRowNumbers ? 1 : 0)}
              style={{
                padding: "8px 6px",
                color: PRINT_STYLES.colors.primary,
                fontFamily: PRINT_STYLES.fonts.display,
              }}
            >
              {footer.label}
            </td>
            {footer.values.map((val) => (
              <td 
                key={val.key}
                style={{
                  padding: "8px 6px",
                  textAlign: "right",
                  color: PRINT_STYLES.colors.accent,
                  fontWeight: "bold",
                }}
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

export default PrintTable;
