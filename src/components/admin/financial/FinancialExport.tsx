import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import type { AnonymizedBooking, FinancialSummary } from "@/types/financial";
import { format } from "date-fns";

interface FinancialExportProps {
  bookings: AnonymizedBooking[];
  summary: FinancialSummary;
  gymName: string;
  dateRange: string;
  onPrint: () => void;
}

const FinancialExport = ({ bookings, summary, gymName, dateRange, onPrint }: FinancialExportProps) => {
  const exportToCSV = () => {
    const headers = ["Client ID", "Date", "Time", "Gym", "Service", "Price (€)", "Commission %", "Commission (€)"];
    const rows = bookings.map((b) => [
      b.masked_customer,
      format(new Date(b.booking_date), "yyyy-MM-dd"),
      b.booking_time,
      b.gym_name,
      b.service_name,
      b.session_price.toFixed(2),
      b.commission_percentage,
      b.commission_amount.toFixed(2),
    ]);

    // Add summary rows
    rows.push([]);
    rows.push(["SUMMARY", "", "", "", "", "", "", ""]);
    rows.push(["Total Revenue", "", "", "", "", summary.total_revenue.toFixed(2), "", ""]);
    rows.push(["Total Commission", "", "", "", "", "", "", summary.total_commission.toFixed(2)]);
    rows.push(["Net Revenue", "", "", "", "", summary.total_net.toFixed(2), "", ""]);
    rows.push(["Total Sessions", "", "", "", String(summary.booking_count), "", "", ""]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `financial-report-${gymName.replace(/\s+/g, "-")}-${dateRange}.csv`;
    link.click();
  };

  const exportToExcel = () => {
    // For Excel, we'll use CSV with .xls extension (basic compatibility)
    const headers = ["Client ID", "Date", "Time", "Gym", "Service", "Price (€)", "Commission %", "Commission (€)"];
    const rows = bookings.map((b) => [
      b.masked_customer,
      format(new Date(b.booking_date), "yyyy-MM-dd"),
      b.booking_time,
      b.gym_name,
      b.service_name,
      b.session_price.toFixed(2),
      b.commission_percentage,
      b.commission_amount.toFixed(2),
    ]);

    rows.push([]);
    rows.push(["SUMMARY", "", "", "", "", "", "", ""]);
    rows.push(["Total Revenue", "", "", "", "", summary.total_revenue.toFixed(2), "", ""]);
    rows.push(["Total Commission", "", "", "", "", "", "", summary.total_commission.toFixed(2)]);
    rows.push(["Net Revenue", "", "", "", "", summary.total_net.toFixed(2), "", ""]);
    rows.push(["Total Sessions", "", "", "", String(summary.booking_count), "", "", ""]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join("\t"))
      .join("\n");

    const blob = new Blob([csvContent], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `financial-report-${gymName.replace(/\s+/g, "-")}-${dateRange}.xls`;
    link.click();
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={onPrint}>
        <Printer className="w-4 h-4 mr-2" />
        Print
      </Button>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={exportToCSV}>
            <FileText className="w-4 h-4 mr-2" />
            Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportToExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export as Excel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default FinancialExport;
