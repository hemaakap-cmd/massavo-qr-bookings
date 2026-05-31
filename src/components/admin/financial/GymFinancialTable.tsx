import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { AnonymizedBooking } from "@/types/financial";

interface GymFinancialTableProps {
  bookings: AnonymizedBooking[];
  commissionPercentage: number;
}

/**
 * Gym-specific financial table
 * Shows ONLY: Client ID, Date, Time, Service, Price, Commission %,  Commission Amount
 * EXCLUDES: Company revenue, profits, other gym data
 */
const GymFinancialTable = ({ bookings, commissionPercentage }: GymFinancialTableProps) => {
  return (
    <div className="bg-card rounded-lg border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client ID</TableHead>
            <TableHead>Session Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Massage Type</TableHead>
            <TableHead className="text-right">Session Price</TableHead>
            <TableHead className="text-center">Commission %</TableHead>
            <TableHead className="text-right">Commission Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                No eligible sessions found for the selected period.
              </TableCell>
            </TableRow>
          ) : (
            bookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs">
                    {booking.masked_customer}
                  </Badge>
                </TableCell>
                <TableCell>
                  {format(new Date(booking.booking_date), "dd MMM yyyy")}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {booking.booking_time}
                </TableCell>
                <TableCell>{booking.service_name}</TableCell>
                <TableCell className="text-right font-medium">
                  €{booking.session_price.toFixed(2)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{commissionPercentage}%</Badge>
                </TableCell>
                <TableCell className="text-right font-medium text-orange-600">
                  €{booking.commission_amount.toFixed(2)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default GymFinancialTable;
