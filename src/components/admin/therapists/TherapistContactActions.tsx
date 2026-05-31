import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Phone, Mail, MessageCircle } from "lucide-react";

interface TherapistContactActionsProps {
  phone: string | null;
  email: string | null;
  name: string;
}

export function TherapistContactActions({ phone, email, name }: TherapistContactActionsProps) {
  const handleCall = () => {
    if (phone) {
      window.open(`tel:${phone}`, "_blank");
    }
  };

  const handleEmail = () => {
    if (email) {
      window.open(`mailto:${email}?subject=MASSAVO - ${encodeURIComponent(name)}`, "_blank");
    }
  };

  const handleWhatsApp = () => {
    if (phone) {
      // Remove non-numeric characters except +
      const cleanPhone = phone.replace(/[^\d+]/g, "");
      window.open(`https://wa.me/${cleanPhone}`, "_blank");
    }
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleCall}
              disabled={!phone}
            >
              <Phone className="w-4 h-4 text-sage" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {phone ? `Call ${phone}` : "No phone number"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleEmail}
              disabled={!email}
            >
              <Mail className="w-4 h-4 text-sage" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {email ? `Email ${email}` : "No email"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleWhatsApp}
              disabled={!phone}
            >
              <MessageCircle className="w-4 h-4 text-success" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {phone ? "Open WhatsApp" : "No phone number"}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
