import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import type { AnonymizedBooking } from "@/types/financial";
import { format } from "date-fns";

interface GymFinancialExportProps {
  bookings: AnonymizedBooking[];
  gymName: string;
  commissionPercentage: number;
  totalCommission: number;
  sessionCount: number;
  dateRange: string;
  onPrint: () => void;
}

/**
 * Gym-specific export functionality
 * Exports ONLY commission data - NO company revenue, profits, or other gym data
 */
const GymFinancialExport = ({ 
  bookings, 
  gymName, 
  commissionPercentage,
  totalCommission,
  sessionCount,
  dateRange,
  onPrint 
}: GymFinancialExportProps) => {
  
  const exportToCSV = () => {
    // Headers for gym-specific report - NO revenue or profit columns
    const headers = ["Client ID", "Session Date", "Time", "Massage Type", "Session Price (€)", "Commission %", "Commission (€)"];
    const rows = bookings.map((b) => [
      b.masked_customer,
      format(new Date(b.booking_date), "yyyy-MM-dd"),
      b.booking_time,
      b.service_name,
      b.session_price.toFixed(2),
      commissionPercentage,
      b.commission_amount.toFixed(2),
    ]);

    // Summary rows - ONLY commission data
    rows.push([]);
    rows.push(["COMMISSION SUMMARY", "", "", "", "", "", ""]);
    rows.push(["Gym", gymName, "", "", "", "", ""]);
    rows.push(["Commission Rate", `${commissionPercentage}%`, "", "", "", "", ""]);
    rows.push(["Total Commission Owed", "", "", "", "", "", totalCommission.toFixed(2)]);
    rows.push(["Eligible Sessions", String(sessionCount), "", "", "", "", ""]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `commission-statement-${gymName.replace(/\s+/g, "-")}-${dateRange}.csv`;
    link.click();
  };

  const exportToExcel = () => {
    const headers = ["Client ID", "Session Date", "Time", "Massage Type", "Session Price (€)", "Commission %", "Commission (€)"];
    const rows = bookings.map((b) => [
      b.masked_customer,
      format(new Date(b.booking_date), "yyyy-MM-dd"),
      b.booking_time,
      b.service_name,
      b.session_price.toFixed(2),
      commissionPercentage,
      b.commission_amount.toFixed(2),
    ]);

    rows.push([]);
    rows.push(["COMMISSION SUMMARY", "", "", "", "", "", ""]);
    rows.push(["Gym", gymName, "", "", "", "", ""]);
    rows.push(["Commission Rate", `${commissionPercentage}%`, "", "", "", "", ""]);
    rows.push(["Total Commission Owed", "", "", "", "", "", totalCommission.toFixed(2)]);
    rows.push(["Eligible Sessions", String(sessionCount), "", "", "", "", ""]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join("\t"))
      .join("\n");

    const blob = new Blob([csvContent], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `commission-statement-${gymName.replace(/\s+/g, "-")}-${dateRange}.xls`;
    link.click();
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={onPrint}>
        <Printer className="w-4 h-4 mr-2" />
        Print Statement
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

export default GymFinancialExport;
