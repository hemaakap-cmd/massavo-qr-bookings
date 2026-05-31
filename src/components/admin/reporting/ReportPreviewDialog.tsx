import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { GeneratedReport, TherapistReportData, GymReportData, AdminReportData } from "@/types/reporting";
import { User, Building2, Shield, Calendar, Euro, Hash } from "lucide-react";

interface ReportPreviewDialogProps {
  report: GeneratedReport;
  open: boolean;
  onClose: () => void;
}

const ReportPreviewDialog = ({ report, open, onClose }: ReportPreviewDialogProps) => {
  const reportData = report.report_data as TherapistReportData | GymReportData | AdminReportData;

  const isTherapistReport = report.recipient_type === "therapist";
  const isGymReport = report.recipient_type === "gym";
  const isAdminReport = report.recipient_type === "admin";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isTherapistReport && <User className="w-5 h-5" />}
            {isGymReport && <Building2 className="w-5 h-5" />}
            {isAdminReport && <Shield className="w-5 h-5" />}
            {report.recipient_name || "Admin"} Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Report Header */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {reportData.date_range}
            </div>
            <Badge variant="secondary" className="capitalize">
              {report.recipient_type}
            </Badge>
          </div>

          <Separator />

          {/* Therapist Report */}
          {isTherapistReport && (
            <TherapistReportPreview data={reportData as TherapistReportData} />
          )}

          {/* Gym Report */}
          {isGymReport && (
            <GymReportPreview data={reportData as GymReportData} />
          )}

          {/* Admin Report */}
          {isAdminReport && (
            <AdminReportPreview data={reportData as AdminReportData} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const TherapistReportPreview = ({ data }: { data: TherapistReportData }) => (
  <div className="space-y-4">
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Session Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-2xl font-bold">
          <Hash className="w-6 h-6 text-muted-foreground" />
          {data.total_sessions} Sessions
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Booking Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Location</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.bookings.map((booking, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-medium">{booking.client_name}</TableCell>
                <TableCell>{booking.date}</TableCell>
                <TableCell>{booking.time}</TableCell>
                <TableCell>{booking.service_name}</TableCell>
                <TableCell>{booking.gym_name}</TableCell>
              </TableRow>
            ))}
            {data.bookings.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No bookings in this period
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <p className="text-xs text-muted-foreground text-center">
      This report contains only booking information. No financial data is included.
    </p>
  </div>
);

const GymReportPreview = ({ data }: { data: GymReportData }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Total Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.total_sessions}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Commission Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.commission_percentage}%</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Total Commission</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">€{data.total_commission.toFixed(2)}</div>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Session Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Service</TableHead>
              <TableHead className="text-right">Session Price</TableHead>
              <TableHead className="text-right">Commission</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.bookings.map((booking, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-medium">{booking.masked_customer}</TableCell>
                <TableCell>{booking.date}</TableCell>
                <TableCell>{booking.time}</TableCell>
                <TableCell>{booking.service_name}</TableCell>
                <TableCell className="text-right">€{booking.session_price.toFixed(2)}</TableCell>
                <TableCell className="text-right font-medium text-green-600">€{booking.commission_amount.toFixed(2)}</TableCell>
              </TableRow>
            ))}
            {data.bookings.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No sessions in this period
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <p className="text-xs text-muted-foreground text-center">
      This report shows only commission data for {data.gym_name}. Platform revenue is not disclosed.
    </p>
  </div>
);

const AdminReportPreview = ({ data }: { data: AdminReportData }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Total Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">€{data.total_revenue.toFixed(2)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Total Commission</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">€{data.total_commission.toFixed(2)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Net Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">€{data.total_net.toFixed(2)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Total Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.total_sessions}</div>
        </CardContent>
      </Card>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Gym Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gym</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.gyms.map((gym, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{gym.name}</TableCell>
                  <TableCell className="text-right">{gym.sessions}</TableCell>
                  <TableCell className="text-right">€{gym.revenue.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-orange-600">€{gym.commission.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {data.gyms.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No gym data
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Therapist Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Therapist</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.therapists.map((therapist, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{therapist.name}</TableCell>
                  <TableCell className="text-right">{therapist.sessions}</TableCell>
                </TableRow>
              ))}
              {data.therapists.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    No therapist data
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  </div>
);

export default ReportPreviewDialog;
