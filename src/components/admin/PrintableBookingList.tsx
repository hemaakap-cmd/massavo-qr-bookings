import { format } from "date-fns";
import EnterpriseReportLayout from "@/components/print/EnterpriseReportLayout";
import EnterpriseTable from "@/components/print/EnterpriseTable";
import EnterpriseSummaryCard from "@/components/print/EnterpriseSummaryCard";
import ReportSection from "@/components/print/ReportSection";

interface Booking {
  id: string;
  customer_email: string;
  customer_name: string | null;
  booking_date: string;
  booking_time: string;
  status: string;
  payment_status: string;
  total_amount: number;
  services?: { name: string };
  therapists?: { name: string } | null;
}

interface PrintableBookingListProps {
  bookings: Booking[];
  gymName: string;
  dateRange?: string;
}

/**
 * Administrative booking schedule report.
 * Auto-classified as "administrative" category.
 */
const PrintableBookingList = ({ bookings, gymName, dateRange }: PrintableBookingListProps) => {
  const confirmedCount = bookings.filter((b) => b.status === "confirmed").length;
  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const completedCount = bookings.filter((b) => b.status === "completed").length;
  const totalRevenue = bookings.reduce((sum, b) => sum + b.total_amount, 0);

  const renderStatus = (status: string) => {
    const isPositive = status === "confirmed" || status === "completed";
    return (
      <span
        style={{
          padding: "2px 6px",
          borderRadius: "3px",
          fontSize: "7.5px",
          fontWeight: "bold",
          textTransform: "uppercase",
          backgroundColor: isPositive ? "#f0fdf4" : "#f3f4f6",
          color: isPositive ? "#16a34a" : "#6b7280",
          border: `1px solid ${isPositive ? "#bbf7d0" : "#d1d5db"}`,
        }}
      >
        {status}
      </span>
    );
  };

  const columns = [
    { key: "booking_time", header: "Time", width: "55px" },
    {
      key: "booking_date",
      header: "Date",
      render: (b: Booking) => format(new Date(b.booking_date), "dd MMM yyyy"),
    },
    {
      key: "customer_name",
      header: "Client Name",
      render: (b: Booking) => b.customer_name || "Guest",
    },
    {
      key: "service",
      header: "Service",
      render: (b: Booking) => b.services?.name || "-",
    },
    {
      key: "therapist",
      header: "Therapist",
      render: (b: Booking) => b.therapists?.name || "Any",
    },
    {
      key: "status",
      header: "Status",
      align: "center" as const,
      render: (b: Booking) => renderStatus(b.status),
    },
    {
      key: "total_amount",
      header: "Amount",
      isNumeric: true,
      render: (b: Booking) => `€${b.total_amount.toFixed(2)}`,
    },
  ];

  return (
    <EnterpriseReportLayout
      title="Booking Schedule"
      subtitle={gymName}
      dateRange={dateRange}
      reportType="daily_booking"
      category="administrative"
      showSignatureArea={false}
    >
      <ReportSection title="Booking Summary">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" }}>
          <EnterpriseSummaryCard value={bookings.length} label="Total" variant="primary" />
          <EnterpriseSummaryCard value={confirmedCount} label="Confirmed" variant="success" />
          <EnterpriseSummaryCard value={pendingCount} label="Pending" variant="neutral" />
          <EnterpriseSummaryCard value={completedCount} label="Completed" variant="primary" />
          <EnterpriseSummaryCard
            value={`€${totalRevenue.toFixed(2)}`}
            label="Revenue"
            variant="accent"
          />
        </div>
      </ReportSection>

      <ReportSection title="Booking Details">
        <EnterpriseTable
          data={bookings}
          columns={columns}
          variant="striped"
          emptyMessage="No bookings found for this gym."
          footer={{
            label: "TOTAL",
            values: [{ key: "total", value: `€${totalRevenue.toFixed(2)}` }],
          }}
        />
      </ReportSection>
    </EnterpriseReportLayout>
  );
};

export default PrintableBookingList;
