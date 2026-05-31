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

interface FinancialTableProps {
  bookings: AnonymizedBooking[];
  showGymColumn: boolean;
}

const FinancialTable = ({ bookings, showGymColumn }: FinancialTableProps) => {
  return (
    <div className="bg-card rounded-lg border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client ID</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
            {showGymColumn && <TableHead>Gym</TableHead>}
            <TableHead>Service</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-center">Commission %</TableHead>
            <TableHead className="text-right">Commission</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showGymColumn ? 8 : 7} className="text-center py-8 text-muted-foreground">
                No financial data found for the selected period.
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
                {showGymColumn && (
                  <TableCell className="font-medium">{booking.gym_name}</TableCell>
                )}
                <TableCell>{booking.service_name}</TableCell>
                <TableCell className="text-right font-medium">
                  €{booking.session_price.toFixed(2)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{booking.commission_percentage}%</Badge>
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

export default FinancialTable;
