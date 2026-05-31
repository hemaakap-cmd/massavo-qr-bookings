import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useDeliveryLogs } from "@/hooks/useDeliveryLogs";
import { supabase } from "@/integrations/supabase/client";
import type { GeneratedReport, DeliveryMethod } from "@/types/reporting";
import { Mail, MessageSquare, Send, Loader2 } from "lucide-react";

interface ReportDeliveryDialogProps {
  report: GeneratedReport;
  open: boolean;
  onClose: () => void;
}

const ReportDeliveryDialog = ({ report, open, onClose }: ReportDeliveryDialogProps) => {
  const { toast } = useToast();
  const { createDeliveryLog, updateDeliveryStatus } = useDeliveryLogs();

  const [deliveryChannel, setDeliveryChannel] = useState<DeliveryMethod>("email");
  const [recipientEmail, setRecipientEmail] = useState(report.recipient_email || "");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (deliveryChannel === "email" && !recipientEmail) {
      toast({
        title: "Email Required",
        description: "Please enter a recipient email address.",
        variant: "destructive",
      });
      return;
    }

    if (deliveryChannel === "whatsapp" && !recipientPhone) {
      toast({
        title: "Phone Required",
        description: "Please enter a recipient phone number.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);

    try {
      // Create delivery log entry
      const logResult = await createDeliveryLog.mutateAsync({
        report_id: report.id,
        delivery_channel: deliveryChannel,
        recipient_email: deliveryChannel === "email" ? recipientEmail : undefined,
        recipient_phone: deliveryChannel === "whatsapp" ? recipientPhone : undefined,
      });

      // Call edge function to send the report
      const { data, error } = await supabase.functions.invoke("send-report", {
        body: {
          report_id: report.id,
          delivery_channel: deliveryChannel,
          recipient_email: recipientEmail,
          recipient_phone: recipientPhone,
          report_data: report.report_data,
          recipient_type: report.recipient_type,
          recipient_name: report.recipient_name,
          date_range: `${report.date_from} - ${report.date_to}`,
        },
      });

      if (error) throw error;

      // Update delivery status
      await updateDeliveryStatus.mutateAsync({
        id: logResult.id,
        status: "sent",
      });

      toast({
        title: "Report Sent",
        description: `Report successfully sent via ${deliveryChannel}.`,
      });

      onClose();
    } catch (error: any) {
      console.error("Delivery error:", error);
      toast({
        title: "Delivery Failed",
        description: error.message || "Failed to send report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Report</DialogTitle>
          <DialogDescription>
            Choose a delivery channel and enter recipient details for{" "}
            <span className="font-medium">{report.recipient_name || "Admin"}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Delivery Channel Selection */}
          <div className="space-y-2">
            <Label>Delivery Channel</Label>
            <RadioGroup
              value={deliveryChannel}
              onValueChange={(v) => setDeliveryChannel(v as DeliveryMethod)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="email" id="email" />
                <Label htmlFor="email" className="flex items-center gap-1 cursor-pointer">
                  <Mail className="w-4 h-4" />
                  Email
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="whatsapp" id="whatsapp" />
                <Label htmlFor="whatsapp" className="flex items-center gap-1 cursor-pointer">
                  <MessageSquare className="w-4 h-4 text-green-600" />
                  WhatsApp
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Email Input */}
          {deliveryChannel === "email" && (
            <div className="space-y-2">
              <Label htmlFor="recipient-email">Recipient Email</Label>
              <Input
                id="recipient-email"
                type="email"
                placeholder="email@example.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
            </div>
          )}

          {/* Phone Input */}
          {deliveryChannel === "whatsapp" && (
            <div className="space-y-2">
              <Label htmlFor="recipient-phone">Recipient Phone (with country code)</Label>
              <Input
                id="recipient-phone"
                type="tel"
                placeholder="+49 123 456789"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDeliveryDialog;
