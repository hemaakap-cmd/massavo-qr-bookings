import { format } from "date-fns";
import EnterpriseReportLayout from "@/components/print/EnterpriseReportLayout";
import EnterpriseTable from "@/components/print/EnterpriseTable";
import EnterpriseSummaryCard from "@/components/print/EnterpriseSummaryCard";
import ReportSection from "@/components/print/ReportSection";
import ReportNotice from "@/components/print/ReportNotice";
import type { AnonymizedBooking, FinancialSummary } from "@/types/financial";

interface PrintableFinancialReportProps {
  bookings: AnonymizedBooking[];
  summary: FinancialSummary;
  gymName: string;
  dateRange: string;
}

/**
 * Enterprise-grade admin financial report.
 * Auto-classified as "financial" category.
 */
const PrintableFinancialReport = ({ bookings, summary, gymName, dateRange }: PrintableFinancialReportProps) => {
  const columns = [
    {
      key: "masked_customer",
      header: "Client ID",
      width: "80px",
      render: (b: AnonymizedBooking) => (
        <span style={{ fontFamily: "monospace", fontSize: "8.5px" }}>{b.masked_customer}</span>
      ),
    },
    {
      key: "booking_date",
      header: "Date",
      render: (b: AnonymizedBooking) => format(new Date(b.booking_date), "dd MMM yyyy"),
    },
    { key: "booking_time", header: "Time", width: "55px" },
    { key: "service_name", header: "Service" },
    {
      key: "session_price",
      header: "Price",
      isNumeric: true,
      render: (b: AnonymizedBooking) => `€${b.session_price.toFixed(2)}`,
    },
    {
      key: "commission_percentage",
      header: "Comm %",
      align: "center" as const,
      render: (b: AnonymizedBooking) => `${b.commission_percentage}%`,
    },
    {
      key: "commission_amount",
      header: "Commission",
      isNumeric: true,
      isHighlight: true,
      render: (b: AnonymizedBooking) => `€${b.commission_amount.toFixed(2)}`,
    },
  ];

  return (
    <EnterpriseReportLayout
      title="Financial Report"
      subtitle={gymName}
      dateRange={dateRange}
      reportType="financial"
      category="financial"
      showSignatureArea={true}
      hasFinancialData={true}
    >
      <ReportSection title="Financial Summary" variant="highlight">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
          <EnterpriseSummaryCard
            value={`€${summary.total_revenue.toFixed(2)}`}
            label="Total Revenue"
            sublabel="All paid sessions"
            variant="primary"
          />
          <EnterpriseSummaryCard
            value={`€${summary.total_commission.toFixed(2)}`}
            label="Gym Commission"
            sublabel="Owed to partners"
            variant="accent"
          />
          <EnterpriseSummaryCard
            value={`€${summary.total_net.toFixed(2)}`}
            label="Net Revenue"
            sublabel="After commission"
            variant="success"
          />
          <EnterpriseSummaryCard
            value={summary.booking_count}
            label="Total Sessions"
            sublabel="Completed bookings"
            variant="neutral"
          />
        </div>
      </ReportSection>

      <ReportNotice
        type="privacy"
        title="Privacy Notice"
        message="This report contains anonymized client data in compliance with GDPR. Client identifiers shown are internal reference codes only."
      />

      <ReportSection title="Transaction Details">
        <EnterpriseTable
          data={bookings}
          columns={columns}
          variant="bordered"
          emptyMessage="No transactions found for this period."
          footer={{
            label: "TOTAL",
            values: [
              { key: "revenue", value: `€${summary.total_revenue.toFixed(2)}` },
              { key: "spacer", value: "" },
              { key: "commission", value: `€${summary.total_commission.toFixed(2)}` },
            ],
          }}
        />
      </ReportSection>
    </EnterpriseReportLayout>
  );
};

export default PrintableFinancialReport;
