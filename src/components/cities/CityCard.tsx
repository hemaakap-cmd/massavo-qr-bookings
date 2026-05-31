import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MapPin, Building, Hotel as HotelIcon, ArrowRight } from "lucide-react";

interface CityCardProps {
  id: string;
  name: string;
  country: string;
  gymCount: number;
  image?: string;
  variant?: "gym" | "hotel";
  hotelCount?: number;
}

const CityCard = ({ id, name, country, gymCount, variant = "gym", hotelCount = 0 }: CityCardProps) => {
  const { t } = useTranslation();
  const isHotel = variant === "hotel";
  const to = isHotel ? `/hotels/city/${id}` : `/city/${id}`;
  const Icon = isHotel ? HotelIcon : Building;
  const count = isHotel ? hotelCount : gymCount;
  const label = isHotel ? t("cityCard.partnerHotels") : t("cityCard.partnerGyms");
  return (
    <Link
      to={to}
      className="group block bg-card rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 border border-border hover:border-primary/30"
    >
      {/* Header accent */}
      <div className="h-2 bg-gradient-to-r from-sage to-sage-dark" />

      {/* Content */}
      <div className="p-6">
        <div className="flex items-center gap-2 text-primary/70 text-sm font-medium mb-2">
          <MapPin className="w-4 h-4" />
          <span className="tracking-wide">{country}</span>
        </div>
        
        <h3 className="font-display text-2xl font-bold text-foreground mb-4 group-hover:text-primary transition-colors leading-tight">
          {name}
        </h3>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon className="w-4 h-4" />
            <span className="font-body text-sm font-medium">{count} {label}</span>
          </div>

          {/* Hover Arrow */}
          <div className="w-10 h-10 rounded-full bg-sage-light flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-1">
            <ArrowRight className="w-5 h-5 text-sage" />
          </div>
        </div>
      </div>
    </Link>
  );
};

export default CityCard;
