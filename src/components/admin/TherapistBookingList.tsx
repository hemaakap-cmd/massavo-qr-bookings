import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, Clock, User, Sparkles } from "lucide-react";
import EnterpriseReportLayout from "@/components/print/EnterpriseReportLayout";
import EnterpriseTable from "@/components/print/EnterpriseTable";
import EnterpriseSummaryCard from "@/components/print/EnterpriseSummaryCard";
import ReportSection from "@/components/print/ReportSection";
import { PRINT_STYLES } from "@/constants/branding";

interface Booking {
  id: string;
  customer_name: string | null;
  booking_date: string;
  booking_time: string;
  services?: { name: string };
}

interface TherapistBookingListProps {
  bookings: Booking[];
  therapistName: string;
  dateRange?: string;
  isPrintView?: boolean;
}

/**
 * Therapist booking list with enterprise print layout.
 * Auto-classified as "administrative" category.
 */
const TherapistBookingList = ({ 
  bookings, 
  therapistName, 
  dateRange,
  isPrintView = false 
}: TherapistBookingListProps) => {
  if (isPrintView) {
    const columns = [
      { 
        key: "booking_time", 
        header: "Time",
        width: "70px",
        render: (b: Booking) => (
          <span style={{ 
            fontWeight: "bold", 
            fontSize: "11px",
            color: PRINT_STYLES.colors.primary,
          }}>
            {b.booking_time}
          </span>
        ),
      },
      { 
        key: "booking_date", 
        header: "Date",
        render: (b: Booking) => format(new Date(b.booking_date), "EEE, dd MMM yyyy"),
      },
      { 
        key: "customer_name", 
        header: "Client Name",
        render: (b: Booking) => (
          <span style={{ fontWeight: "500" }}>
            {b.customer_name || "Guest"}
          </span>
        ),
      },
      { 
        key: "service", 
        header: "Massage Type",
        render: (b: Booking) => b.services?.name || "-",
      },
    ];

    return (
      <EnterpriseReportLayout
        title="Daily Schedule"
        subtitle={therapistName}
        dateRange={dateRange}
        reportType="therapist_summary"
        category="administrative"
        showSignatureArea={false}
      >
        <ReportSection title="Overview">
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ maxWidth: "160px" }}>
              <EnterpriseSummaryCard 
                value={bookings.length}
                label="Total Appointments"
                variant="accent"
              />
            </div>
          </div>
        </ReportSection>

        <ReportSection title="Appointment Schedule">
          <EnterpriseTable
            data={bookings}
            columns={columns}
            variant="striped"
            emptyMessage="No bookings scheduled."
            showRowNumbers={true}
          />
        </ReportSection>
      </EnterpriseReportLayout>
    );
  }

  // Screen view (unchanged)
  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">{therapistName}'s Schedule</h3>
          <span className="ml-auto text-sm text-muted-foreground">
            {bookings.length} appointment{bookings.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Time
              </div>
            </TableHead>
            <TableHead>
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Date
              </div>
            </TableHead>
            <TableHead>
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                Client Name
              </div>
            </TableHead>
            <TableHead>
              <div className="flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Massage Type
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                No bookings scheduled for this therapist.
              </TableCell>
            </TableRow>
          ) : (
            bookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell className="font-medium text-primary">
                  {booking.booking_time}
                </TableCell>
                <TableCell>
                  {format(new Date(booking.booking_date), "EEE, MMM d")}
                </TableCell>
                <TableCell className="font-medium">
                  {booking.customer_name || "Guest"}
                </TableCell>
                <TableCell>{booking.services?.name || "-"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default TherapistBookingList;
