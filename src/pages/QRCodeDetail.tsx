import { useState, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  ArrowLeft, 
  Download, 
  Copy, 
  Check,
  MessageCircle, 
  Mail, 
  Share2,
  MapPin,
  Building2,
  Facebook,
  Twitter,
  Linkedin
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

interface EntityData {
  id: string;
  name: string;
  subtitle: string;
  type: "city" | "gym";
}

const QRCodeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type") as "city" | "gym" || "gym";
  
  const [entity, setEntity] = useState<EntityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (id) fetchEntity();
  }, [id, type]);

  const fetchEntity = async () => {
    setLoading(true);
    
    if (type === "city") {
      const { data } = await supabase
        .from("cities")
        .select("id, name, country")
        .eq("id", id)
        .maybeSingle();
      
      if (data) {
        setEntity({
          id: data.id,
          name: data.name,
          subtitle: data.country,
          type: "city"
        });
      }
    } else {
      // Use public view that excludes sensitive business data (phone, commission)
      const { data } = await supabase
        .from("gyms_public")
        .select("id, name, address, cities(name)")
        .eq("id", id)
        .maybeSingle();
      
      if (data) {
        setEntity({
          id: data.id,
          name: data.name,
          subtitle: data.cities?.name || data.address,
          type: "gym"
        });
      }
    }
    
    setLoading(false);
  };

  const getBookingUrl = () => {
    if (!entity) return "";
    const baseUrl = window.location.origin;
    return entity.type === "city" 
      ? `${baseUrl}/city/${entity.id}` 
      : `${baseUrl}/gym/${entity.id}`;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(getBookingUrl());
      setCopied(true);
      toast({ title: "Link kopiert!", description: "Der Link wurde in die Zwischenablage kopiert." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Fehler", description: "Link konnte nicht kopiert werden.", variant: "destructive" });
    }
  };

  const downloadQRCode = () => {
    const canvas = document.getElementById("qr-large") as HTMLCanvasElement;
    if (!canvas || !entity) return;
    
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-code-${entity.name.toLowerCase().replace(/\s+/g, "-")}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    toast({ title: "Heruntergeladen!", description: "QR-Code wurde gespeichert." });
  };

  const shareViaWhatsApp = () => {
    if (!entity) return;
    const text = encodeURIComponent(`Buche jetzt deine Massage bei ${entity.name}! 💆‍♂️\n\n${getBookingUrl()}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const shareViaEmail = () => {
    if (!entity) return;
    const subject = encodeURIComponent(`Massage buchen bei ${entity.name}`);
    const body = encodeURIComponent(`Hallo!\n\nBuche jetzt deine Massage bei ${entity.name}:\n${getBookingUrl()}\n\nViele Grüße`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const shareViaFacebook = () => {
    const url = encodeURIComponent(getBookingUrl());
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank");
  };

  const shareViaTwitter = () => {
    if (!entity) return;
    const text = encodeURIComponent(`Buche jetzt deine Massage bei ${entity.name}! 💆‍♂️`);
    const url = encodeURIComponent(getBookingUrl());
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
  };

  const shareViaLinkedIn = () => {
    const url = encodeURIComponent(getBookingUrl());
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, "_blank");
  };

  const shareNative = async () => {
    if (!entity) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Massage bei ${entity.name}`,
          text: `Buche jetzt deine Massage bei ${entity.name}!`,
          url: getBookingUrl(),
        });
      } catch {
        // User cancelled or share failed silently
      }
    } else {
      copyToClipboard();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-32 text-center">
          <h1 className="font-display text-2xl font-bold text-foreground mb-4">Nicht gefunden</h1>
          <p className="text-muted-foreground mb-6">Der angeforderte QR-Code konnte nicht gefunden werden.</p>
          <Button asChild>
            <Link to="/share-qr">Zurück zur Übersicht</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-24">
        <div className="max-w-2xl mx-auto">
          {/* Back Link */}
          <Link 
            to="/share-qr" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück zur Übersicht
          </Link>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              {entity.type === "city" ? (
                <MapPin className="w-8 h-8 text-primary" />
              ) : (
                <Building2 className="w-8 h-8 text-primary" />
              )}
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">
              {entity.name}
            </h1>
            <p className="text-muted-foreground text-lg">{entity.subtitle}</p>
          </div>

          {/* QR Code Card */}
          <Card className="mb-8">
            <CardContent className="p-8">
              <div className="flex justify-center mb-6">
                <div className="p-6 bg-white rounded-2xl shadow-lg">
                  <QRCodeCanvas
                    id="qr-large"
                    value={getBookingUrl()}
                    size={280}
                    level="H"
                    includeMargin
                  />
                </div>
              </div>

              {/* URL Display with Copy */}
              <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg mb-6">
                <span className="flex-1 text-sm text-muted-foreground truncate font-mono">
                  {getBookingUrl()}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyToClipboard}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-primary" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {/* Primary Actions */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <Button variant="sage" onClick={downloadQRCode} className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Herunterladen
                </Button>
                <Button variant="outline" onClick={shareNative} className="w-full">
                  <Share2 className="w-4 h-4 mr-2" />
                  Teilen
                </Button>
              </div>

              {/* Share Options */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground text-center">
                  Über soziale Medien teilen
                </h3>
                
                <div className="grid grid-cols-5 gap-3">
                  <ShareButton
                    icon={<MessageCircle className="w-5 h-5" />}
                    label="WhatsApp"
                    onClick={shareViaWhatsApp}
                    className="bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366]"
                  />
                  <ShareButton
                    icon={<Mail className="w-5 h-5" />}
                    label="E-Mail"
                    onClick={shareViaEmail}
                    className="bg-primary/10 hover:bg-primary/20 text-primary"
                  />
                  <ShareButton
                    icon={<Facebook className="w-5 h-5" />}
                    label="Facebook"
                    onClick={shareViaFacebook}
                    className="bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2]"
                  />
                  <ShareButton
                    icon={<Twitter className="w-5 h-5" />}
                    label="Twitter"
                    onClick={shareViaTwitter}
                    className="bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 text-[#1DA1F2]"
                  />
                  <ShareButton
                    icon={<Linkedin className="w-5 h-5" />}
                    label="LinkedIn"
                    onClick={shareViaLinkedIn}
                    className="bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 text-[#0A66C2]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-display text-lg font-semibold text-foreground mb-3">
                So verwendest du den QR-Code
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                  <span>Lade den QR-Code herunter oder teile den Link direkt</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                  <span>Drucke den QR-Code aus oder sende ihn digital</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
                  <span>Scannen führt direkt zur Buchungsseite</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

interface ShareButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}

const ShareButton = ({ icon, label, onClick, className }: ShareButtonProps) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center p-3 rounded-xl transition-colors ${className}`}
    aria-label={label}
  >
    {icon}
    <span className="text-xs mt-1 font-medium">{label}</span>
  </button>
);

export default QRCodeDetail;
