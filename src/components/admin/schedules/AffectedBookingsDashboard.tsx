import { useScheduleExceptions } from "@/hooks/useScheduleExceptions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import type { RescheduleStatus } from "@/types/schedule";

interface AffectedBookingsDashboardProps {
  gymId: string;
  gymName: string;
}

const STATUS_CONFIG: Record<RescheduleStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  pending: { label: "Pending", variant: "default", icon: Clock },
  confirmed: { label: "Confirmed", variant: "secondary", icon: CheckCircle },
  declined: { label: "Cancelled", variant: "destructive", icon: XCircle },
  auto_confirmed: { label: "Auto-Confirmed", variant: "secondary", icon: CheckCircle },
  auto_cancelled: { label: "Auto-Cancelled", variant: "destructive", icon: XCircle },
};

export function AffectedBookingsDashboard({ gymId, gymName }: AffectedBookingsDashboardProps) {
  const { affectedBookings, isLoading, refetchAffectedBookings } = useScheduleExceptions(gymId);

  if (isLoading) {
    return <div className="animate-pulse h-48 bg-muted rounded-lg" />;
  }

  const pendingCount = affectedBookings.filter((b) => b.status === "pending").length;
  const confirmedCount = affectedBookings.filter((b) => 
    b.status === "confirmed" || b.status === "auto_confirmed"
  ).length;
  const cancelledCount = affectedBookings.filter((b) => 
    b.status === "declined" || b.status === "auto_cancelled"
  ).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-lg">Affected Bookings - {gymName}</CardTitle>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2 text-sm">
            <Badge variant="default">{pendingCount} Pending</Badge>
            <Badge variant="secondary">{confirmedCount} Confirmed</Badge>
            <Badge variant="destructive">{cancelledCount} Cancelled</Badge>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetchAffectedBookings()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {affectedBookings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No affected bookings.</p>
            <p className="text-sm">All bookings are on track.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Original Date</TableHead>
                <TableHead>New Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Notified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {affectedBookings.map((reschedule) => {
                const statusConfig = STATUS_CONFIG[reschedule.status];
                const StatusIcon = statusConfig.icon;
                const isOverdue = new Date(reschedule.response_deadline) < new Date() && reschedule.status === "pending";

                return (
                  <TableRow key={reschedule.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{reschedule.booking?.customer_name || "—"}</p>
                        <p className="text-sm text-muted-foreground">
                          {reschedule.booking?.customer_email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{format(parseISO(reschedule.original_date), "dd MMM yyyy")}</p>
                        <p className="text-sm text-muted-foreground">
                          {reschedule.original_time.slice(0, 5)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {reschedule.selected_date ? (
                        <div>
                          <p>{format(parseISO(reschedule.selected_date), "dd MMM yyyy")}</p>
                          <p className="text-sm text-muted-foreground">
                            {reschedule.selected_time?.slice(0, 5) || "—"}
                          </p>
                        </div>
                      ) : reschedule.suggested_date ? (
                        <div className="text-muted-foreground">
                          <p>{format(parseISO(reschedule.suggested_date), "dd MMM yyyy")}</p>
                          <p className="text-sm">(suggested)</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig.variant} className="flex items-center gap-1 w-fit">
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {reschedule.status === "pending" ? (
                        <div className={isOverdue ? "text-destructive" : ""}>
                          <p>{format(parseISO(reschedule.response_deadline), "dd MMM, HH:mm")}</p>
                          <p className="text-sm">
                            {isOverdue ? "Overdue!" : formatDistanceToNow(parseISO(reschedule.response_deadline), { addSuffix: true })}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {reschedule.customer_notified_at ? (
                        <Badge variant="outline" className="text-xs">
                          {format(parseISO(reschedule.customer_notified_at), "dd MMM HH:mm")}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">Not sent</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
