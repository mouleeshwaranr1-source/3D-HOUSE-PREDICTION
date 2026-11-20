import type {
  BlueprintAnalysisPayload,
  FuturePlanPayload,
  RoomGeometry,
} from '../db/schema.ts';

export interface MaterialCatalogItem {
  id: number;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  region: string;
  source: string;
  updatedAt: Date | null;
}

export interface LabourCatalogItem {
  id: number;
  trade: string;
  unit: string;
  ratePerUnit: number;
  region: string;
  updatedAt: Date | null;
}

export interface RegionMultiplierItem {
  id: number;
  regionName: string;
  currency: string;
  materialMultiplier: number;
  labourMultiplier: number;
  priceSource: string;
  updatedAt: Date | null;
}

export interface CostBreakdownResult {
  isApproximate: boolean;
  currency: string;
  region: string;
  priceSource: string;
  lastUpdated: string;
  totalAreaSqm: number;
  totalHouseCost: number;
  materialCost: number;
  labourCost: number;
  electricalCost: number;
  plumbingCost: number;
  interiorCost: number;
  structuralCost: number;
  roomWiseCosts: Array<{
    roomId: string;
    roomName: string;
    roomType: string;
    floor: number;
    areaSqm: number;
    structuralCost: number;
    materialCost: number;
    labourCost: number;
    electricalCost: number;
    plumbingCost: number;
    interiorCost: number;
    totalCost: number;
  }>;
  materialDistribution: Array<{ category: string; amount: number; percentage: number }>;
  labourDistribution: Array<{ trade: string; amount: number; percentage: number }>;
  budgetDistribution: Array<{ category: string; amount: number; percentage: number }>;
  weeklyExpenditure: Array<{ week: string; planned: number; cumulative: number }>;
  monthlyCashFlow: Array<{ month: string; material: number; labour: number; mep: number; total: number }>;
  yearlyMaintenance: Array<{ year: string; maintenance: number; lifecycleCost: number }>;
  electricalQuantities: {
    totalLights: number;
    totalFans: number;
    totalSockets: number;
    totalSwitches: number;
    totalAcPoints: number;
    estimatedCableM: number;
    distributionBoards: number;
  };
  plumbingQuantities: {
    coldOutlets: number;
    hotOutlets: number;
    drainPoints: number;
    supplyPipeM: number;
    hotWaterPipeM: number;
    drainagePipeM: number;
    valvesCount: number;
  };
}

const FLOORING_UNIT_COST: Record<string, number> = {
  'Oak Hardwood': 78,
  'Engineered Walnut': 86,
  'Porcelain Tile': 54,
  'Italian Marble': 135,
  'Polished Concrete': 48,
  'Terrazzo': 92,
  'Acoustic Carpet': 38,
};

const CEILING_UNIT_COST: Record<string, number> = {
  'Flat Plaster': 26,
  'Recessed Cove': 44,
  'Acoustic Timber': 68,
  'Exposed Beam': 58,
};

