import React, { useState } from 'react';
import {
  AlertTriangle,
  Box,
  Compass,
  Droplets,
  Eye,
  EyeOff,
  FileUp,
  Layers,
  PaintBucket,
  Plus,
  Save,
  Trash2,
  Zap,
} from 'lucide-react';
import type {
  ActiveRoute,
  BlueprintAnalysisPayload,
  CostBreakdownResult,
  InteriorVersion,
  ProjectRecord,
  RoomGeometry,
} from '../../types/app';
import { formatArea, formatCurrency, formatDimension } from '../../types/app';
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  InputField,
  SelectField,
  Tabs,
} from '../ui/Primitives';
import {
  HouseThreeCanvas,
  type StudioCameraPreset,
  type StudioViewMode,
} from './HouseThreeCanvas';

const PAINT_SWATCHES = [
  { name: 'Architectural White', hex: '#F7F7F4' },
  { name: 'Warm Linen', hex: '#EDEAE2' },
  { name: 'Sand Clay', hex: '#D8C3A5' },
  { name: 'Terracotta Mist', hex: '#D98A6C' },
  { name: 'Sage Olive', hex: '#9FB19E' },
  { name: 'Mist Blue', hex: '#C7D8F4' },
  { name: 'Slate Blue', hex: '#6B84A8' },
  { name: 'Cobalt Accent', hex: '#3049F5' },
  { name: 'Soft Lavender', hex: '#C7C2DC' },
  { name: 'Charcoal Slate', hex: '#464C59' },
];

const FLOOR_MATERIALS = [
  'Oak Hardwood',
  'Engineered Walnut',
  'Porcelain Tile',
  'Italian Marble',
  'Polished Concrete',
  'Terrazzo',
  'Acoustic Carpet',
];

const TILE_PATTERNS = ['Wide Plank', 'Large Format Grid', 'Herringbone', 'Monolithic Slab'];
const CEILING_STYLES = ['Flat Plaster', 'Recessed Cove', 'Acoustic Timber', 'Exposed Beam'];

const FURNITURE_CATALOG = [
  { item: 'sofa', label: '3-Seat Sofa', width: 2.1, depth: 0.9, height: 0.78, color: '#D8D6CF' },
  { item: 'coffee_table', label: 'Coffee Table', width: 1.1, depth: 0.6, height: 0.38, color: '#B49572' },
  { item: 'bed', label: 'Queen Bed', width: 1.65, depth: 2.05, height: 0.55, color: '#E8E6E0' },
  { item: 'dining_table', label: 'Dining Table', width: 1.6, depth: 0.95, height: 0.76, color: '#A58462' },
  { item: 'desk', label: 'Study Desk', width: 1.4, depth: 0.7, height: 0.75, color: '#A88968' },
  { item: 'wardrobe', label: 'Wardrobe', width: 0.6, depth: 1.8, height: 2.1, color: '#D2CFC7' },
];

