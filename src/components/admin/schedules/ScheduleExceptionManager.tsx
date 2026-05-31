import { useState } from "react";
import { useScheduleExceptions } from "@/hooks/useScheduleExceptions";
import { useGymSchedules } from "@/hooks/useGymSchedules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, CalendarX, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";

interface ScheduleExceptionManagerProps {
  gymId: string;
  gymName: string;
}

export function ScheduleExceptionManager({ gymId, gymName }: ScheduleExceptionManagerProps) {
  const { exceptions, isLoading, createException, deleteException } = useScheduleExceptions(gymId);
  const { availableDates } = useGymSchedules(gymId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    exception_date: "",
    reason: "",
    alternative_date: "",
    auto_action: "suggest_alternative" as "suggest_alternative" | "auto_cancel",
    response_deadline_hours: 24,
  });

  const handleSubmit = async () => {
    await createException.mutateAsync({
      gym_id: gymId,
      exception_date: formData.exception_date,
      reason: formData.reason || undefined,
      alternative_date: formData.alternative_date || undefined,
      auto_action: formData.auto_action,
      response_deadline_hours: formData.response_deadline_hours,
    });
    setIsDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      exception_date: "",
      reason: "",
      alternative_date: "",
      auto_action: "suggest_alternative",
      response_deadline_hours: 24,
    });
  };

  const handleDelete = async (exceptionId: string) => {
    if (confirm("Are you sure you want to remove this exception? This will make the date bookable again.")) {
      await deleteException.mutateAsync(exceptionId);
    }
  };

  // Filter available dates to only show future dates for alternatives
  const futureAvailableDates = availableDates.filter(
    (d) => new Date(d.available_date) > new Date()
  );

  if (isLoading) {
    return <div className="animate-pulse h-48 bg-muted rounded-lg" />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarX className="h-5 w-5 text-destructive" />
          <CardTitle className="text-lg">Schedule Exceptions - {gymName}</CardTitle>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Exception
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Disable a Date</DialogTitle>
              <DialogDescription>
                Block bookings for a specific date. Existing bookings will be notified.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="exception_date">Date to Disable</Label>
                <Input
                  id="exception_date"
                  type="date"
                  value={formData.exception_date}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, exception_date: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reason">Reason (optional)</Label>
                <Textarea
                  id="reason"
                  placeholder="e.g., Public holiday, Maintenance day..."
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, reason: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="alternative_date">Suggest Alternative Date</Label>
                <Select
                  value={formData.alternative_date}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, alternative_date: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select alternative date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No alternative</SelectItem>
                    {futureAvailableDates.slice(0, 12).map((date) => (
                      <SelectItem key={date.available_date} value={date.available_date}>
                        {format(parseISO(date.available_date), "EEEE, dd MMM yyyy")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="auto_action">If No Response</Label>
                <Select
                  value={formData.auto_action}
                  onValueChange={(value: "suggest_alternative" | "auto_cancel") =>
                    setFormData((prev) => ({ ...prev, auto_action: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="suggest_alternative">Auto-confirm alternative</SelectItem>
                    <SelectItem value="auto_cancel">Auto-cancel booking</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="deadline">Response Deadline (hours)</Label>
                <Input
                  id="deadline"
                  type="number"
                  min={1}
                  max={72}
                  value={formData.response_deadline_hours}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      response_deadline_hours: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={!formData.exception_date || createException.isPending}
              >
                Create Exception
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {exceptions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CalendarX className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No exceptions configured.</p>
            <p className="text-sm">All scheduled dates are available for booking.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Alternative</TableHead>
                <TableHead>Auto Action</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exceptions.map((exception) => (
                <TableRow key={exception.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      {format(parseISO(exception.exception_date), "EEE, dd MMM yyyy")}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {exception.reason || "—"}
                  </TableCell>
                  <TableCell>
                    {exception.alternative_date ? (
                      format(parseISO(exception.alternative_date), "dd MMM yyyy")
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={exception.auto_action === "auto_cancel" ? "destructive" : "secondary"}>
                      {exception.auto_action === "auto_cancel" ? "Cancel" : "Confirm Alt."}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(exception.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
