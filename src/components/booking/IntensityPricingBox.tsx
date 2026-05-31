import { useMemo } from "react";
import { Zap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import {
  calculateIntensitySurcharge,
  DEEP_TISSUE_UPGRADE_PRICE,
} from "@/utils/intensityPricing";
import type { SelectedArea } from "@/components/body-diagram/BodyDiagram";

interface IntensityPricingBoxProps {
  basePrice: number;
  selectedAreas: SelectedArea[];
  isUpgradeActive: boolean;
  onRevertUpgrade?: () => void;
}

export function IntensityPricingBox({
  basePrice,
  selectedAreas,
  isUpgradeActive,
  onRevertUpgrade,
}: IntensityPricingBoxProps) {
  const { t } = useTranslation();
  const { perZone, totalExtra } = useMemo(
    () => calculateIntensitySurcharge(selectedAreas),
    [selectedAreas]
  );

  const surcharge = isUpgradeActive ? DEEP_TISSUE_UPGRADE_PRICE : totalExtra;
  const total = basePrice + surcharge;
  const hasAnySurcharge = surcharge > 0;

  if (selectedAreas.length === 0) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3 transition-all duration-300 animate-in fade-in-0 slide-in-from-top-2">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Zap className="w-4 h-4 text-primary" />
        {t("intensityPricing.header")}
      </div>

      {/* Base price */}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{t("intensityPricing.basePrice")}</span>
        <span className="font-medium text-foreground">{basePrice.toFixed(2)} €</span>
      </div>

      {/* Zone breakdown or upgrade */}
      {isUpgradeActive ? (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="text-primary font-medium">
              {t("intensityPricing.upgradeLabel")}
            </span>
            {onRevertUpgrade && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                onClick={onRevertUpgrade}
                title={t("intensityPricing.revertUpgradeTitle")}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
          <span className="font-medium text-primary">
            +{DEEP_TISSUE_UPGRADE_PRICE.toFixed(2)} €
          </span>
        </div>
      ) : hasAnySurcharge ? (
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("intensityPricing.surcharge")}</span>
            <span className="font-medium text-primary">+{totalExtra.toFixed(2)} €</span>
          </div>
          {/* Per-zone detail (collapsed) */}
          <div className="text-xs text-muted-foreground space-y-0.5 pl-2 border-l-2 border-primary/20">
            {perZone
              .filter((z) => z.extra > 0)
              .map((z) => (
                <div key={z.code} className="flex justify-between">
                  <span>{z.label} ({t("intensityPricing.level")} {z.intensity})</span>
                  <span>+{z.extra.toFixed(2)} €</span>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("intensityPricing.surcharge")}</span>
          <span className="text-muted-foreground">+0,00 €</span>
        </div>
      )}

      {/* Divider + total */}
      <div className="border-t border-primary/20 pt-2 flex justify-between items-center">
        <span className="font-semibold text-foreground">{t("intensityPricing.total")}</span>
        <span className="font-display text-xl font-bold text-primary">
          {total.toFixed(2)} €
        </span>
      </div>
    </div>
  );
}
