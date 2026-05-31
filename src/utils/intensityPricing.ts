/**
 * Intensity-based pricing engine for Massavo body zone customization.
 * Premium "Druckintensität" pricing — never uses the word "Schmerz".
 */

export interface ZonePricing {
  code: string;
  label: string;
  intensity: number;
  extra: number;
}

/** Calculate extra charge for a single zone based on intensity level */
export function getZoneExtra(level: number): number {
  if (level <= 5) return 0;
  if (level <= 7) return 1;
  if (level <= 9) return 1.5;
  return 2;
}

/** Calculate total intensity surcharge across all selected zones */
export function calculateIntensitySurcharge(
  zones: { code: string; label: string; painIntensity: number }[]
): { perZone: ZonePricing[]; totalExtra: number } {
  const perZone = zones.map((z) => ({
    code: z.code,
    label: z.label,
    intensity: z.painIntensity,
    extra: getZoneExtra(z.painIntensity),
  }));
  const totalExtra = perZone.reduce((sum, z) => sum + z.extra, 0);
  return { perZone, totalExtra };
}

/** Check if Deep Tissue Upgrade should be offered */
export function shouldOfferDeepTissue(
  zones: { painIntensity: number }[]
): boolean {
  const highIntensityCount = zones.filter((z) => z.painIntensity >= 7).length;
  return highIntensityCount >= 3;
}

/** Deep Tissue flat upgrade price */
export const DEEP_TISSUE_UPGRADE_PRICE = 9;

/** Calculate final surcharge considering upgrade status */
export function getFinalSurcharge(
  zones: { code: string; label: string; painIntensity: number }[],
  isUpgradeActive: boolean
): number {
  if (isUpgradeActive) return DEEP_TISSUE_UPGRADE_PRICE;
  return calculateIntensitySurcharge(zones).totalExtra;
}
