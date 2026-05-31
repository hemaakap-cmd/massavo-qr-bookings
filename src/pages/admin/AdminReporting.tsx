import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useReportGeneration } from "@/hooks/useReportGeneration";
import { useDeliveryLogs } from "@/hooks/useDeliveryLogs";
import { format } from "date-fns";
import { CalendarIcon, FileText, Send, Clock, CheckCircle, XCircle, RotateCcw, Mail, MessageSquare, FileBarChart, Building2, User, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RecipientType, ReportType, GeneratedReport, TherapistReportData, GymReportData, AdminReportData } from "@/types/reporting";
import ReportPreviewDialog from "@/components/admin/reporting/ReportPreviewDialog";
import ReportDeliveryDialog from "@/components/admin/reporting/ReportDeliveryDialog";

const reportTypeLabels: Record<ReportType, string> = {
  daily_booking: "Daily Booking",
  weekly_booking: "Weekly Booking",
  monthly_booking: "Monthly Booking",
  therapist_summary: "Therapist Summary",
  gym_commission: "Gym Commission",
  admin_overview: "Admin Overview",
};

const recipientTypeLabels: Record<RecipientType, string> = {
  therapist: "Therapist",
  gym: "Gym",
  admin: "Admin",
};

const recipientTypeIcons: Record<RecipientType, typeof User> = {
  therapist: User,
  gym: Building2,
  admin: Shield,
};

