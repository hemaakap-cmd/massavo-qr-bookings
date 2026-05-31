import type { RevenueProjection } from "@/hooks/useBusinessIntelligence";

export interface ScenarioParams {
  priceChangePct: number;
  capacityChangePct: number;
  addGyms: number;
  removeGymIds: string[];
}

export function applyScenario(
  projection: RevenueProjection,
  params: ScenarioParams
): RevenueProjection["projections"] {
  const priceFactor = 1 + params.priceChangePct / 100;
  const capacityFactor = 1 + params.capacityChangePct / 100;
  const gymAdjustment = params.addGyms * 0.08; // each new gym adds ~8% rev
  const removeAdjustment = params.removeGymIds.length * -0.06; // each removed gym loses ~6%
  const totalFactor = priceFactor * capacityFactor * (1 + gymAdjustment + removeAdjustment);

  return projection.projections.map(p => ({
    ...p,
    conservative: Math.round(p.conservative * totalFactor * 0.95),
    expected: Math.round(p.expected * totalFactor),
    aggressive: Math.round(p.aggressive * totalFactor * 1.05),
  }));
}
