import { format } from "date-fns";
import EnterpriseReportLayout from "@/components/print/EnterpriseReportLayout";
import EnterpriseTable from "@/components/print/EnterpriseTable";
import EnterpriseSummaryCard from "@/components/print/EnterpriseSummaryCard";
import ReportSection from "@/components/print/ReportSection";
import ReportNotice from "@/components/print/ReportNotice";
import type { AnonymizedBooking } from "@/types/financial";

interface GymPrintableReportProps {
  bookings: AnonymizedBooking[];
  gymName: string;
  commissionPercentage: number;
  totalCommission: number;
  sessionCount: number;
  dateRange: string;
}

/**
 * Gym-specific commission statement.
 * Auto-classified as "financial" category.
 * Shows ONLY commission data — no platform revenue.
 */
const GymPrintableReport = ({
  bookings,
  gymName,
  commissionPercentage,
  totalCommission,
  sessionCount,
  dateRange,
}: GymPrintableReportProps) => {
  const columns = [
    {
      key: "masked_customer",
      header: "Client ID",
      width: "80px",
      render: (b: AnonymizedBooking) => (
        <span style={{ fontFamily: "monospace", fontSize: "6.5px" }}>{b.masked_customer}</span>
      ),
    },
    {
      key: "booking_date",
      header: "Session Date",
      render: (b: AnonymizedBooking) => format(new Date(b.booking_date), "dd MMM yyyy"),
    },
    { key: "booking_time", header: "Time", width: "55px" },
    { key: "service_name", header: "Massage Type" },
    {
      key: "session_price",
      header: "Session Price",
      isNumeric: true,
      render: (b: AnonymizedBooking) => `€${b.session_price.toFixed(2)}`,
    },
    {
      key: "commission_percentage",
      header: "Comm %",
      align: "center" as const,
      render: () => `${commissionPercentage}%`,
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
      title="Commission Statement"
      subtitle={gymName}
      dateRange={dateRange}
      reportType="gym_commission"
      category="financial"
      showSignatureArea={true}
      hasFinancialData={true}
    >
      <ReportSection title="Commission Summary" variant="highlight">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
          <EnterpriseSummaryCard
            value={`${commissionPercentage}%`}
            label="Commission Rate"
            sublabel="Agreed percentage"
            variant="primary"
          />
          <EnterpriseSummaryCard
            value={`€${totalCommission.toFixed(2)}`}
            label="Total Commission"
            sublabel={`Due to ${gymName}`}
            variant="accent"
          />
          <EnterpriseSummaryCard
            value={sessionCount}
            label="Eligible Sessions"
            sublabel="Completed massages"
            variant="neutral"
          />
        </div>
      </ReportSection>

      <ReportNotice
        type="privacy"
        title="Privacy Notice"
        message="This report contains anonymized client data in compliance with GDPR. Client identifiers shown are internal reference codes only."
      />

      <ReportSection title="Session Details">
        <EnterpriseTable
          data={bookings}
          columns={columns}
          variant="bordered"
          emptyMessage="No eligible sessions found for this period."
          footer={{
            label: "TOTAL COMMISSION OWED",
            values: [
              { key: "rate", value: `${commissionPercentage}%` },
              { key: "total", value: `€${totalCommission.toFixed(2)}` },
            ],
          }}
        />
      </ReportSection>
    </EnterpriseReportLayout>
  );
};

export default GymPrintableReport;
