import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Plus,
  PlusSquare,
  Save,
  Trash2,
} from 'lucide-react';
import type {
  ActiveRoute,
  CostBreakdownResult,
  FuturePlanPayload,
  ProjectRecord,
} from '../../types/app';
import { formatArea, formatCurrency } from '../../types/app';
import { Button, Card, EmptyState, SelectField } from '../ui/Primitives';
import { HouseThreeCanvas } from '../studio3d/HouseThreeCanvas';

const ADDITION_TEMPLATES: Array<{
  type: FuturePlanPayload['additions'][number]['type'];
  label: string;
  width: number;
  depth: number;
  height: number;
  costPerSqm: number;
}> = [
  { type: 'additional_bedroom', label: 'Additional Bedroom', width: 4.0, depth: 3.6, height: 3.0, costPerSqm: 1150 },
  { type: 'living_expansion', label: 'Living Room Expansion', width: 4.5, depth: 3.0, height: 3.0, costPerSqm: 1080 },
  { type: 'kitchen_expansion', label: 'Kitchen Expansion', width: 3.6, depth: 2.8, height: 3.0, costPerSqm: 1380 },
  { type: 'attached_bathroom', label: 'Attached Bathroom', width: 2.6, depth: 2.2, height: 3.0, costPerSqm: 1620 },
  { type: 'balcony', label: 'Cantilevered Balcony', width: 3.8, depth: 1.8, height: 1.2, costPerSqm: 740 },
  { type: 'study_room', label: 'Study Room', width: 3.2, depth: 3.0, height: 3.0, costPerSqm: 1120 },
  { type: 'home_office', label: 'Home Office Studio', width: 3.8, depth: 3.2, height: 3.0, costPerSqm: 1210 },
  { type: 'storage_room', label: 'Storage Room', width: 2.4, depth: 2.0, height: 2.8, costPerSqm: 820 },
  { type: 'parking_space', label: 'Covered Parking Bay', width: 5.5, depth: 3.2, height: 2.8, costPerSqm: 620 },
  { type: 'additional_floor', label: 'Additional Upper Floor Suite', width: 7.5, depth: 5.5, height: 3.0, costPerSqm: 1340 },
];