const AdminReporting = () => {
  const [selectedRecipientType, setSelectedRecipientType] = useState<RecipientType>("therapist");
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("today");
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>(new Date());
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>(new Date());
  const [previewReport, setPreviewReport] = useState<GeneratedReport | null>(null);
  const [deliveryReport, setDeliveryReport] = useState<GeneratedReport | null>(null);

  const { templates, generateReport, getDateRange } = useReportGeneration();
  const { generatedReports, deliveryLogs, activitySummary, isLoading: logsLoading } = useDeliveryLogs();

  // Fetch therapists for dropdown
  const { data: therapists } = useQuery({
    queryKey: ["therapists-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapists")
        .select("id, name")
        .eq("is_available", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch gyms for dropdown
  const { data: gyms } = useQuery({
    queryKey: ["gyms-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gyms")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleGenerateReport = async () => {
    let dateFrom: string;
    let dateTo: string;

    if (selectedPeriod === "custom") {
      dateFrom = customDateFrom ? format(customDateFrom, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
      dateTo = customDateTo ? format(customDateTo, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
    } else {
      const range = getDateRange(selectedPeriod as any);
      dateFrom = range.from;
      dateTo = range.to;
    }

    const reportType: ReportType = selectedRecipientType === "admin" 
      ? "admin_overview" 
      : selectedRecipientType === "gym" 
        ? "gym_commission" 
        : "therapist_summary";

    await generateReport.mutateAsync({
      report_type: reportType,
      recipient_type: selectedRecipientType,
      recipient_id: selectedRecipientType !== "admin" ? selectedRecipientId : undefined,
      date_from: dateFrom,
      date_to: dateTo,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Sent</Badge>;
      case "failed":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case "resent":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><RotateCcw className="w-3 h-3 mr-1" />Resent</Badge>;
      default:
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email":
        return <Mail className="w-4 h-4 text-muted-foreground" />;
      case "whatsapp":
        return <MessageSquare className="w-4 h-4 text-green-600" />;
      default:
        return <Send className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Smart Reporting Engine</h1>
          <p className="text-muted-foreground mt-1">
            Generate, preview, and deliver role-based reports to therapists, gyms, and administrators
          </p>
        </div>

        {/* Activity Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Reports (7d)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activitySummary?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Successfully Sent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{activitySummary?.sent || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Failed Deliveries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{activitySummary?.failed || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{activitySummary?.pending || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="generate" className="space-y-4">
          <TabsList>
            <TabsTrigger value="generate">
              <FileBarChart className="w-4 h-4 mr-2" />
              Generate Report
            </TabsTrigger>
            <TabsTrigger value="reports">
              <FileText className="w-4 h-4 mr-2" />
              Generated Reports
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Clock className="w-4 h-4 mr-2" />
              Delivery Activity
            </TabsTrigger>
          </TabsList>

          {/* Generate Report Tab */}
          <TabsContent value="generate" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Generate New Report</CardTitle>
                <CardDescription>
                  Select recipient type, entity, and date range to generate a role-based report
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Recipient Type */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Recipient Type</label>
                    <Select value={selectedRecipientType} onValueChange={(v) => {
                      setSelectedRecipientType(v as RecipientType);
                      setSelectedRecipientId("");
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="therapist">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Therapist
                          </div>
                        </SelectItem>
                        <SelectItem value="gym">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            Gym
                          </div>
                        </SelectItem>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Admin (Full Overview)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Recipient Selection */}
                  {selectedRecipientType !== "admin" && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Select {selectedRecipientType === "therapist" ? "Therapist" : "Gym"}
                      </label>
                      <Select value={selectedRecipientId} onValueChange={setSelectedRecipientId}>
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${selectedRecipientType}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedRecipientType === "therapist" 
                            ? therapists?.map((t) => (
                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                              ))
                            : gyms?.map((g) => (
                                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                              ))
                          }
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Date Period */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date Period</label>
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="yesterday">Yesterday</SelectItem>
                        <SelectItem value="this_week">This Week</SelectItem>
                        <SelectItem value="last_week">Last Week</SelectItem>
                        <SelectItem value="this_month">This Month</SelectItem>
                        <SelectItem value="last_month">Last Month</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Custom Date Range */}
                {selectedPeriod === "custom" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">From Date</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !customDateFrom && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {customDateFrom ? format(customDateFrom, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={customDateFrom} onSelect={setCustomDateFrom} initialFocus />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">To Date</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !customDateTo && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {customDateTo ? format(customDateTo, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={customDateTo} onSelect={setCustomDateTo} initialFocus />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleGenerateReport}
                  disabled={generateReport.isPending || (selectedRecipientType !== "admin" && !selectedRecipientId)}
                  className="w-full md:w-auto"
                >
                  {generateReport.isPending ? "Generating..." : "Generate Report"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Generated Reports Tab */}
          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Generated Reports</CardTitle>
                <CardDescription>
                  View, preview, and send generated reports
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date Range</TableHead>
                      <TableHead>Generated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {generatedReports?.map((report) => {
                      const Icon = recipientTypeIcons[report.recipient_type as RecipientType];
                      return (
                        <TableRow key={report.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{report.recipient_name || "Admin"}</span>
                            </div>
                            <Badge variant="secondary" className="mt-1">
                              {recipientTypeLabels[report.recipient_type as RecipientType]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {reportTypeLabels[report.report_type as ReportType]}
                          </TableCell>
                          <TableCell>
                            {format(new Date(report.date_from), "dd.MM.yy")} - {format(new Date(report.date_to), "dd.MM.yy")}
                          </TableCell>
                          <TableCell>
                            {format(new Date(report.created_at), "dd.MM.yy HH:mm")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => setPreviewReport(report)}>
                                <FileText className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setDeliveryReport(report)}>
                                <Send className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {(!generatedReports || generatedReports.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No reports generated yet. Create your first report above.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Log Tab */}
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Delivery Activity Log</CardTitle>
                <CardDescription>
                  Track all report deliveries with timestamps and status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveryLogs?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="font-medium">
                            {(log.generated_reports as any)?.recipient_name || "Admin Report"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {reportTypeLabels[(log.generated_reports as any)?.report_type as ReportType] || "Report"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getChannelIcon(log.delivery_channel)}
                            <span className="capitalize">{log.delivery_channel}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.recipient_email || log.recipient_phone || "-"}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(log.delivery_status)}
                        </TableCell>
                        <TableCell>
                          {log.sent_at ? format(new Date(log.sent_at), "dd.MM.yy HH:mm") : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!deliveryLogs || deliveryLogs.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No delivery activity yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Preview Dialog */}
        {previewReport && (
          <ReportPreviewDialog
            report={previewReport}
            open={!!previewReport}
            onClose={() => setPreviewReport(null)}
          />
        )}

        {/* Delivery Dialog */}
        {deliveryReport && (
          <ReportDeliveryDialog
            report={deliveryReport}
            open={!!deliveryReport}
            onClose={() => setDeliveryReport(null)}
          />
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminReporting;
