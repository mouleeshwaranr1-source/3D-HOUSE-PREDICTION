import React, { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Calculator, Check, Info, TrendingUp } from 'lucide-react';
import type {
  ActiveRoute,
  BlueprintAnalysisPayload,
  CostBreakdownResult,
  ProjectRecord,
  RegionMultiplierItem,
} from '../../types/app';
import { formatArea, formatCurrency } from '../../types/app';
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  SelectField,
} from '../ui/Primitives';

const CHART_BLUES = ['#3049F5', '#5369FF', '#172D9B', '#7B8DFF', '#A5B2FF'];

export function CostAnalyticsWorkspace({
  mode,
  projects,
  activeProject,
  costBreakdown,
  regions,
  onSelectProject,
  onChangeRegion,
  onApplyMaterialPreset,
  onNavigate,
}: {
  mode: 'construction_cost' | 'cost_analytics' | 'budget_optimizer';
  projects: ProjectRecord[];
  activeProject: ProjectRecord | null;
  costBreakdown: CostBreakdownResult | null;
  regions: RegionMultiplierItem[];
  onSelectProject: (id: number) => void;
  onChangeRegion: (projectId: number, regionName: string) => Promise<void>;
  onApplyMaterialPreset: (
    projectId: number,
    updatedAnalysis: BlueprintAnalysisPayload
  ) => Promise<void>;
  onNavigate: (route: ActiveRoute) => void;
}) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [optimizerPreset, setOptimizerPreset] = useState<'economy' | 'balanced' | 'premium'>(
    'balanced'
  );
  const [applying, setApplying] = useState(false);
  const [updatingRegion, setUpdatingRegion] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!activeProject || !costBreakdown || costBreakdown.roomWiseCosts.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 size={22} />}
        title="No Cost Data Available Yet"
        description="Upload and analyze a floor plan blueprint to generate room-wise construction costs, material/labour distributions, and cash-flow projections."
        action={
          <Button onClick={() => onNavigate('upload_blueprint')}>
            Upload Blueprint
          </Button>
        }
      />
    );
  }

  const currency = costBreakdown.currency;
  const activeRoomDetail =
    costBreakdown.roomWiseCosts.find((r) => r.roomId === selectedRoomId) ||
    costBreakdown.roomWiseCosts[0];

  const summaryCards = [
    { label: 'Total House Cost', value: formatCurrency(costBreakdown.totalHouseCost, currency) },
    { label: 'Material Cost', value: formatCurrency(costBreakdown.materialCost, currency) },
    { label: 'Labour Cost', value: formatCurrency(costBreakdown.labourCost, currency) },
    { label: 'Electrical Cost', value: formatCurrency(costBreakdown.electricalCost, currency) },
    { label: 'Plumbing Cost', value: formatCurrency(costBreakdown.plumbingCost, currency) },
    { label: 'Interior Cost', value: formatCurrency(costBreakdown.interiorCost, currency) },
    { label: 'Total Built-up Area', value: formatArea(costBreakdown.totalAreaSqm) },
  ];

  // Budget Optimizer projection math
  const factor = optimizerPreset === 'economy' ? 0.84 : optimizerPreset === 'premium' ? 1.24 : 1.0;
  const simulatedTotal = Math.round(costBreakdown.totalHouseCost * factor);
  const delta = simulatedTotal - costBreakdown.totalHouseCost;

  const handleApplyOptimizer = async () => {
    if (!activeProject.analysisData) return;
    setActionError(null);
    setApplying(true);
    try {
      const floorChoice =
        optimizerPreset === 'economy'
          ? 'Polished Concrete'
          : optimizerPreset === 'premium'
          ? 'Italian Marble'
          : 'Oak Hardwood';
      const ceilingChoice =
        optimizerPreset === 'economy'
          ? 'Flat Plaster'
          : optimizerPreset === 'premium'
          ? 'Acoustic Timber'
          : 'Recessed Cove';
      const updatedRooms = activeProject.analysisData.rooms.map((r) => ({
        ...r,
        floorMaterial:
          r.type === 'bathroom'
            ? optimizerPreset === 'premium'
              ? 'Italian Marble'
              : 'Porcelain Tile'
            : floorChoice,
        ceilingStyle: ceilingChoice,
      }));
      await onApplyMaterialPreset(activeProject.id, {
        ...activeProject.analysisData,
        rooms: updatedRooms,
      });
    } catch (err: any) {
      setActionError(err?.message || 'Failed to apply specification preset.');
    } finally {
      setApplying(false);
    }
  };

  const handleRegionChange = async (regionName: string) => {
    setActionError(null);
    setUpdatingRegion(true);
    try {
      await onChangeRegion(activeProject.id, regionName);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update pricing region.');
    } finally {
      setUpdatingRegion(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-[#171923]">
            {mode === 'budget_optimizer'
              ? 'Budget Optimizer'
              : mode === 'construction_cost'
              ? 'Construction Cost Bill of Quantities'
              : 'Construction Cost Analytics'}
          </h1>
          <p className="text-xs text-[#777B87] mt-0.5">
            Live estimates synchronized with your 3D house geometry, room finishes, and regional pricing database.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <SelectField
            value={activeProject.id}
            onChange={(e) => onSelectProject(Number(e.target.value))}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            value={activeProject.location}
            disabled={updatingRegion}
            onChange={(e) => handleRegionChange(e.target.value)}
          >
            {regions.map((r) => (
              <option key={r.regionName} value={r.regionName}>
                {r.regionName} ({r.currency})
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      {actionError && (
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#D94A50]">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-[11px] font-medium underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Approximate Estimate & Price Source Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-lg bg-[#EEF1FF] border border-[#D4DCFF] text-xs text-[#172D9B]">
        <div className="flex items-center gap-2">
          <Info size={15} className="text-[#3049F5] shrink-0" />
          <span>
            All construction figures are <strong>approximate planning estimates</strong> and should be validated against contractor tenders.
          </span>
        </div>
        <div className="font-mono-num text-[11px]">
          Source: {costBreakdown.priceSource} · Updated {costBreakdown.lastUpdated}
        </div>
      </div>

      {/* 7 SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {summaryCards.map((c) => (
          <Card key={c.label} padding="p-3.5">
            <span className="text-[11px] font-medium text-[#777B87] block truncate">
              {c.label}
            </span>
            <span className="font-mono-num text-base font-semibold text-[#171923] mt-1.5 block tabular-nums">
              {c.value}
            </span>
          </Card>
        ))}
      </div>

      {/* BUDGET OPTIMIZER MODULE */}
      {mode === 'budget_optimizer' && (
        <Card className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[#171923] flex items-center gap-2">
                <TrendingUp size={16} className="text-[#3049F5]" />
                <span>Specification Optimization Scenarios</span>
              </h2>
              <p className="text-xs text-[#777B87] mt-0.5">
                Compare finish specification tiers and apply directly to all rooms in your 3D house.
              </p>
            </div>
            <Button onClick={handleApplyOptimizer} disabled={applying}>
              <Check size={14} />
              <span>{applying ? 'Applying...' : 'Apply Scenario to Project'}</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                key: 'economy' as const,
                title: 'Value Engineered (Economy)',
                desc: 'Polished concrete & porcelain floors, flat plaster ceilings, standard fixtures.',
                est: Math.round(costBreakdown.totalHouseCost * 0.84),
              },
              {
                key: 'balanced' as const,
                title: 'Architectural Standard',
                desc: 'Oak hardwood living areas, recessed cove ceilings, balanced MEP specs.',
                est: costBreakdown.totalHouseCost,
              },
              {
                key: 'premium' as const,
                title: 'Custom Luxury Finish',
                desc: 'Italian marble flooring, acoustic timber ceilings, premium interior package.',
                est: Math.round(costBreakdown.totalHouseCost * 1.24),
              },
            ].map((tier) => (
              <button
                key={tier.key}
                type="button"
                onClick={() => setOptimizerPreset(tier.key)}
                className={`text-left p-4 rounded-lg border transition-colors cursor-pointer ${
                  optimizerPreset === tier.key
                    ? 'bg-[#EEF1FF]/70 border-[#3049F5]'
                    : 'bg-white border-[#E5E6EB] hover:bg-[#F1F0EC]/50'
                }`}
              >
                <p className="text-xs font-semibold text-[#171923]">{tier.title}</p>
                <p className="text-[11px] text-[#777B87] mt-1 leading-relaxed">{tier.desc}</p>
                <p className="font-mono-num text-base font-semibold text-[#3049F5] mt-3">
                  {formatCurrency(tier.est, currency)}
                </p>
              </button>
            ))}
          </div>

          <div className="text-xs text-[#171923] bg-[#F1F0EC]/60 border border-[#E5E6EB] rounded-lg px-4 py-2.5 flex flex-wrap justify-between gap-2">
            <span>Selected Simulation Total: <strong className="font-mono-num">{formatCurrency(simulatedTotal, currency)}</strong></span>
            <span className={`font-mono-num font-semibold ${delta <= 0 ? 'text-[#249B67]' : 'text-[#E8A13A]'}`}>
              {delta <= 0
                ? `Projected Savings: ${formatCurrency(Math.abs(delta), currency)}`
                : `Upgrade Delta: +${formatCurrency(delta, currency)}`}
            </span>
          </div>
        </Card>
      )}

      {/* ANALYTICS CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Room-wise Construction Cost (Clickable) */}
        <Card className="lg:col-span-7">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-[#171923]">
                Room-wise Construction Cost
              </h2>
              <p className="text-[11px] text-[#777B87]">
                Click any room bar to inspect its structural, MEP, and interior cost breakdown.
              </p>
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={costBreakdown.roomWiseCosts}
                onClick={(state: any) => {
                  const payload = state?.activePayload?.[0]?.payload;
                  if (payload?.roomId) setSelectedRoomId(payload.roomId);
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E6EB" vertical={false} />
                <XAxis dataKey="roomName" tick={{ fontSize: 11, fill: '#777B87' }} />
                <YAxis tick={{ fontSize: 11, fill: '#777B87' }} />
                <Tooltip
                  formatter={(val: any) => formatCurrency(Number(val), currency)}
                  contentStyle={{ borderColor: '#E5E6EB', fontSize: 12 }}
                />
                <Bar dataKey="totalCost" name="Room Cost" radius={[4, 4, 0, 0]} cursor="pointer">
                  {costBreakdown.roomWiseCosts.map((entry) => (
                    <Cell
                      key={entry.roomId}
                      fill={
                        activeRoomDetail?.roomId === entry.roomId ? '#172D9B' : '#3049F5'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Selected Room Drilldown Card */}
        <Card className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#E5E6EB] pb-2.5">
            <div>
              <h2 className="text-sm font-semibold text-[#171923]">
                {activeRoomDetail.roomName} Breakdown
              </h2>
              <p className="text-xs text-[#777B87] font-mono-num">
                {formatArea(activeRoomDetail.areaSqm)} · Floor {activeRoomDetail.floor}
              </p>
            </div>
            <Calculator size={16} className="text-[#3049F5]" />
          </div>

          <div className="space-y-2 text-xs">
            {[
              { label: 'Structural Shell & Masonry', val: activeRoomDetail.structuralCost },
              { label: 'Materials Subtotal', val: activeRoomDetail.materialCost },
              { label: 'Skilled Labour Subtotal', val: activeRoomDetail.labourCost },
              { label: 'Electrical & Wiring', val: activeRoomDetail.electricalCost },
              { label: 'Plumbing & Sanitary', val: activeRoomDetail.plumbingCost },
              { label: 'Interior & Finishes', val: activeRoomDetail.interiorCost },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between py-1 border-b border-[#E5E6EB]/60">
                <span className="text-[#777B87]">{row.label}</span>
                <span className="font-mono-num font-medium text-[#171923]">
                  {formatCurrency(row.val, currency)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 text-sm font-semibold">
              <span>Room Total</span>
              <span className="font-mono-num text-[#3049F5]">
                {formatCurrency(activeRoomDetail.totalCost, currency)}
              </span>
            </div>
          </div>
        </Card>

        {/* Material Cost Distribution */}
        <Card className="lg:col-span-4">
          <h2 className="text-sm font-semibold text-[#171923] mb-2">
            Material Cost Distribution
          </h2>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={costBreakdown.materialDistribution}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={82}
                  onClick={(d: any) => setSelectedCategory(d.category)}
                >
                  {costBreakdown.materialDistribution.map((_, idx) => (
                    <Cell key={idx} fill={CHART_BLUES[idx % CHART_BLUES.length]} cursor="pointer" />
                  ))}
                </Pie>
                <Tooltip formatter={(val: any) => formatCurrency(Number(val), currency)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 text-[11px] mt-1">
            {costBreakdown.materialDistribution.map((m, idx) => (
              <div
                key={m.category}
                onClick={() => setSelectedCategory(m.category)}
                className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer ${
                  selectedCategory === m.category ? 'bg-[#EEF1FF]' : 'hover:bg-[#F1F0EC]/50'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: CHART_BLUES[idx % CHART_BLUES.length] }}
                  />
                  <span className="truncate">{m.category}</span>
                </div>
                <span className="font-mono-num text-[#171923]">{m.percentage}%</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Labour Cost Distribution */}
        <Card className="lg:col-span-4">
          <h2 className="text-sm font-semibold text-[#171923] mb-2">
            Labour Cost Distribution
          </h2>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costBreakdown.labourDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E6EB" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#777B87' }} />
                <YAxis
                  dataKey="trade"
                  type="category"
                  width={120}
                  tick={{ fontSize: 10, fill: '#171923' }}
                />
                <Tooltip formatter={(val: any) => formatCurrency(Number(val), currency)} />
                <Bar dataKey="amount" fill="#3049F5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Budget Distribution */}
        <Card className="lg:col-span-4">
          <h2 className="text-sm font-semibold text-[#171923] mb-2">
            Budget Distribution by System
          </h2>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costBreakdown.budgetDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E6EB" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#777B87' }} />
                <YAxis tick={{ fontSize: 10, fill: '#777B87' }} />
                <Tooltip formatter={(val: any) => formatCurrency(Number(val), currency)} />
                <Bar dataKey="amount" fill="#5369FF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Weekly Construction Expenditure */}
        <Card className="lg:col-span-6">
          <h2 className="text-sm font-semibold text-[#171923] mb-2">
            Weekly Construction Expenditure (16-Week S-Curve)
          </h2>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={costBreakdown.weeklyExpenditure}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E6EB" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#777B87' }} />
                <YAxis tick={{ fontSize: 11, fill: '#777B87' }} />
                <Tooltip formatter={(val: any) => formatCurrency(Number(val), currency)} />
                <Area
                  type="monotone"
                  dataKey="planned"
                  name="Weekly Spend"
                  stroke="#3049F5"
                  fill="#EEF1FF"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Monthly Cash-Flow Projection */}
        <Card className="lg:col-span-6">
          <h2 className="text-sm font-semibold text-[#171923] mb-2">
            Monthly Cash-Flow Projection (12 Months)
          </h2>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costBreakdown.monthlyCashFlow}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E6EB" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#777B87' }} />
                <YAxis tick={{ fontSize: 11, fill: '#777B87' }} />
                <Tooltip formatter={(val: any) => formatCurrency(Number(val), currency)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="material" stackId="a" fill="#172D9B" name="Materials" />
                <Bar dataKey="labour" stackId="a" fill="#3049F5" name="Labour" />
                <Bar dataKey="mep" stackId="a" fill="#5369FF" name="MEP" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Yearly Maintenance & Lifecycle Projection */}
        <Card className="lg:col-span-12">
          <h2 className="text-sm font-semibold text-[#171923] mb-2">
            5-Year Maintenance & Lifecycle Cost Projection
          </h2>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costBreakdown.yearlyMaintenance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E6EB" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#777B87' }} />
                <YAxis tick={{ fontSize: 11, fill: '#777B87' }} />
                <Tooltip formatter={(val: any) => formatCurrency(Number(val), currency)} />
                <Bar dataKey="maintenance" name="Annual Maintenance" fill="#3049F5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Full BOQ Room Table */}
      <Card padding="p-0">
        <div className="px-5 py-3.5 border-b border-[#E5E6EB]">
          <h2 className="text-sm font-semibold text-[#171923]">
            Detailed Room-by-Room Cost Schedule
          </h2>
        </div>
        <DataTable
          rows={costBreakdown.roomWiseCosts}
          onRowClick={(r) => setSelectedRoomId(r.roomId)}
          columns={[
            { key: 'name', header: 'Room', render: (r) => <span className="font-medium text-xs">{r.roomName}</span> },
            { key: 'area', header: 'Area', align: 'right', render: (r) => <span className="font-mono-num text-xs">{formatArea(r.areaSqm)}</span> },
            { key: 'mat', header: 'Materials', align: 'right', render: (r) => <span className="font-mono-num text-xs">{formatCurrency(r.materialCost, currency)}</span> },
            { key: 'lab', header: 'Labour', align: 'right', render: (r) => <span className="font-mono-num text-xs">{formatCurrency(r.labourCost, currency)}</span> },
            { key: 'elec', header: 'Electrical', align: 'right', render: (r) => <span className="font-mono-num text-xs">{formatCurrency(r.electricalCost, currency)}</span> },
            { key: 'plumb', header: 'Plumbing', align: 'right', render: (r) => <span className="font-mono-num text-xs">{formatCurrency(r.plumbingCost, currency)}</span> },
            { key: 'total', header: 'Total', align: 'right', render: (r) => <span className="font-mono-num text-xs font-semibold text-[#3049F5]">{formatCurrency(r.totalCost, currency)}</span> },
          ]}
        />
      </Card>
    </div>
  );
}
