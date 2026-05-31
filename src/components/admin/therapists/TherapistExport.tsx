import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, Table, Printer } from "lucide-react";
import { Therapist, professionLabels } from "@/types/therapist";

/**
 * Sanitize text content to prevent XSS when building HTML strings
 * Uses DOMPurify with text-only mode to escape any HTML/script content
 */
const sanitizeText = (text: string | null | undefined): string => {
  if (!text) return "";
  // Create a text node and extract its content to safely escape HTML
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
};

interface TherapistExportProps {
  therapists: Therapist[];
}

export function TherapistExport({ therapists }: TherapistExportProps) {
  const exportToCSV = () => {
    const headers = [
      "Name",
      "Profession",
      "Phone",
      "Email",
      "City",
      "Address",
      "Gym",
      "Specialty",
      "Education",
      "Rating",
      "Status",
    ];

    const rows = therapists.map((t) => [
      t.name,
      professionLabels[t.profession] || t.profession,
      t.phone || "",
      t.email || "",
      t.cities?.name || "",
      t.address || "",
      t.gyms?.name || "",
      t.specialty || "",
      t.education || "",
      t.rating.toString(),
      t.is_available ? "Available" : "Unavailable",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `therapists_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const exportToPDF = () => {
    // Create a printable HTML content
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>MASSAVO Therapists Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #6B8E6B; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #6B8E6B; color: white; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .status-available { color: green; font-weight: bold; }
          .status-unavailable { color: gray; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .date { color: #666; font-size: 12px; }
          .total { margin-top: 10px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>MASSAVO Therapists Report</h1>
          <span class="date">Generated: ${new Date().toLocaleDateString("de-DE")}</span>
        </div>
        <p class="total">Total Therapists: ${therapists.length}</p>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Profession</th>
              <th>Phone</th>
              <th>Email</th>
              <th>City</th>
              <th>Gym</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${therapists
              .map(
                (t) => `
              <tr>
                <td>${sanitizeText(t.name)}</td>
                <td>${sanitizeText(professionLabels[t.profession] || t.profession)}</td>
                <td>${sanitizeText(t.phone) || "-"}</td>
                <td>${sanitizeText(t.email) || "-"}</td>
                <td>${sanitizeText(t.cities?.name) || "-"}</td>
                <td>${sanitizeText(t.gyms?.name) || "-"}</td>
                <td class="${t.is_available ? "status-available" : "status-unavailable"}">
                  ${t.is_available ? "Available" : "Unavailable"}
                </td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handlePrint = () => {
    exportToPDF();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card">
        <DropdownMenuItem onClick={exportToCSV}>
          <Table className="w-4 h-4 mr-2" />
          Export as CSV/Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToPDF}>
          <FileText className="w-4 h-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2" />
          Print Report
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