export function FuturePlanningWorkspace({
  projects,
  activeProject,
  costBreakdown,
  onSelectProject,
  onSaveFuturePlan,
  onNavigate,
}: {
  projects: ProjectRecord[];
  activeProject: ProjectRecord | null;
  costBreakdown: CostBreakdownResult | null;
  onSelectProject: (id: number) => void;
  onSaveFuturePlan: (projectId: number, plan: FuturePlanPayload) => Promise<void>;
  onNavigate: (route: ActiveRoute) => void;
}) {
  const [viewModeCompare, setViewModeCompare] = useState<'proposed' | 'original'>('proposed');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!activeProject || !activeProject.analysisData || activeProject.analysisData.rooms.length === 0) {
    return (
      <EmptyState
        icon={<PlusSquare size={22} />}
        title="Analyze a Blueprint First"
        description="Future House Planning builds conceptual expansions directly onto your analyzed 3D house footprint."
        action={
          <Button onClick={() => onNavigate('upload_blueprint')}>
            Upload Blueprint
          </Button>
        }
      />
    );
  }

  const analysis = activeProject.analysisData;
  const currentPlan: FuturePlanPayload = activeProject.futurePlanData || {
    additions: [],
    structuralDisclaimer:
      'All proposed expansions, cantilevered balconies, and upper floor additions are conceptual massing studies until reviewed and engineered by a licensed structural engineer.',
    updatedAt: new Date().toISOString(),
  };

  const currency = costBreakdown?.currency || activeProject.currency || 'USD';
  const maxX = Math.max(...analysis.rooms.map((r) => r.x + r.width));
  const minZ = Math.min(...analysis.rooms.map((r) => r.z));
  const minX = Math.min(...analysis.rooms.map((r) => r.x));

  const addModule = async (tpl: (typeof ADDITION_TEMPLATES)[number]) => {
    const idx = currentPlan.additions.length;
    const isUpper = tpl.type === 'additional_floor' || tpl.type === 'balcony';
    const nextAddition: FuturePlanPayload['additions'][number] = {
      id: `add-${Date.now()}`,
      type: tpl.type,
      label: tpl.label,
      floor: isUpper ? Math.max(2, analysis.floors + (tpl.type === 'additional_floor' ? 1 : 0)) : 1,
      areaSqm: Number((tpl.width * tpl.depth).toFixed(2)),
      estimatedCost: Math.round(tpl.width * tpl.depth * tpl.costPerSqm),
      x: isUpper ? minX : maxX + 0.15,
      z: isUpper ? minZ : minZ + (idx % 3) * 3.4,
      width: tpl.width,
      depth: tpl.depth,
      height: tpl.height,
    };

    const nextPlan: FuturePlanPayload = {
      ...currentPlan,
      additions: [...currentPlan.additions, nextAddition],
      updatedAt: new Date().toISOString(),
    };
    setActionError(null);
    setSaving(true);
    try {
      await onSaveFuturePlan(activeProject.id, nextPlan);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to add expansion module.');
    } finally {
      setSaving(false);
    }
  };

  const removeAddition = async (id: string) => {
    const nextPlan: FuturePlanPayload = {
      ...currentPlan,
      additions: currentPlan.additions.filter((a) => a.id !== id),
      updatedAt: new Date().toISOString(),
    };
    setActionError(null);
    setSaving(true);
    try {
      await onSaveFuturePlan(activeProject.id, nextPlan);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to remove expansion module.');
    } finally {
      setSaving(false);
    }
  };

  const addedArea = currentPlan.additions.reduce((s, a) => s + a.areaSqm, 0);
  const addedCost = currentPlan.additions.reduce((s, a) => s + a.estimatedCost, 0);
  const originalCost = costBreakdown?.totalHouseCost || activeProject.estimatedCost || 0;
  const revisedCost = originalCost + addedCost;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-[#171923]">
            Future House Planning
          </h1>
          <p className="text-xs text-[#777B87] mt-0.5">
            Explore modular rooms, extensions, balconies, and additional floors over your existing 3D model.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
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

      {/* Mandatory Structural Engineering Disclaimer */}
      <div className="flex items-start gap-2.5 px-4 py-2.5 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E]">
        <AlertTriangle size={15} className="text-[#E8A13A] shrink-0 mt-0.5" />
        <span>
          <strong>Conceptual Planning Only:</strong> Any structural additions, load-bearing wall removals, cantilevers, or upper-story expansions are conceptual until inspected and stamped by a qualified structural engineer.
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT: Addition Catalog */}
        <Card className="lg:col-span-4 space-y-3">
          <h2 className="text-xs font-semibold text-[#171923]">
            Possible House Additions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 max-h-[500px] overflow-y-auto pr-1">
            {ADDITION_TEMPLATES.map((tpl) => (
              <button
                key={tpl.type}
                type="button"
                disabled={saving}
                onClick={() => addModule(tpl)}
                className="flex items-center justify-between p-2.5 rounded-lg border border-[#E5E6EB] bg-white hover:bg-[#EEF1FF]/70 hover:border-[#3049F5]/50 text-left transition-colors cursor-pointer"
              >
                <div>
                  <p className="text-xs font-medium text-[#171923]">{tpl.label}</p>
                  <p className="text-[11px] text-[#777B87] font-mono-num">
                    +{(tpl.width * tpl.depth).toFixed(1)} m² · Est.{' '}
                    {formatCurrency(tpl.width * tpl.depth * tpl.costPerSqm, currency)}
                  </p>
                </div>
                <Plus size={15} className="text-[#3049F5] shrink-0" />
              </button>
            ))}
          </div>
        </Card>

        {/* CENTER & RIGHT: 3D Preview + Before/After Comparison */}
        <div className="lg:col-span-8 space-y-4">
          <Card padding="p-0" className="overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#E5E6EB] flex flex-wrap items-center justify-between gap-2 bg-white">
              <div className="flex items-center gap-1 p-1 bg-[#F1F0EC] rounded-lg border border-[#E5E6EB]">
                <button
                  type="button"
                  onClick={() => setViewModeCompare('original')}
                  className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                    viewModeCompare === 'original'
                      ? 'bg-white text-[#3049F5] border border-[#E5E6EB]'
                      : 'text-[#777B87]'
                  }`}
                >
                  Original 3D House
                </button>
                <button
                  type="button"
                  onClick={() => setViewModeCompare('proposed')}
                  className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                    viewModeCompare === 'proposed'
                      ? 'bg-white text-[#3049F5] border border-[#E5E6EB]'
                      : 'text-[#777B87]'
                  }`}
                >
                  Proposed Modified 3D House
                </button>
              </div>
              <span className="text-[11px] text-[#777B87]">
                Royal-blue translucent volumes indicate proposed extensions
              </span>
            </div>

            <div className="h-[420px] bg-[#F7F6F2]">
              <HouseThreeCanvas
                analysis={analysis}
                futurePlan={viewModeCompare === 'proposed' ? currentPlan : null}
                selectedFloor="all"
                selectedRoomId={null}
                cameraPreset="iso"
                viewMode={viewModeCompare === 'proposed' ? 'future' : 'architectural'}
                showWalls={true}
                showCeilings={false}
                showFurniture={true}
              />
            </div>
          </Card>

          {/* Before & After Quantitative Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <span className="text-xs text-[#777B87]">Built-up Area Change</span>
              <div className="flex items-baseline gap-2 mt-2 font-mono-num">
                <span className="text-sm text-[#777B87]">
                  {formatArea(analysis.totalAreaSqm)}
                </span>
                <ArrowRight size={13} className="text-[#3049F5]" />
                <span className="text-lg font-semibold text-[#171923]">
                  {formatArea(analysis.totalAreaSqm + addedArea)}
                </span>
              </div>
              <p className="text-xs text-[#249B67] mt-1 font-mono-num">
                +{formatArea(addedArea)} added
              </p>
            </Card>

            <Card>
              <span className="text-xs text-[#777B87]">Revised Construction Estimate</span>
              <div className="flex items-baseline gap-2 mt-2 font-mono-num">
                <span className="text-sm text-[#777B87]">
                  {formatCurrency(originalCost, currency)}
                </span>
                <ArrowRight size={13} className="text-[#3049F5]" />
                <span className="text-lg font-semibold text-[#3049F5]">
                  {formatCurrency(revisedCost, currency)}
                </span>
              </div>
              <p className="text-xs text-[#777B87] mt-1 font-mono-num">
                +{formatCurrency(addedCost, currency)} addition budget
              </p>
            </Card>

            <Card>
              <span className="text-xs text-[#777B87]">Material & Room Delta</span>
              <p className="font-mono-num text-lg font-semibold text-[#171923] mt-2">
                +{currentPlan.additions.length} Modules
              </p>
              <p className="text-xs text-[#777B87] mt-1">
                {currentPlan.additions.some((a) => a.floor > 1)
                  ? 'Includes upper-level structural deck & stair tie-in'
                  : 'Single-level foundation extension'}
              </p>
            </Card>
          </div>

          {currentPlan.additions.length > 0 && (
            <Card padding="p-0">
              <div className="px-4 py-3 border-b border-[#E5E6EB] flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#171923]">
                  Planned Additions List ({currentPlan.additions.length})
                </h3>
                <span className="text-[11px] text-[#249B67] inline-flex items-center gap-1">
                  <Save size={12} /> Saved to project
                </span>
              </div>
              <div className="divide-y divide-[#E5E6EB]">
                {currentPlan.additions.map((add) => (
                  <div
                    key={add.id}
                    className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-medium text-[#171923]">{add.label}</p>
                      <p className="text-[11px] text-[#777B87] font-mono-num">
                        Floor {add.floor} · {add.width}m × {add.depth}m ({formatArea(add.areaSqm)})
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono-num font-semibold text-[#3049F5]">
                        +{formatCurrency(add.estimatedCost, currency)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAddition(add.id)}
                        aria-label={`Remove ${add.label}`}
                        className="p-1.5 text-[#777B87] hover:text-[#D94A50] cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