export function calculateProjectCosts(params: {
  analysis: BlueprintAnalysisPayload | null;
  futurePlan?: FuturePlanPayload | null;
  regionName: string;
  materials: MaterialCatalogItem[];
  labour: LabourCatalogItem[];
  regions: RegionMultiplierItem[];
}): CostBreakdownResult {
  const regionObj =
    params.regions.find((r) => r.regionName === params.regionName) ||
    params.regions[0] || {
      regionName: 'Global Standard',
      currency: 'USD',
      materialMultiplier: 1.0,
      labourMultiplier: 1.0,
      priceSource: 'BUILDVISION Standard Cost Index',
      updatedAt: new Date(),
    };

  const matMult = regionObj.materialMultiplier || 1;
  const labMult = regionObj.labourMultiplier || 1;

  const findMaterialPrice = (category: string, fallback: number) => {
    const match = params.materials.find((m) => m.category === category);
    return match ? match.unitPrice : fallback;
  };

  const findLabourRate = (tradePrefix: string, fallback: number) => {
    const match = params.labour.find((l) =>
      l.trade.toLowerCase().includes(tradePrefix.toLowerCase())
    );
    return match ? match.ratePerUnit : fallback;
  };

  const baseStructMatPerSqm = findMaterialPrice('Structural', 420);
  const roofingMatPerSqm = findMaterialPrice('Roofing', 85);
  const wallFinishPerSqm = findMaterialPrice('Wall Finish', 24);
  const elecPointUnit = findMaterialPrice('Electrical', 58);
  const plumbPointUnit = findMaterialPrice('Plumbing', 115);

  const masonryLabPerSqm = findLabourRate('Masonry', 210);
  const carpentryLabPerSqm = findLabourRate('Carpentry', 95);
  const elecLabPerPoint = findLabourRate('Electrical', 42);
  const plumbLabPerPoint = findLabourRate('Plumbing', 75);
  const finishLabPerSqm = findLabourRate('Interior', 62);

  const rooms: RoomGeometry[] = params.analysis?.rooms || [];

  let totalAreaSqm = 0;
  let totalStructural = 0;
  let totalMaterials = 0;
  let totalLabour = 0;
  let totalElectrical = 0;
  let totalPlumbing = 0;
  let totalInterior = 0;

  let totalLights = 0;
  let totalFans = 0;
  let totalSockets = 0;
  let totalSwitches = 0;
  let totalAcPoints = 0;
  let coldOutlets = 0;
  let hotOutlets = 0;
  let drainPoints = 0;

  const roomWiseCosts = rooms.map((room) => {
    const area = Math.max(1, room.areaSqm || room.width * room.depth);
    const perimeter = 2 * (room.width + room.depth);
    const wallSurfaceArea = perimeter * (room.height || 3.0);

    const structMat = area * (baseStructMatPerSqm + roofingMatPerSqm * 0.55) * matMult;
    const structLab = area * (masonryLabPerSqm + carpentryLabPerSqm * 0.4) * labMult;

    const floorUnit = FLOORING_UNIT_COST[room.floorMaterial] ?? 55;
    const ceilUnit = CEILING_UNIT_COST[room.ceilingStyle] ?? 28;
    const furnitureBudget = (room.furniture?.length || 0) * 620;
    const interiorMat =
      (area * (floorUnit + ceilUnit) + wallSurfaceArea * wallFinishPerSqm) * matMult +
      furnitureBudget;
    const interiorLab = area * finishLabPerSqm * labMult;

    const e = room.electrical || {
      lights: 2,
      fans: 1,
      sockets: 4,
      switches: 2,
      acPoints: 0,
      circuitLoadKw: 1.0,
    };
    const elecPoints = e.lights + e.fans + e.sockets + e.switches + e.acPoints * 2;
    const elecMat = elecPoints * elecPointUnit * matMult;
    const elecLab = elecPoints * elecLabPerPoint * labMult;

    const p = room.plumbing || {
      coldOutlets: 0,
      hotOutlets: 0,
      drainPoints: 0,
      fixtures: [],
    };
    const plumbPoints = p.coldOutlets + p.hotOutlets + p.drainPoints;
    const plumbMat = plumbPoints * plumbPointUnit * matMult;
    const plumbLab = plumbPoints * plumbLabPerPoint * labMult;

    totalLights += e.lights;
    totalFans += e.fans;
    totalSockets += e.sockets;
    totalSwitches += e.switches;
    totalAcPoints += e.acPoints;
    coldOutlets += p.coldOutlets;
    hotOutlets += p.hotOutlets;
    drainPoints += p.drainPoints;

    const roomMaterialTotal = structMat + interiorMat + elecMat + plumbMat;
    const roomLabourTotal = structLab + interiorLab + elecLab + plumbLab;
    const roomTotal = roomMaterialTotal + roomLabourTotal;

    totalAreaSqm += area;
    totalStructural += structMat + structLab;
    totalMaterials += roomMaterialTotal;
    totalLabour += roomLabourTotal;
    totalElectrical += elecMat + elecLab;
    totalPlumbing += plumbMat + plumbLab;
    totalInterior += interiorMat + interiorLab;

    return {
      roomId: room.id,
      roomName: room.name,
      roomType: room.type,
      floor: room.floor || 1,
      areaSqm: Number(area.toFixed(2)),
      structuralCost: Math.round(structMat + structLab),
      materialCost: Math.round(roomMaterialTotal),
      labourCost: Math.round(roomLabourTotal),
      electricalCost: Math.round(elecMat + elecLab),
      plumbingCost: Math.round(plumbMat + plumbLab),
      interiorCost: Math.round(interiorMat + interiorLab),
      totalCost: Math.round(roomTotal),
    };
  });

  // Include future plan additions if present (kept separate or added to total if desired — here base total is current house)
  const totalHouseCost = Math.round(totalMaterials + totalLabour);

  const safeDiv = (num: number, denom: number) =>
    denom > 0 ? Number(((num / denom) * 100).toFixed(1)) : 0;

  const structMatOnly = Math.round(
    rooms.reduce((s, r) => s + r.areaSqm * baseStructMatPerSqm * matMult, 0)
  );
  const roofingMatOnly = Math.round(
    rooms.reduce((s, r) => s + r.areaSqm * roofingMatPerSqm * 0.55 * matMult, 0)
  );
  const interiorMatOnly = Math.max(0, Math.round(totalMaterials - structMatOnly - roofingMatOnly - totalElectrical * 0.58 - totalPlumbing * 0.6));
  const elecMatOnly = Math.round(totalElectrical * 0.58);
  const plumbMatOnly = Math.round(totalPlumbing * 0.6);

  const materialDistribution = [
    { category: 'Concrete, Masonry & Frame', amount: structMatOnly, percentage: safeDiv(structMatOnly, totalMaterials) },
    { category: 'Interior Finishes & Flooring', amount: interiorMatOnly, percentage: safeDiv(interiorMatOnly, totalMaterials) },
    { category: 'Roofing & Waterproofing', amount: roofingMatOnly, percentage: safeDiv(roofingMatOnly, totalMaterials) },
    { category: 'Electrical & Wiring', amount: elecMatOnly, percentage: safeDiv(elecMatOnly, totalMaterials) },
    { category: 'Plumbing & Fixtures', amount: plumbMatOnly, percentage: safeDiv(plumbMatOnly, totalMaterials) },
  ];

  const masonryLab = Math.round(totalAreaSqm * masonryLabPerSqm * labMult);
  const carpentryLab = Math.round(totalAreaSqm * carpentryLabPerSqm * 0.4 * labMult);
  const finishLab = Math.round(totalAreaSqm * finishLabPerSqm * labMult);
  const elecLabTotal = Math.round(totalElectrical * 0.42);
  const plumbLabTotal = Math.round(totalPlumbing * 0.4);

  const labourDistribution = [
    { trade: 'Masonry & Civil Works', amount: masonryLab, percentage: safeDiv(masonryLab, totalLabour) },
    { trade: 'Interior Painting & Tiling', amount: finishLab, percentage: safeDiv(finishLab, totalLabour) },
    { trade: 'Carpentry & Joinery', amount: carpentryLab, percentage: safeDiv(carpentryLab, totalLabour) },
    { trade: 'Electrical Trade', amount: elecLabTotal, percentage: safeDiv(elecLabTotal, totalLabour) },
    { trade: 'Plumbing & HVAC Trade', amount: plumbLabTotal, percentage: safeDiv(plumbLabTotal, totalLabour) },
  ];

  const budgetDistribution = [
    { category: 'Structural Shell', amount: Math.round(totalStructural), percentage: safeDiv(totalStructural, totalHouseCost) },
    { category: 'Interior & Finishes', amount: Math.round(totalInterior), percentage: safeDiv(totalInterior, totalHouseCost) },
    { category: 'Electrical Systems', amount: Math.round(totalElectrical), percentage: safeDiv(totalElectrical, totalHouseCost) },
    { category: 'Plumbing & Sanitary', amount: Math.round(totalPlumbing), percentage: safeDiv(totalPlumbing, totalHouseCost) },
  ];

  // S-curve weekly expenditure over 16 weeks
  const weights16 = [0.03, 0.04, 0.05, 0.07, 0.08, 0.09, 0.1, 0.1, 0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03, 0.02];
  let cum = 0;
  const weeklyExpenditure = weights16.map((w, i) => {
    const planned = Math.round(totalHouseCost * w);
    cum += planned;
    return {
      week: `W${i + 1}`,
      planned,
      cumulative: cum,
    };
  });

  // 12-month cash flow projection
  const monthWeights = [0.06, 0.09, 0.12, 0.13, 0.12, 0.11, 0.1, 0.09, 0.07, 0.05, 0.04, 0.02];
  const monthLabels = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12'];
  const monthlyCashFlow = monthLabels.map((month, i) => {
    const w = monthWeights[i];
    const material = Math.round(totalMaterials * w);
    const labour = Math.round(totalLabour * w);
    const mep = Math.round((totalElectrical + totalPlumbing) * (i >= 3 && i <= 8 ? 0.14 : 0.025));
    return {
      month,
      material,
      labour,
      mep,
      total: material + labour + mep,
    };
  });

  // 5-year maintenance & lifecycle projection
  const yearlyMaintenance = [1, 2, 3, 4, 5].map((yr) => {
    const maintenance = Math.round(totalHouseCost * (0.008 + yr * 0.0025));
    return {
      year: `Year ${yr}`,
      maintenance,
      lifecycleCost: totalHouseCost + maintenance * yr,
    };
  });

  const estimatedCableM =
    params.analysis?.electricalSummary?.circuits?.reduce(
      (s, c) => s + (c.estimatedWireM || 0),
      0
    ) || Math.round(totalAreaSqm * 2.4);

  return {
    isApproximate: true,
    currency: regionObj.currency,
    region: regionObj.regionName,
    priceSource: regionObj.priceSource,
    lastUpdated: (regionObj.updatedAt || new Date()).toISOString().split('T')[0],
    totalAreaSqm: Number(totalAreaSqm.toFixed(2)),
    totalHouseCost,
    materialCost: Math.round(totalMaterials),
    labourCost: Math.round(totalLabour),
    electricalCost: Math.round(totalElectrical),
    plumbingCost: Math.round(totalPlumbing),
    interiorCost: Math.round(totalInterior),
    structuralCost: Math.round(totalStructural),
    roomWiseCosts,
    materialDistribution,
    labourDistribution,
    budgetDistribution,
    weeklyExpenditure,
    monthlyCashFlow,
    yearlyMaintenance,
    electricalQuantities: {
      totalLights,
      totalFans,
      totalSockets,
      totalSwitches,
      totalAcPoints,
      estimatedCableM,
      distributionBoards: Math.max(1, params.analysis?.floors || 1),
    },
    plumbingQuantities: {
      coldOutlets,
      hotOutlets,
      drainPoints,
      supplyPipeM: params.analysis?.plumbingSummary?.supplyPipeM || Math.round(totalAreaSqm * 0.45),
      hotWaterPipeM: params.analysis?.plumbingSummary?.hotWaterPipeM || Math.round(totalAreaSqm * 0.22),
      drainagePipeM: params.analysis?.plumbingSummary?.drainagePipeM || Math.round(totalAreaSqm * 0.35),
      valvesCount: params.analysis?.plumbingSummary?.valvesCount || Math.max(4, drainPoints + 2),
    },
  };
}
