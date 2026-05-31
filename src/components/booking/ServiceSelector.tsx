import { Activity, Heart, Leaf, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePublicCountry } from "@/contexts/CountryContext";
interface Service {
  id: string;
  name: string;
  description: string;
  duration: string;
  price: number;
  icon: "sports" | "recovery" | "relaxation";
}

interface ServiceSelectorProps {
  services: Service[];
  selectedService: string | null;
  onSelect: (serviceId: string) => void;
}

const iconMap = {
  sports: Activity,
  recovery: Heart,
  relaxation: Leaf,
};

const colorMap = {
  sports: "bg-primary/15 text-primary",
  recovery: "bg-accent/20 text-accent",
  relaxation: "bg-gold-light text-charcoal",
};

const ServiceSelector = ({ services, selectedService, onSelect }: ServiceSelectorProps) => {
  const { t } = useTranslation();
  const { formatPrice } = usePublicCountry();
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-2xl font-bold text-foreground tracking-tight mb-2">
          {t("serviceSelector.title")}
        </h3>
        <p className="font-body text-sm text-muted-foreground">
          {t("serviceSelector.subtitle")}
        </p>
      </div>
      
      <div className="grid gap-4">
        {services.map((service) => {
          const Icon = iconMap[service.icon] || Leaf;
          const isSelected = selectedService === service.id;
          
          return (
            <button
              key={service.id}
              onClick={() => onSelect(service.id)}
              className={`w-full flex items-center gap-5 p-5 rounded-2xl border-2 transition-all duration-300 text-left group ${
                isSelected
                  ? "border-primary bg-primary/10 shadow-lg"
                  : "border-border hover:border-primary/40 bg-card hover:bg-secondary/40"
              }`}
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110 ${colorMap[service.icon] || "bg-primary/15 text-primary"}`}>
                <Icon className="w-8 h-8" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="font-display text-xl font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                  {service.name}
                </div>
                <div className="font-body text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-3">
                  {service.description}
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-body text-sm text-muted-foreground font-medium px-3 py-1 bg-secondary/60 rounded-full">
                    {service.duration}
                  </span>
                  <span className="font-display text-xl font-bold text-primary">
                    {formatPrice(service.price)}
                  </span>
                </div>
              </div>

              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                isSelected 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-secondary text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
              }`}>
                <ChevronRight className="w-5 h-5" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ServiceSelector;