export function Studio3DWorkspace({
  initialMode,
  projects,
  activeProject,
  costBreakdown,
  onSelectProject,
  onSaveProjectUpdates,
  onNavigate,
}: {
  initialMode: StudioViewMode | 'room_explorer';
  projects: ProjectRecord[];
  activeProject: ProjectRecord | null;
  costBreakdown: CostBreakdownResult | null;
  onSelectProject: (id: number) => void;
  onSaveProjectUpdates: (
    projectId: number,
    updates: {
      analysisData?: BlueprintAnalysisPayload;
      interiorVersions?: InteriorVersion[];
    }
  ) => Promise<void>;
  onNavigate: (route: ActiveRoute) => void;
}) {
  const mappedMode: StudioViewMode =
    initialMode === 'room_explorer' ? 'architectural' : initialMode;
  const [viewMode, setViewMode] = useState<StudioViewMode>(mappedMode);
  const [selectedFloor, setSelectedFloor] = useState<number | 'all'>('all');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [cameraPreset, setCameraPreset] = useState<StudioCameraPreset>('iso');
  const [showWalls, setShowWalls] = useState(true);
  const [showCeilings, setShowCeilings] = useState(false);
  const [showFurniture, setShowFurniture] = useState(true);
  const [compareAfter, setCompareAfter] = useState(true);
  const [versionName, setVersionName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [livePaintOverride, setLivePaintOverride] = useState<{
    roomId: string;
    color: string;
  } | null>(null);
  const colorSaveTimerRef = React.useRef<number | null>(null);

  // Keep viewMode synced when user switches sidebar item
  React.useEffect(() => {
    setViewMode(initialMode === 'room_explorer' ? 'architectural' : initialMode);
    if (initialMode === 'room_explorer') {
      setShowCeilings(false);
    }
  }, [initialMode]);

  React.useEffect(() => {
    setLivePaintOverride(null);
    if (colorSaveTimerRef.current) {
      window.clearTimeout(colorSaveTimerRef.current);
      colorSaveTimerRef.current = null;
    }
  }, [activeProject?.id]);

  React.useEffect(() => {
    return () => {
      if (colorSaveTimerRef.current) {
        window.clearTimeout(colorSaveTimerRef.current);
      }
    };
  }, []);

  const baseAnalysis = activeProject?.analysisData || null;
  const analysis = React.useMemo(() => {
    if (!baseAnalysis || !livePaintOverride) return baseAnalysis;
    return {
      ...baseAnalysis,
      rooms: baseAnalysis.rooms.map((r) =>
        r.id === livePaintOverride.roomId
          ? { ...r, wallColor: livePaintOverride.color }
          : r
      ),
    };
  }, [baseAnalysis, livePaintOverride]);

  const rooms = analysis?.rooms || [];
  const activeRoom =
    rooms.find((r) => r.id === selectedRoomId) || rooms[0] || null;

  const roomCost = costBreakdown?.roomWiseCosts.find(
    (rc) => rc.roomId === activeRoom?.id
  );

  if (!activeProject || !analysis || rooms.length === 0) {
    return (
      <EmptyState
        icon={<Box size={22} />}
        title="3D House Model Not Generated Yet"
        description="Upload and analyze a floor plan blueprint first. BUILDVISION AI generates real 3D architectural geometry directly from the detected rooms and openings."
        action={
          <Button onClick={() => onNavigate('upload_blueprint')}>
            <FileUp size={15} /> Upload Blueprint
          </Button>
        }
      />
    );
  }

  const persistRoomsUpdate = async (
    updatedRooms: RoomGeometry[],
    toastLabel?: string
  ) => {
    setSaveError(null);
    setSaving(true);
    try {
      await onSaveProjectUpdates(activeProject.id, {
        analysisData: { ...analysis, rooms: updatedRooms },
      });
      setLivePaintOverride(null);
      if (toastLabel) {
        setSavedToast(toastLabel);
        window.setTimeout(() => setSavedToast(null), 2200);
      }
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save room update.');
    } finally {
      setSaving(false);
    }
  };

  const updateRoomProperty = async (
    updater: (room: RoomGeometry) => RoomGeometry,
    toastLabel?: string
  ) => {
    if (!activeRoom) return;
    if (colorSaveTimerRef.current) {
      window.clearTimeout(colorSaveTimerRef.current);
      colorSaveTimerRef.current = null;
    }
    const updatedRooms = analysis.rooms.map((r) =>
      r.id === activeRoom.id ? updater(r) : r
    );
    await persistRoomsUpdate(updatedRooms, toastLabel);
  };

  const handleLiveColorChange = (hexColor: string) => {
    if (!activeRoom) return;
    const normalized = hexColor.toUpperCase();
    setLivePaintOverride({ roomId: activeRoom.id, color: normalized });
    if (colorSaveTimerRef.current) {
      window.clearTimeout(colorSaveTimerRef.current);
    }
    const roomIdTarget = activeRoom.id;
    const currentRooms = analysis.rooms;
    colorSaveTimerRef.current = window.setTimeout(() => {
      const updatedRooms = currentRooms.map((r) =>
        r.id === roomIdTarget ? { ...r, wallColor: normalized } : r
      );
      persistRoomsUpdate(updatedRooms, `Saved paint ${normalized}`);
    }, 260);
  };

  const handleApplyPaintToAllRooms = async (hexColor: string) => {
    const normalized = hexColor.toUpperCase();
    if (colorSaveTimerRef.current) {
      window.clearTimeout(colorSaveTimerRef.current);
      colorSaveTimerRef.current = null;
    }
    const updatedRooms = analysis.rooms.map((r) => ({
      ...r,
      wallColor: normalized,
    }));
    await persistRoomsUpdate(updatedRooms, `Applied ${normalized} to all rooms`);
  };

  const handleSaveInteriorVersion = async () => {
    const label = versionName.trim() || `Design Version ${(activeProject.interiorVersions?.length || 0) + 1}`;
    const roomOverrides: InteriorVersion['roomOverrides'] = {};
    analysis.rooms.forEach((r) => {
      roomOverrides[r.id] = {
        wallColor: r.wallColor,
        floorMaterial: r.floorMaterial,
        ceilingStyle: r.ceilingStyle,
        tilePattern: r.tilePattern,
        lightingWarmth: r.lightingWarmth,
        lightingIntensity: r.lightingIntensity,
        furniture: r.furniture,
      };
    });
    const newVersion: InteriorVersion = {
      id: `ver-${Date.now()}`,
      name: label,
      createdAt: new Date().toISOString(),
      roomOverrides,
    };
    setSaveError(null);
    setSaving(true);
    try {
      await onSaveProjectUpdates(activeProject.id, {
        interiorVersions: [newVersion, ...(activeProject.interiorVersions || [])],
      });
      setVersionName('');
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save design version.');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyVersion = async (ver: InteriorVersion) => {
    setSaveError(null);
    setSaving(true);
    try {
      const updatedRooms = analysis.rooms.map((r) => {
        const ov = ver.roomOverrides[r.id];
        return ov ? { ...r, ...ov } : r;
      });
      await onSaveProjectUpdates(activeProject.id, {
        analysisData: { ...analysis, rooms: updatedRooms },
      });
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to apply design version.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddFurniture = (presetKey: string) => {
    if (!activeRoom) return;
    const preset = FURNITURE_CATALOG.find((f) => f.item === presetKey);
    if (!preset) return;
    updateRoomProperty((r) => ({
      ...r,
      furniture: [
        ...(r.furniture || []),
        {
          id: `${r.id}-f-${Date.now()}`,
          item: preset.item,
          label: preset.label,
          x: Number((r.width / 2).toFixed(2)),
          z: Number((r.depth / 2).toFixed(2)),
          rotationY: 0,
          width: preset.width,
          depth: preset.depth,
          height: preset.height,
          color: preset.color,
        },
      ],
    }));
  };

  return (
    <div className="space-y-4">
      {/* Studio Mode Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-[#171923]">
            {viewMode === 'electrical'
              ? 'Electrical Layout Visualization'
              : viewMode === 'plumbing'
              ? 'Plumbing Layout Visualization'
              : viewMode === 'structural'
              ? 'Structural Frame View'
              : viewMode === 'interior'
              ? 'Interior Design Studio'
              : initialMode === 'room_explorer'
              ? '3D Room Explorer'
              : '3D House Studio'}
          </h1>
          <p className="text-xs text-[#777B87] mt-0.5">
            Click any room in the 3D viewport to inspect dimensions, customize finishes, and recalculate costs.
          </p>
        </div>

        <Tabs
          active={viewMode}
          onChange={setViewMode}
          items={[
            { key: 'architectural', label: '3D House', icon: <Box size={13} /> },
            { key: 'structural', label: 'Structural', icon: <Layers size={13} /> },
            { key: 'electrical', label: 'Electrical', icon: <Zap size={13} /> },
            { key: 'plumbing', label: 'Plumbing', icon: <Droplets size={13} /> },
            { key: 'interior', label: 'Interior Design', icon: <PaintBucket size={13} /> },
          ]}
        />
      </div>

      {saveError && (
        <div className="px-4 py-2 text-xs text-[#D94A50] bg-[#FEF2F2] border border-[#FECACA] rounded-lg">
          {saveError}
        </div>
      )}

      {/* Preliminary Planning Disclaimer for MEP & Structural */}
      {(viewMode === 'electrical' || viewMode === 'plumbing' || viewMode === 'structural') && (
        <div className="flex items-start gap-2.5 px-4 py-2.5 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E]">
          <AlertTriangle size={15} className="text-[#E8A13A] shrink-0 mt-0.5" />
          <span>
            Preliminary planning visualization generated from spatial room analysis. All{' '}
            {viewMode} routes, load capacities, and structural member sizes must be reviewed and certified by qualified licensed engineers before construction.
          </span>
        </div>
      )}

      {/* 3-PANEL STUDIO LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT SIDEBAR: Project, Floor, Room List, Layer Controls */}
        <Card className="lg:col-span-3 space-y-4">
          <SelectField
            label="Project"
            value={activeProject.id}
            onChange={(e) => onSelectProject(Number(e.target.value))}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>

          <div>
            <label className="block text-xs font-semibold text-[#171923] mb-1.5">
              Floor Selection
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedFloor('all')}
                className={`px-2.5 py-1 text-xs rounded-md border cursor-pointer ${
                  selectedFloor === 'all'
                    ? 'bg-[#EEF1FF] border-[#3049F5] text-[#172D9B] font-medium'
                    : 'bg-white border-[#E5E6EB] text-[#777B87]'
                }`}
              >
                All Floors
              </button>
              {Array.from({ length: Math.max(1, analysis.floors) }, (_, i) => i + 1).map(
                (f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setSelectedFloor(f)}
                    className={`px-2.5 py-1 text-xs rounded-md border cursor-pointer ${
                      selectedFloor === f
                        ? 'bg-[#EEF1FF] border-[#3049F5] text-[#172D9B] font-medium'
                        : 'bg-white border-[#E5E6EB] text-[#777B87]'
                    }`}
                  >
                    Floor {f}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="border-t border-[#E5E6EB] pt-3">
            <h2 className="text-xs font-semibold text-[#171923] mb-2">
              Rooms ({rooms.length})
            </h2>
            <div className="max-h-52 overflow-y-auto divide-y divide-[#E5E6EB] border border-[#E5E6EB] rounded-lg">
              {rooms.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRoomId(r.id)}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs cursor-pointer ${
                    activeRoom?.id === r.id
                      ? 'bg-[#EEF1FF] text-[#172D9B] font-medium'
                      : 'bg-white text-[#171923] hover:bg-[#F1F0EC]/50'
                  }`}
                >
                  <span className="truncate">{r.name}</span>
                  <span className="font-mono-num text-[11px] text-[#777B87]">
                    {r.areaSqm.toFixed(1)} m²
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[#E5E6EB] pt-3 space-y-2">
            <h2 className="text-xs font-semibold text-[#171923]">Studio Layers</h2>
            {[
              { label: 'Show Walls', val: showWalls, set: setShowWalls },
              { label: 'Show Ceilings / Roof', val: showCeilings, set: setShowCeilings },
              { label: 'Show Interior Furniture', val: showFurniture, set: setShowFurniture },
            ].map((item) => (
              <label
                key={item.label}
                className="flex items-center justify-between text-xs text-[#171923] cursor-pointer"
              >
                <span>{item.label}</span>
                <input
                  type="checkbox"
                  checked={item.val}
                  onChange={(e) => item.set(e.target.checked)}
                  className="h-4 w-4 rounded border-[#E5E6EB] text-[#3049F5]"
                />
              </label>
            ))}
          </div>

          {viewMode === 'interior' && (
            <div className="border-t border-[#E5E6EB] pt-3 space-y-2.5">
              <h2 className="text-xs font-semibold text-[#171923]">Design Versions</h2>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={versionName}
                  onChange={(e) => setVersionName(e.target.value)}
                  placeholder="Version name..."
                  className="flex-1 h-8 px-2.5 text-xs border border-[#E5E6EB] rounded-md"
                />
                <Button size="sm" onClick={handleSaveInteriorVersion} disabled={saving}>
                  <Save size={13} />
                </Button>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {(activeProject.interiorVersions || []).map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleApplyVersion(v)}
                    className="w-full text-left px-2.5 py-1.5 text-xs rounded border border-[#E5E6EB] hover:bg-[#EEF1FF] flex items-center justify-between cursor-pointer"
                  >
                    <span className="truncate font-medium">{v.name}</span>
                    <span className="text-[10px] text-[#3049F5]">Load</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* CENTER PANEL: Interactive 3D Viewport */}
        <div className="lg:col-span-6 space-y-4">
          <Card padding="p-0" className="overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#E5E6EB] bg-white flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    { key: 'iso', label: 'Isometric' },
                    { key: 'top', label: 'Top' },
                    { key: 'front', label: 'Front' },
                    { key: 'side', label: 'Side' },
                    { key: 'first_person', label: 'Walkthrough' },
                  ] as Array<{ key: StudioCameraPreset; label: string }>
                ).map((cam) => (
                  <button
                    key={cam.key}
                    type="button"
                    onClick={() => setCameraPreset(cam.key)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                      cameraPreset === cam.key
                        ? 'bg-[#EEF1FF] text-[#3049F5]'
                        : 'text-[#777B87] hover:text-[#171923] hover:bg-[#F1F0EC]'
                    }`}
                  >
                    {cam.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {viewMode === 'interior' && (
                  <button
                    type="button"
                    onClick={() => setCompareAfter((c) => !c)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-[#E5E6EB] bg-white hover:bg-[#F1F0EC] cursor-pointer"
                  >
                    {compareAfter ? <Eye size={13} className="text-[#3049F5]" /> : <EyeOff size={13} />}
                    <span>{compareAfter ? 'After Design' : 'Before (Shell)'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowWalls((w) => !w)}
                  className="px-2.5 py-1 text-xs rounded-md border border-[#E5E6EB] bg-white hover:bg-[#F1F0EC] cursor-pointer"
                >
                  {showWalls ? 'Hide Walls' : 'Show Walls'}
                </button>
              </div>
            </div>

            <div className="h-[520px] relative bg-[#F7F6F2]">
              <HouseThreeCanvas
                analysis={analysis}
                selectedFloor={selectedFloor}
                selectedRoomId={activeRoom?.id || null}
                onSelectRoom={setSelectedRoomId}
                cameraPreset={cameraPreset}
                viewMode={viewMode}
                showWalls={showWalls}
                showCeilings={showCeilings}
                showFurniture={showFurniture}
                compareAfterInterior={viewMode !== 'interior' || compareAfter}
              />
            </div>

            <div className="px-4 py-2 border-t border-[#E5E6EB] bg-white flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#777B87]">
              <span>
                Drag to orbit · Scroll to zoom · Right-drag to pan · WASD keys to walk
              </span>
              {viewMode === 'electrical' && (
                <span>Blue: Lighting Conduit · Amber: Power Sockets · Navy: Main DB</span>
              )}
              {viewMode === 'plumbing' && (
                <span>Blue: Cold Supply · Red: Hot Water · Green: Drainage DWV</span>
              )}
            </div>
          </Card>

          {/* MEP Schedule Tables below 3D viewport when in Electrical or Plumbing mode */}
          {viewMode === 'electrical' && costBreakdown && (
            <Card padding="p-0">
              <div className="px-4 py-3 border-b border-[#E5E6EB] flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#171923]">
                  Electrical Circuit & Quantity Schedule
                </h3>
                <span className="font-mono-num text-xs font-semibold text-[#3049F5]">
                  Est. Electrical Cost: {formatCurrency(costBreakdown.electricalCost, costBreakdown.currency)}
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-4 border-b border-[#E5E6EB] text-xs font-mono-num">
                <div><span className="text-[#777B87] block">Lights</span><strong>{costBreakdown.electricalQuantities.totalLights}</strong></div>
                <div><span className="text-[#777B87] block">Fans</span><strong>{costBreakdown.electricalQuantities.totalFans}</strong></div>
                <div><span className="text-[#777B87] block">Sockets</span><strong>{costBreakdown.electricalQuantities.totalSockets}</strong></div>
                <div><span className="text-[#777B87] block">Switches</span><strong>{costBreakdown.electricalQuantities.totalSwitches}</strong></div>
                <div><span className="text-[#777B87] block">AC Pts</span><strong>{costBreakdown.electricalQuantities.totalAcPoints}</strong></div>
                <div><span className="text-[#777B87] block">Wire Est.</span><strong>{costBreakdown.electricalQuantities.estimatedCableM} m</strong></div>
              </div>
              <DataTable
                rows={analysis.electricalSummary?.circuits || []}
                emptyMessage="No circuits extracted."
                columns={[
                  { key: 'name', header: 'Circuit Name', render: (c) => <span className="text-xs font-medium">{c.name}</span> },
                  { key: 'amps', header: 'Breaker', align: 'right', render: (c) => <span className="font-mono-num text-xs">{c.breakerAmps} A</span> },
                  { key: 'rooms', header: 'Served Rooms', render: (c) => <span className="text-xs text-[#777B87]">{c.rooms.join(', ')}</span> },
                  { key: 'wire', header: 'Est. Cable', align: 'right', render: (c) => <span className="font-mono-num text-xs">{c.estimatedWireM} m</span> },
                ]}
              />
            </Card>
          )}

          {viewMode === 'plumbing' && costBreakdown && (
            <Card padding="p-0">
              <div className="px-4 py-3 border-b border-[#E5E6EB] flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#171923]">
                  Plumbing Supply, Drainage & Fixture Quantities
                </h3>
                <span className="font-mono-num text-xs font-semibold text-[#3049F5]">
                  Est. Plumbing Cost: {formatCurrency(costBreakdown.plumbingCost, costBreakdown.currency)}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 text-xs font-mono-num">
                <div><span className="text-[#777B87] block">Cold Supply Pipe</span><strong>{costBreakdown.plumbingQuantities.supplyPipeM} m</strong></div>
                <div><span className="text-[#777B87] block">Hot Water Pipe</span><strong>{costBreakdown.plumbingQuantities.hotWaterPipeM} m</strong></div>
                <div><span className="text-[#777B87] block">Drainage DWV Pipe</span><strong>{costBreakdown.plumbingQuantities.drainagePipeM} m</strong></div>
                <div><span className="text-[#777B87] block">Control Valves</span><strong>{costBreakdown.plumbingQuantities.valvesCount} units</strong></div>
              </div>
            </Card>
          )}
        </div>

        {/* RIGHT PANEL: Selected Room Properties, Materials, Furniture & Cost */}
        <Card className="lg:col-span-3 space-y-4">
          {activeRoom ? (
            <>
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#E5E6EB]">
                <div>
                  <h2 className="text-sm font-semibold text-[#171923]">{activeRoom.name}</h2>
                  <p className="text-xs text-[#777B87] capitalize mt-0.5">
                    {activeRoom.type} · Floor {activeRoom.floor}
                  </p>
                </div>
                {roomCost && (
                  <div className="text-right">
                    <span className="text-[11px] text-[#777B87] block">Est. Room Cost</span>
                    <span className="font-mono-num text-sm font-semibold text-[#3049F5]">
                      {formatCurrency(roomCost.totalCost, costBreakdown?.currency)}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs font-mono-num bg-[#F1F0EC]/60 p-2.5 rounded-lg border border-[#E5E6EB]">
                <div>
                  <span className="text-[#777B87] text-[10px] block">Dimensions</span>
                  <strong>
                    {formatDimension(activeRoom.width)} × {formatDimension(activeRoom.depth)}
                  </strong>
                </div>
                <div>
                  <span className="text-[#777B87] text-[10px] block">Area</span>
                  <strong>{formatArea(activeRoom.areaSqm)}</strong>
                </div>
                <div>
                  <span className="text-[#777B87] text-[10px] block">Ceiling</span>
                  <strong>{formatDimension(activeRoom.height)}</strong>
                </div>
              </div>

              {/* Wall Paint Palette & Custom HEX */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-semibold text-[#171923]">
                    Wall Paint Finish
                  </label>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      handleApplyPaintToAllRooms(
                        /^#[0-9a-fA-F]{6}$/.test(activeRoom.wallColor || '')
                          ? activeRoom.wallColor
                          : '#F7F7F4'
                      )
                    }
                    className="text-[11px] font-medium text-[#3049F5] hover:text-[#172D9B] cursor-pointer disabled:opacity-50"
                  >
                    Apply to All Rooms
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {PAINT_SWATCHES.map((sw) => {
                    const activeHex = (activeRoom.wallColor || '#F7F7F4').toUpperCase();
                    return (
                      <button
                        key={sw.hex}
                        type="button"
                        title={sw.name}
                        onClick={() =>
                          updateRoomProperty(
                            (r) => ({ ...r, wallColor: sw.hex }),
                            `Saved paint ${sw.name}`
                          )
                        }
                        className={`w-7 h-7 rounded-md border cursor-pointer transition-transform hover:scale-105 ${
                          activeHex === sw.hex.toUpperCase()
                            ? 'border-[#3049F5] ring-2 ring-[#EEF1FF]'
                            : 'border-[#E5E6EB]'
                        }`}
                        style={{ backgroundColor: sw.hex }}
                      />
                    );
                  })}
                  <input
                    type="color"
                    aria-label="Custom wall HEX color"
                    value={
                      /^#[0-9a-fA-F]{6}$/.test(activeRoom.wallColor || '')
                        ? activeRoom.wallColor
                        : '#F7F7F4'
                    }
                    onChange={(e) => handleLiveColorChange(e.target.value)}
                    className="w-7 h-7 p-0.5 border border-[#E5E6EB] rounded-md cursor-pointer bg-white"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 font-mono-num text-[#777B87]">
                    <span
                      className="inline-block w-3 h-3 rounded-xs border border-[#E5E6EB]"
                      style={{ backgroundColor: activeRoom.wallColor || '#F7F7F4' }}
                    />
                    <span>
                      Active: {(activeRoom.wallColor || '#F7F7F4').toUpperCase()}
                    </span>
                  </div>
                  {saving ? (
                    <span className="text-[#3049F5]">Saving...</span>
                  ) : savedToast ? (
                    <span className="text-[#249B67] font-medium">{savedToast}</span>
                  ) : null}
                </div>
              </div>

              {/* Flooring & Tile Pattern */}
              <SelectField
                label="Flooring Material"
                value={activeRoom.floorMaterial}
                onChange={(e) =>
                  updateRoomProperty((r) => ({ ...r, floorMaterial: e.target.value }))
                }
              >
                {FLOOR_MATERIALS.map((mat) => (
                  <option key={mat} value={mat}>
                    {mat}
                  </option>
                ))}
              </SelectField>

              <div className="grid grid-cols-2 gap-2">
                <SelectField
                  label="Tile / Plank Pattern"
                  value={activeRoom.tilePattern || 'Wide Plank'}
                  onChange={(e) =>
                    updateRoomProperty((r) => ({ ...r, tilePattern: e.target.value }))
                  }
                >
                  {TILE_PATTERNS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Ceiling Design"
                  value={activeRoom.ceilingStyle}
                  onChange={(e) =>
                    updateRoomProperty((r) => ({ ...r, ceilingStyle: e.target.value }))
                  }
                >
                  {CEILING_STYLES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </SelectField>
              </div>

              {/* Furniture Placement */}
              <div className="border-t border-[#E5E6EB] pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#171923]">
                    Furniture ({activeRoom.furniture?.length || 0})
                  </label>
                  <select
                    aria-label="Add furniture item"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddFurniture(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="h-7 px-2 text-xs border border-[#E5E6EB] rounded-md bg-white text-[#3049F5]"
                  >
                    <option value="">+ Add Furniture</option>
                    {FURNITURE_CATALOG.map((item) => (
                      <option key={item.item} value={item.item}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {(activeRoom.furniture || []).map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-[#F1F0EC]/50 border border-[#E5E6EB] rounded-md text-xs"
                    >
                      <span className="truncate font-medium">{f.label}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            updateRoomProperty((r) => ({
                              ...r,
                              furniture: r.furniture.map((item) =>
                                item.id === f.id
                                  ? { ...item, rotationY: (item.rotationY || 0) + Math.PI / 4 }
                                  : item
                              ),
                            }))
                          }
                          className="px-1.5 py-0.5 text-[10px] border border-[#E5E6EB] bg-white rounded hover:bg-[#EEF1FF] cursor-pointer"
                        >
                          Rotate
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateRoomProperty((r) => ({
                              ...r,
                              furniture: r.furniture.filter((item) => item.id !== f.id),
                            }))
                          }
                          aria-label={`Remove ${f.label}`}
                          className="p-1 text-[#777B87] hover:text-[#D94A50] cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Electrical & Plumbing Quick Summary */}
              <div className="border-t border-[#E5E6EB] pt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-lg border border-[#E5E6EB] bg-white">
                  <div className="flex items-center gap-1 font-semibold text-[#171923] mb-1">
                    <Zap size={12} className="text-[#3049F5]" /> Electrical
                  </div>
                  <p className="text-[#777B87] font-mono-num">
                    {activeRoom.electrical?.lights || 0} lights · {activeRoom.electrical?.sockets || 0} sockets · {activeRoom.electrical?.switches || 0} switches
                  </p>
                </div>
                <div className="p-2.5 rounded-lg border border-[#E5E6EB] bg-white">
                  <div className="flex items-center gap-1 font-semibold text-[#171923] mb-1">
                    <Droplets size={12} className="text-[#3049F5]" /> Plumbing
                  </div>
                  <p className="text-[#777B87] font-mono-num">
                    {activeRoom.plumbing?.coldOutlets || 0} cold · {activeRoom.plumbing?.hotOutlets || 0} hot · {activeRoom.plumbing?.drainPoints || 0} drains
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs text-[#777B87]">
              <Compass size={15} className="text-[#3049F5]" />
              <span>Select a room to inspect properties.</span>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
