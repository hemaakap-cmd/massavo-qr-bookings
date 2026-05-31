import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MapPin, Star, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

interface GymCardProps {
  id: string;
  name: string;
  address: string;
  rating: number;
  therapistCount: number;
  therapistNames?: string[];
  openNow: boolean;
  image?: string;
}

const GymCard = ({ id, name, address, rating, therapistCount, therapistNames = [], openNow }: GymCardProps) => {
  const { t } = useTranslation();

  return (
    <div className="group bg-card rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 border border-border">
      {/* Header with status badges */}
      <div className="p-6 pb-4 border-b border-border bg-sage-light/30">
        <div className="flex items-center justify-between mb-3">
          {/* Open Now Badge */}
          {openNow && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-sage text-cream text-xs font-semibold tracking-wide uppercase">
              <span className="w-2 h-2 rounded-full bg-cream animate-pulse" />
              {t("gymCard.openNow")}
            </div>
          )}

          {/* Rating Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border">
            <Star className="w-4 h-4 text-gold fill-gold" />
            <span className="font-bold text-sm text-foreground">{rating.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="font-display text-xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors leading-tight">
          {name}
        </h3>
        
        <div className="flex items-start gap-2 text-muted-foreground mb-4">
          <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary/60" />
          <span className="font-body text-sm leading-relaxed">{address}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Clock className="w-4 h-4 text-primary/60" />
          <span className="font-medium">{t("gymCard.defaultHours")}</span>
        </div>

        <Button variant="sage" className="w-full font-semibold" asChild>
          <Link to={`/gym/${id}`}>{t("gymCard.viewAndBook")}</Link>
        </Button>
      </div>
    </div>
  );
};

export default GymCard;
