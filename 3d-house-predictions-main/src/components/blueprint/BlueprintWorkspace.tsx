import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Box,
  CheckCircle2,
  Eye,
  FileUp,
  Layers,
  Minus,
  Plus,
  RotateCcw,
  Save,
  ScanSearch,
  Sparkles,
} from 'lucide-react';
import type {
  ActiveRoute,
  BlueprintAnalysisPayload,
  CostBreakdownResult,
  ProjectRecord,
  RoomGeometry,
} from '../../types/app';
import { formatArea, formatCurrency, formatDimension } from '../../types/app';
import {
  Button,
  Card,
  InputField,
  SelectField,
} from '../ui/Primitives';

interface PredictionResultBanner {
  projectName: string;
  created: boolean;
  roomsCount: number;
  totalAreaSqm: number;
  estimatedCost: number;
  currency: string;
  style?: string;
  confidence: number;
}

export function BlueprintWorkspace({
  mode,
  projects,
  activeProject,
  onSelectProject,
  onUploadBlueprint,
  onSaveAnalysis,
  onNavigate,
  onOpenNewProjectModal,
}: {
  mode: 'upload' | 'analysis';
  projects: ProjectRecord[];
  activeProject: ProjectRecord | null;
  onSelectProject: (id: number) => void;
  onUploadBlueprint: (
    projectId: number | null,
    options: {
      file?: File;
      useSample?: boolean;
      unit: 'm' | 'ft';
      targetMode?: 'alter' | 'new';
      projectName?: string;
    }
  ) => Promise<{
    project: ProjectRecord;
    costBreakdown: CostBreakdownResult;
    created: boolean;
  }>;
  onSaveAnalysis: (projectId: number, analysis: BlueprintAnalysisPayload) => Promise<void>;
  onNavigate: (route: ActiveRoute) => void;
  onOpenNewProjectModal: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [unit, setUnit] = useState<'m' | 'ft'>('m');
  const [targetMode, setTargetMode] = useState<'alter' | 'new'>(
    projects.length > 0 && activeProject ? 'alter' : 'new'
  );
  const [customProjectName, setCustomProjectName] = useState('');
  const [selectedFloor, setSelectedFloor] = useState<number>(1);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [predictionBanner, setPredictionBanner] =
    useState<PredictionResultBanner | null>(null);

  // Blueprint viewer pan & zoom
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Layer toggles
  const [showOverlayRooms, setShowOverlayRooms] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showOpenings, setShowOpenings] = useState(true);
  const [showUnderlayImage, setShowUnderlayImage] = useState(true);

  const effectiveTargetMode: 'alter' | 'new' =
    projects.length > 0 && activeProject ? targetMode : 'new';

  const analysis = activeProject?.analysisData || null;
  const rooms = analysis?.rooms || [];
  const floorRooms = rooms.filter((r) => (r.floor || 1) === selectedFloor);
  const activeRoom =
    rooms.find((r) => r.id === selectedRoomId) || floorRooms[0] || rooms[0] || null;

  const [draftRoom, setDraftRoom] = useState<RoomGeometry | null>(null);
  const editedRoom =
    draftRoom && activeRoom && draftRoom.id === activeRoom.id ? draftRoom : activeRoom;

  const runPredictionUpload = async (payload: { file?: File; useSample?: boolean }) => {
    setUploadError(null);
    setPredictionBanner(null);
    setUploading(true);
    try {
      const targetId =
        effectiveTargetMode === 'alter' && activeProject ? activeProject.id : null;
      const res = await onUploadBlueprint(targetId, {
        ...payload,
        unit,
        targetMode: effectiveTargetMode,
        projectName: effectiveTargetMode === 'new' ? customProjectName : undefined,
      });
      const predictedAnalysis = res.project.analysisData;
      setSelectedFloor(1);
      setSelectedRoomId(predictedAnalysis?.rooms?.[0]?.id || null);
      setDraftRoom(null);
      setTargetMode('alter');
      setCustomProjectName('');
      setPredictionBanner({
        projectName: res.project.name,
        created: res.created,
        roomsCount: predictedAnalysis?.rooms?.length || 0,
        totalAreaSqm: res.project.totalAreaSqm,
        estimatedCost: res.project.estimatedCost,
        currency: res.project.currency,
        style: predictedAnalysis?.architecturalStyle,
        confidence: Math.round((predictedAnalysis?.averageConfidence || 0) * 100),
      });
    } catch (err: any) {
      setUploadError(err?.message || 'Blueprint prediction failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await runPredictionUpload({ file });
  };

  const handleSampleAnalyze = async () => {
    await runPredictionUpload({ useSample: true });
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await runPredictionUpload({ file });
    }
  };

  const updateDraftField = <K extends keyof RoomGeometry>(
    key: K,
    value: RoomGeometry[K]
  ) => {
    if (!editedRoom) return;
    const next: RoomGeometry = {
      ...editedRoom,
      [key]: value,
    };
    if (key === 'width' || key === 'depth') {
      next.areaSqm = Number((Number(next.width) * Number(next.depth)).toFixed(2));
    }
    setDraftRoom(next);
  };

  const handleSaveManualCorrection = async () => {
    if (!activeProject || !analysis || !editedRoom) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updatedRooms = analysis.rooms.map((r) =>
        r.id === editedRoom.id
          ? { ...editedRoom, needsReview: false, uncertainFields: [] }
          : r
      );
      const totalAreaSqm = Number(
        updatedRooms.reduce((sum, r) => sum + r.areaSqm, 0).toFixed(2)
      );
      await onSaveAnalysis(activeProject.id, {
        ...analysis,
        rooms: updatedRooms,
        totalAreaSqm,
      });
      setDraftRoom(null);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save dimension corrections.');
    } finally {
      setSaving(false);
    }
  };

  // Compute SVG bounding box for CAD vector overlay
  const minX = floorRooms.length ? Math.min(...floorRooms.map((r) => r.x)) : 0;
  const minZ = floorRooms.length ? Math.min(...floorRooms.map((r) => r.z)) : 0;
  const maxX = floorRooms.length
    ? Math.max(...floorRooms.map((r) => r.x + r.width))
    : 12;
  const maxZ = floorRooms.length
    ? Math.max(...floorRooms.map((r) => r.z + r.depth))
    : 9;
  const spanX = Math.max(4, maxX - minX);
  const spanZ = Math.max(4, maxZ - minZ);
  const scalePx = Math.min(480 / spanX, 340 / spanZ);

  return (
    <div className="space-y-4">
      {/* Workspace Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-[#171923]">
            {mode === 'upload' ? 'Upload & Predict Blueprint' : 'Blueprint Analysis Studio'}
          </h1>
          <p className="text-xs text-[#777B87] mt-0.5">
            Upload a floor plan image (PNG, JPG, WEBP, or PDF) to predict rooms, dimensions, MEP points, 3D geometry, and alter your project automatically.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onOpenNewProjectModal}>
            <Plus size={14} />
            <span>New Project</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNavigate('studio_3d')}
            disabled={!analysis || rooms.length === 0}
          >
            <Box size={14} className="text-[#3049F5]" />
            <span>Switch to 3D Studio</span>
          </Button>
        </div>
      </div>

      {uploadError && (
        <div className="px-4 py-2.5 text-xs text-[#D94A50] bg-[#FEF2F2] border border-[#FECACA] rounded-lg">
          {uploadError}
        </div>
      )}

      {predictionBanner && (
        <div className="px-4 py-3 bg-[#EEF1FF] border border-[#3049F5]/30 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 size={18} className="text-[#249B67] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-[#171923]">
                {predictionBanner.created
                  ? `Predicted & Created Project "${predictionBanner.projectName}"`
                  : `Predicted & Altered Project "${predictionBanner.projectName}"`}
              </p>
              <p className="text-[11px] text-[#4E5360] mt-0.5 font-mono-num">
                {predictionBanner.style ? `${predictionBanner.style} · ` : ''}
                {predictionBanner.roomsCount} rooms detected ·{' '}
                {formatArea(predictionBanner.totalAreaSqm, unit)} · Est.{' '}
                {formatCurrency(predictionBanner.estimatedCost, predictionBanner.currency)} ·{' '}
                {predictionBanner.confidence}% avg confidence
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" onClick={() => onNavigate('studio_3d')}>
              <Box size={13} />
              <span>Open 3D House</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onNavigate('cost_analytics')}
            >
              <BarChart3 size={13} className="text-[#3049F5]" />
              <span>Cost Analytics</span>
            </Button>
          </div>
        </div>
      )}

      {/* 3-COLUMN ARCHITECTURAL WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT PANEL: Upload, Project Target, Floor Selector, Layers, Settings */}
        <Card className="lg:col-span-3 space-y-5">
          <div>
            <h2 className="text-xs font-semibold text-[#171923] mb-2.5">Blueprint Source</h2>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="space-y-2">
              <Button
                className="w-full"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp size={15} />
                <span>
                  {uploading
                    ? 'Predicting Layout...'
                    : effectiveTargetMode === 'new'
                    ? 'Upload Blueprint & Create Project'
                    : 'Upload Blueprint & Alter Project'}
                </span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                disabled={uploading}
                onClick={handleSampleAnalyze}
              >
                <Sparkles size={14} className="text-[#3049F5]" />
                <span>Predict Sample Villa Plan</span>
              </Button>
            </div>
            <p className="text-[11px] text-[#777B87] mt-2">
              Supports PNG, JPG, WEBP, and PDF up to 15 MB. You can also drag and drop a blueprint image onto the canvas.
            </p>
          </div>

          <div className="border-t border-[#E5E6EB] pt-4 space-y-3">
            <div>
              <label className="block text-[13px] font-medium text-[#171923] mb-1.5">
                Prediction Target
              </label>
              {projects.length > 0 ? (
                <div className="grid grid-cols-2 gap-1 p-1 bg-[#F1F0EC] rounded-lg border border-[#E5E6EB]">
                  <button
                    type="button"
                    onClick={() => setTargetMode('alter')}
                    className={`py-1.5 px-2 text-[11px] font-medium rounded-md cursor-pointer ${
                      effectiveTargetMode === 'alter'
                        ? 'bg-white text-[#3049F5] border border-[#E5E6EB]'
                        : 'text-[#777B87]'
                    }`}
                  >
                    Alter Project
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetMode('new')}
                    className={`py-1.5 px-2 text-[11px] font-medium rounded-md cursor-pointer ${
                      effectiveTargetMode === 'new'
                        ? 'bg-white text-[#3049F5] border border-[#E5E6EB]'
                        : 'text-[#777B87]'
                    }`}
                  >
                    New Project
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-[#777B87] bg-[#F1F0EC]/70 px-2.5 py-2 rounded-md border border-[#E5E6EB]">
                  Uploading a blueprint image will automatically create and populate a new project.
                </p>
              )}
            </div>

            {effectiveTargetMode === 'alter' && projects.length > 0 && activeProject ? (
              <SelectField
                label="Target Project to Alter"
                value={activeProject.id}
                onChange={(e) => onSelectProject(Number(e.target.value))}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </SelectField>
            ) : (
              <InputField
                label="New Project Name (Optional)"
                value={customProjectName}
                onChange={(e) => setCustomProjectName(e.target.value)}
                placeholder="Auto-predicted from blueprint"
              />
            )}

            {activeProject && (
              <div>
                <label className="block text-[13px] font-medium text-[#171923] mb-1.5">
                  Floor Selector
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(
                    { length: Math.max(1, analysis?.floors || activeProject.floorsCount || 1) },
                    (_, i) => i + 1
                  ).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setSelectedFloor(f)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border cursor-pointer ${
                        selectedFloor === f
                          ? 'bg-[#EEF1FF] border-[#3049F5] text-[#172D9B]'
                          : 'bg-white border-[#E5E6EB] text-[#777B87] hover:text-[#171923]'
                      }`}
                    >
                      Floor {f}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[#E5E6EB] pt-4 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#171923]">
              <Layers size={14} className="text-[#3049F5]" />
              <span>Blueprint Layers</span>
            </div>
            {[
              { label: 'Uploaded Drawing Underlay', checked: showUnderlayImage, set: setShowUnderlayImage },
              { label: 'Detected Room Boundaries', checked: showOverlayRooms, set: setShowOverlayRooms },
              { label: 'Dimension Callouts', checked: showDimensions, set: setShowDimensions },
              { label: 'Doors & Window Openings', checked: showOpenings, set: setShowOpenings },
            ].map((layer) => (
              <label
                key={layer.label}
                className="flex items-center justify-between text-xs text-[#171923] cursor-pointer py-0.5"
              >
                <span>{layer.label}</span>
                <input
                  type="checkbox"
                  checked={layer.checked}
                  onChange={(e) => layer.set(e.target.checked)}
                  className="h-4 w-4 rounded border-[#E5E6EB] text-[#3049F5]"
                />
              </label>
            ))}
          </div>

          <div className="border-t border-[#E5E6EB] pt-4">
            <label className="block text-xs font-semibold text-[#171923] mb-2">
              Analysis Units
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#F1F0EC] rounded-lg border border-[#E5E6EB]">
              {(['m', 'ft'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={`py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                    unit === u
                      ? 'bg-white text-[#3049F5] border border-[#E5E6EB]'
                      : 'text-[#777B87]'
                  }`}
                >
                  {u === 'm' ? 'Meters (m)' : 'Feet (ft)'}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* CENTER PANEL: Large Blueprint Viewer & Dropzone Canvas */}
        <Card className="lg:col-span-6" padding="p-0">
          <div className="px-4 py-3 border-b border-[#E5E6EB] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-[#171923]">
                {activeProject?.blueprintFileName || 'Architectural Drafting Canvas'}
              </span>
              {analysis && (
                <span className="text-[#777B87] font-mono-num">
                  · {formatArea(analysis.totalAreaSqm, unit)} · {rooms.length} rooms
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
                aria-label="Zoom out"
                className="p-1.5 rounded border border-[#E5E6EB] hover:bg-[#F1F0EC] text-[#171923] cursor-pointer"
              >
                <Minus size={13} />
              </button>
              <span className="px-2 text-xs font-mono-num text-[#777B87] tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))))}
                aria-label="Zoom in"
                className="p-1.5 rounded border border-[#E5E6EB] hover:bg-[#F1F0EC] text-[#171923] cursor-pointer"
              >
                <Plus size={13} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                aria-label="Reset view"
                className="p-1.5 rounded border border-[#E5E6EB] hover:bg-[#F1F0EC] text-[#171923] cursor-pointer ml-1"
              >
                <RotateCcw size={13} />
              </button>
            </div>
          </div>

          <div
            className={`relative h-[520px] arch-drafting-grid overflow-hidden select-none cursor-grab active:cursor-grabbing transition-colors ${
              isDragOver ? 'ring-2 ring-inset ring-[#3049F5] bg-[#EEF1FF]/40' : ''
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onMouseDown={(e) => {
              setDragging(true);
              dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
            }}
            onMouseMove={(e) => {
              if (!dragging) return;
              setPan({
                x: e.clientX - dragStartRef.current.x,
                y: e.clientY - dragStartRef.current.y,
              });
            }}
            onMouseUp={() => setDragging(false)}
            onMouseLeave={() => setDragging(false)}
          >
            {uploading && (
              <div className="absolute inset-0 z-20 bg-white/88 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-10 h-10 rounded-lg bg-[#EEF1FF] text-[#3049F5] flex items-center justify-center mb-3">
                  <ScanSearch size={20} />
                </div>
                <p className="text-sm font-semibold text-[#171923]">
                  Predicting Architectural Layout with Gemini AI
                </p>
                <p className="text-xs text-[#777B87] mt-1 max-w-xs">
                  Detecting rooms, wall spans, doors, windows, MEP systems, and applying updates directly to your project...
                </p>
              </div>
            )}

            {!activeProject?.blueprintFileUrl && rooms.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-12 h-12 rounded-lg bg-[#EEF1FF] text-[#3049F5] flex items-center justify-center mb-3">
                  <FileUp size={22} />
                </div>
                <p className="text-sm font-semibold text-[#171923]">
                  {activeProject
                    ? `Drop Blueprint Image for "${activeProject.name}"`
                    : 'Drop a Floor Plan Blueprint Image to Predict'}
                </p>
                <p className="text-xs text-[#777B87] mt-1 mb-4 max-w-sm">
                  Upload any PNG, JPG, WEBP, or PDF floor plan. BUILDVISION AI will predict all rooms, 3D geometry, and construction cost and save them directly to your project.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                    <FileUp size={14} />
                    <span>Select Blueprint Image</span>
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handleSampleAnalyze}>
                    <Sparkles size={14} className="text-[#3049F5]" />
                    <span>Predict Sample Villa Plan</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="w-full h-full flex items-center justify-center transition-transform duration-75"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                }}
              >
                <div className="relative flex flex-col items-center gap-4 p-6">
                  {/* Uploaded Blueprint Preview */}
                  {showUnderlayImage && activeProject?.blueprintFileUrl && (
                    <div className="border border-[#E5E6EB] bg-white p-2 rounded shadow-xs max-w-[560px]">
                      {activeProject.blueprintMimeType === 'application/pdf' ? (
                        <object
                          data={activeProject.blueprintFileUrl}
                          type="application/pdf"
                          className="w-[500px] h-[340px]"
                        >
                          <p className="text-xs text-[#777B87] p-4">
                            PDF blueprint uploaded ({activeProject.blueprintFileName}). Extracted vector plan shown below.
                          </p>
                        </object>
                      ) : (
                        <img
                          src={activeProject.blueprintFileUrl}
                          alt={activeProject.blueprintFileName || 'Uploaded blueprint'}
                          referrerPolicy="no-referrer"
                          className="max-h-[250px] w-auto object-contain"
                        />
                      )}
                    </div>
                  )}

                  {/* Technical Blue Vector Overlay */}
                  {showOverlayRooms && floorRooms.length > 0 && (
                    <svg
                      width={spanX * scalePx + 80}
                      height={spanZ * scalePx + 80}
                      viewBox={`-40 -40 ${spanX * scalePx + 80} ${spanZ * scalePx + 80}`}
                      className="bg-white/95 border border-[#172D9B]/25 rounded"
                    >
                      {floorRooms.map((room) => {
                        const rx = (room.x - minX) * scalePx;
                        const ry = (room.z - minZ) * scalePx;
                        const rw = room.width * scalePx;
                        const rh = room.depth * scalePx;
                        const isSelected = activeRoom?.id === room.id;

                        return (
                          <g
                            key={room.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRoomId(room.id);
                              setDraftRoom(null);
                            }}
                            className="cursor-pointer"
                          >
                            <rect
                              x={rx}
                              y={ry}
                              width={rw}
                              height={rh}
                              fill={
                                isSelected
                                  ? 'rgba(48, 73, 245, 0.14)'
                                  : room.needsReview
                                  ? 'rgba(232, 161, 58, 0.08)'
                                  : 'rgba(238, 241, 255, 0.4)'
                              }
                              stroke={isSelected ? '#3049F5' : '#172D9B'}
                              strokeWidth={isSelected ? 2.4 : 1.5}
                            />

                            {/* Window markers */}
                            {showOpenings &&
                              (room.windows || []).map((w, wIdx) => {
                                const wx =
                                  w.wall === 'north' || w.wall === 'south'
                                    ? rx + rw * w.offset - (w.width * scalePx) / 2
                                    : w.wall === 'east'
                                    ? rx + rw - 2
                                    : rx - 2;
                                const wy =
                                  w.wall === 'west' || w.wall === 'east'
                                    ? ry + rh * w.offset - (w.width * scalePx) / 2
                                    : w.wall === 'south'
                                    ? ry + rh - 2
                                    : ry - 2;
                                const ww =
                                  w.wall === 'north' || w.wall === 'south'
                                    ? w.width * scalePx
                                    : 4;
                                const wh =
                                  w.wall === 'west' || w.wall === 'east'
                                    ? w.width * scalePx
                                    : 4;
                                return (
                                  <rect
                                    key={`${w.id || 'w'}-${wIdx}`}
                                    x={wx}
                                    y={wy}
                                    width={ww}
                                    height={wh}
                                    fill="#FFFFFF"
                                    stroke="#3049F5"
                                    strokeWidth={1.2}
                                  />
                                );
                              })}

                            {/* Door markers */}
                            {showOpenings &&
                              (room.doors || []).map((d, dIdx) => {
                                const dx =
                                  d.wall === 'north' || d.wall === 'south'
                                    ? rx + rw * d.offset - (d.width * scalePx) / 2
                                    : d.wall === 'east'
                                    ? rx + rw - 2.5
                                    : rx - 2.5;
                                const dy =
                                  d.wall === 'west' || d.wall === 'east'
                                    ? ry + rh * d.offset - (d.width * scalePx) / 2
                                    : d.wall === 'south'
                                    ? ry + rh - 2.5
                                    : ry - 2.5;
                                const dw =
                                  d.wall === 'north' || d.wall === 'south'
                                    ? d.width * scalePx
                                    : 5;
                                const dh =
                                  d.wall === 'west' || d.wall === 'east'
                                    ? d.width * scalePx
                                    : 5;
                                return (
                                  <rect
                                    key={`${d.id || 'd'}-${dIdx}`}
                                    x={dx}
                                    y={dy}
                                    width={dw}
                                    height={dh}
                                    fill="#FEF3C7"
                                    stroke="#D97706"
                                    strokeWidth={1.2}
                                  />
                                );
                              })}

                            <text
                              x={rx + rw / 2}
                              y={ry + rh / 2 - 4}
                              textAnchor="middle"
                              fill="#171923"
                              fontSize="10"
                              fontWeight="600"
                            >
                              {room.name}
                            </text>
                            {showDimensions && (
                              <text
                                x={rx + rw / 2}
                                y={ry + rh / 2 + 10}
                                textAnchor="middle"
                                fill="#172D9B"
                                fontSize="9"
                                fontFamily="IBM Plex Mono, monospace"
                              >
                                {formatDimension(room.width, unit)} ×{' '}
                                {formatDimension(room.depth, unit)}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  )}
                </div>
              </div>
            )}
          </div>

          {analysis && (
            <div className="px-4 py-2.5 border-t border-[#E5E6EB] bg-[#F1F0EC]/40 flex flex-wrap items-center justify-between gap-2 text-xs text-[#777B87]">
              <span>{analysis.scaleNote}</span>
              <span className="font-mono-num">
                Avg Confidence: {Math.round(analysis.averageConfidence * 100)}%
              </span>
            </div>
          )}
        </Card>

        {/* RIGHT PANEL: Detected Rooms, Dimensions, Confidence & Manual Correction */}
        <Card className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#171923]">
              Predicted Rooms ({floorRooms.length})
            </h2>
            {analysis && (
              <button
                type="button"
                onClick={() => onNavigate('studio_3d')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#3049F5] hover:text-[#172D9B] cursor-pointer"
              >
                <Eye size={13} />
                <span>3D View</span>
              </button>
            )}
          </div>

          {analysis?.uncertainNotes && analysis.uncertainNotes.length > 0 && (
            <div className="p-3 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E] space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle size={14} className="text-[#E8A13A]" />
                <span>Verify Uncertain Measurements</span>
              </div>
              {analysis.uncertainNotes.slice(0, 2).map((note, idx) => (
                <p key={idx} className="text-[11px] leading-relaxed">
                  {note}
                </p>
              ))}
            </div>
          )}

          {floorRooms.length === 0 ? (
            <p className="text-xs text-[#777B87] py-4">
              Upload a floor plan image to predict room boundaries, dimensions, openings, and alter your project model.
            </p>
          ) : (
            <>
              <div className="max-h-44 overflow-y-auto divide-y divide-[#E5E6EB] border border-[#E5E6EB] rounded-lg">
                {floorRooms.map((r) => {
                  const selected = activeRoom?.id === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setSelectedRoomId(r.id);
                        setDraftRoom(null);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        selected ? 'bg-[#EEF1FF]' : 'bg-white hover:bg-[#F1F0EC]/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#171923] truncate">{r.name}</p>
                        <p className="text-[11px] text-[#777B87] font-mono-num">
                          {formatArea(r.areaSqm, unit)} · {Math.round(r.confidence * 100)}% conf
                        </p>
                      </div>
                      {r.needsReview ? (
                        <AlertTriangle size={14} className="text-[#E8A13A] shrink-0" />
                      ) : (
                        <CheckCircle2 size={14} className="text-[#249B67] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {editedRoom && (
                <div className="border-t border-[#E5E6EB] pt-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-[#171923]">
                      Alter Room Dimensions
                    </h3>
                    <span className="text-[11px] font-mono-num text-[#3049F5]">
                      {Math.round(editedRoom.confidence * 100)}% AI conf
                    </span>
                  </div>

                  {saveError && (
                    <div className="px-2.5 py-1.5 text-[11px] text-[#D94A50] bg-[#FEF2F2] border border-[#FECACA] rounded">
                      {saveError}
                    </div>
                  )}

                  <InputField
                    label="Room Label"
                    value={editedRoom.name}
                    onChange={(e) => updateDraftField('name', e.target.value)}
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <InputField
                      label="Width (m)"
                      type="number"
                      step="0.1"
                      min="1"
                      value={editedRoom.width}
                      onChange={(e) =>
                        updateDraftField('width', Math.max(0.5, Number(e.target.value) || 1))
                      }
                    />
                    <InputField
                      label="Depth (m)"
                      type="number"
                      step="0.1"
                      min="1"
                      value={editedRoom.depth}
                      onChange={(e) =>
                        updateDraftField('depth', Math.max(0.5, Number(e.target.value) || 1))
                      }
                    />
                    <InputField
                      label="Height (m)"
                      type="number"
                      step="0.1"
                      min="2"
                      value={editedRoom.height}
                      onChange={(e) =>
                        updateDraftField('height', Math.max(2, Number(e.target.value) || 2.8))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#F1F0EC]/60 p-2.5 rounded-lg border border-[#E5E6EB] font-mono-num">
                    <div>
                      <span className="text-[#777B87] block">Area</span>
                      <span className="font-semibold text-[#171923]">
                        {formatArea(editedRoom.areaSqm, unit)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#777B87] block">Wall Perimeter</span>
                      <span className="font-semibold text-[#171923]">
                        {formatDimension(2 * (editedRoom.width + editedRoom.depth), unit)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#777B87] block">Doors</span>
                      <span className="font-semibold text-[#171923]">
                        {(editedRoom.doors || []).length} openings
                      </span>
                    </div>
                    <div>
                      <span className="text-[#777B87] block">Windows</span>
                      <span className="font-semibold text-[#171923]">
                        {(editedRoom.windows || []).length} openings
                      </span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="w-full"
                    disabled={saving}
                    onClick={handleSaveManualCorrection}
                  >
                    <Save size={14} />
                    <span>{saving ? 'Saving...' : 'Save Changes to Project'}</span>
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
