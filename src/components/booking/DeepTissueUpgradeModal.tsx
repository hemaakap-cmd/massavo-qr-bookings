import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Zap, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DEEP_TISSUE_UPGRADE_PRICE } from "@/utils/intensityPricing";

interface DeepTissueUpgradeModalProps {
  open: boolean;
  onClose: () => void;
  onActivateUpgrade: () => void;
  onKeepIndividual: () => void;
  individualTotal: number;
}

export function DeepTissueUpgradeModal({
  open,
  onClose,
  onActivateUpgrade,
  onKeepIndividual,
  individualTotal,
}: DeepTissueUpgradeModalProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <DialogTitle className="font-display text-xl">
              {t("deepTissueModal.title")}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {t("deepTissueModal.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">{t("deepTissueModal.individualSurcharges")}</span>
            <span className="text-sm font-medium line-through text-muted-foreground">
              +{individualTotal.toFixed(2)} €
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              {t("deepTissueModal.upgradePrice")}
            </span>
            <span className="text-lg font-bold text-primary">
              {t("deepTissueModal.onlyPlus", { amount: DEEP_TISSUE_UPGRADE_PRICE })}
            </span>
          </div>
          {individualTotal > DEEP_TISSUE_UPGRADE_PRICE && (
            <p className="text-xs text-primary mt-2 font-medium">
              {t("deepTissueModal.savings", { amount: (individualTotal - DEEP_TISSUE_UPGRADE_PRICE).toFixed(2) })}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            onClick={onActivateUpgrade}
            className="w-full gap-2"
            variant="default"
          >
            <Zap className="w-4 h-4" />
            {t("deepTissueModal.activate")}
          </Button>
          <Button
            onClick={onKeepIndividual}
            variant="outline"
            className="w-full gap-2"
          >
            <Layers className="w-4 h-4" />
            {t("deepTissueModal.keepIndividual")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
