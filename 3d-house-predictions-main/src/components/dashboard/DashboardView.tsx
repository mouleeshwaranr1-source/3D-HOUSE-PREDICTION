import React from 'react';
import {
  ArrowRight,
  BarChart3,
  Box,
  Calculator,
  CheckCircle2,
  Clock,
  FileUp,
  FolderKanban,
  PaintBucket,
  Plus,
  ScanSearch,
} from 'lucide-react';
import type { ActiveRoute, ProjectRecord, UserProfile } from '../../types/app';
import { formatArea, formatCurrency } from '../../types/app';
import { Button, Card, EmptyState } from '../ui/Primitives';

export function DashboardView({
  user,
  projects,
  onSelectProject,
  onNavigate,
  onOpenNewProjectModal,
}: {
  user: UserProfile;
  projects: ProjectRecord[];
  onSelectProject: (id: number) => void;
  onNavigate: (route: ActiveRoute) => void;
  onOpenNewProjectModal: () => void;
}) {
  const unit = user.preferences?.unit || 'm';
  const totalProjects = projects.length;
  const uploadedBlueprints = projects.filter((p) => Boolean(p.blueprintFileUrl)).length;
  const generated3D = projects.filter(
    (p) => p.analysisData && (p.analysisData.rooms?.length || 0) > 0
  ).length;
  const totalEstimatedCost = projects.reduce((sum, p) => sum + (p.estimatedCost || 0), 0);
  const primaryCurrency = projects[0]?.currency || user.preferences?.currency || 'USD';

  const stats = [
    {
      label: 'Total House Projects',
      value: String(totalProjects),
      icon: <FolderKanban size={18} />,
      sub: 'Active architectural workspaces',
    },
    {
      label: 'Uploaded Blueprints',
      value: String(uploadedBlueprints),
      icon: <FileUp size={18} />,
      sub: 'PDF, PNG & CAD floor plans',
    },
    {
      label: 'Generated 3D Houses',
      value: String(generated3D),
      icon: <Box size={18} />,
      sub: 'Interactive spatial models',
    },
    {
      label: 'Total Estimated Cost',
      value: formatCurrency(totalEstimatedCost, primaryCurrency),
      icon: <Calculator size={18} />,
      sub: 'Approximate regional index',
    },
  ];

  const recentActivity = projects.slice(0, 5).map((p) => ({
    id: p.id,
    title: p.name,
    detail: p.blueprintFileName
      ? `Blueprint ${p.blueprintFileName} · ${p.analysisData?.rooms?.length || 0} rooms detected`
      : 'Project initialized — awaiting blueprint upload',
    time: new Date(p.updatedAt).toLocaleDateString(),
    status: p.blueprintStatus,
  }));

  return (
    <div className="space-y-6">
      {/* Welcome Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#171923] tracking-tight">
            Welcome back, {user.fullName}
          </h1>
          <p className="text-sm text-[#777B87] mt-1">
            Plan residential layouts, analyze architectural blueprints, inspect 3D models, and estimate construction costs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="secondary" onClick={() => onNavigate('upload_blueprint')}>
            <FileUp size={15} className="text-[#3049F5]" />
            <span>Upload Blueprint</span>
          </Button>
          <Button onClick={onOpenNewProjectModal}>
            <Plus size={15} />
            <span>New Project</span>
          </Button>
        </div>
      </div>

      {/* 4 Summary White Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="flex flex-col justify-between">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-[#777B87]">{s.label}</span>
              <div className="w-8 h-8 rounded-md bg-[#EEF1FF] text-[#3049F5] flex items-center justify-center shrink-0">
                {s.icon}
              </div>
            </div>
            <p className="font-mono-num text-2xl font-semibold text-[#171923] mt-3 tabular-nums">
              {s.value}
            </p>
            <p className="text-xs text-[#777B87] mt-1">{s.sub}</p>
          </Card>
        ))}
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={22} />}
          title="No architectural projects yet"
          description="Create your first house planning project and upload a floor plan blueprint (PDF, PNG, or JPG) to generate a 3D model, MEP layouts, and cost breakdown."
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button onClick={onOpenNewProjectModal}>
                <Plus size={15} /> Create First Project
              </Button>
              <Button variant="secondary" onClick={() => onNavigate('upload_blueprint')}>
                <FileUp size={15} className="text-[#3049F5]" /> Go to Blueprint Studio
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Recent Projects + Progress */}
          <Card className="lg:col-span-8" padding="p-0">
            <div className="px-5 py-4 border-b border-[#E5E6EB] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#171923]">Recent Projects</h2>
              <button
                type="button"
                onClick={() => onNavigate('projects')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#3049F5] hover:text-[#172D9B] cursor-pointer"
              >
                <span>View All</span>
                <ArrowRight size={13} />
              </button>
            </div>
            <div className="divide-y divide-[#E5E6EB]">
              {projects.slice(0, 5).map((project) => {
                const progress =
                  project.analysisData && (project.interiorVersions?.length || 0) > 0
                    ? 100
                    : project.analysisData
                    ? 75
                    : project.blueprintFileUrl
                    ? 45
                    : 20;

                return (
                  <div
                    key={project.id}
                    className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F1F0EC]/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectProject(project.id);
                          onNavigate(
                            project.analysisData ? 'studio_3d' : 'upload_blueprint'
                          );
                        }}
                        className="text-sm font-semibold text-[#171923] hover:text-[#3049F5] transition-colors text-left truncate block cursor-pointer"
                      >
                        {project.name}
                      </button>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#777B87] mt-1 tabular-nums">
                        <span>{project.location}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatArea(project.totalAreaSqm, unit)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatCurrency(project.estimatedCost, project.currency)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="w-32">
                        <div className="flex items-center justify-between text-[11px] text-[#777B87] mb-1 tabular-nums">
                          <span>Workflow</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#F1F0EC] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#3049F5] rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          onSelectProject(project.id);
                          onNavigate(
                            project.analysisData ? 'studio_3d' : 'blueprint_analysis'
                          );
                        }}
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Recent Activity & Quick Tools */}
          <div className="lg:col-span-4 space-y-5">
            <Card>
              <h2 className="text-sm font-semibold text-[#171923] mb-3.5">Quick Workspace Launch</h2>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { key: 'blueprint_analysis' as ActiveRoute, label: 'Analyze Plan', icon: <ScanSearch size={16} /> },
                  { key: 'studio_3d' as ActiveRoute, label: '3D House', icon: <Box size={16} /> },
                  { key: 'interior_design' as ActiveRoute, label: 'Interiors', icon: <PaintBucket size={16} /> },
                  { key: 'cost_analytics' as ActiveRoute, label: 'Cost Charts', icon: <BarChart3 size={16} /> },
                ].map((tool) => (
                  <button
                    key={tool.key}
                    type="button"
                    onClick={() => onNavigate(tool.key)}
                    className="flex items-center gap-2 p-3 rounded-lg border border-[#E5E6EB] bg-white hover:bg-[#EEF1FF] hover:border-[#3049F5]/40 text-xs font-medium text-[#171923] transition-colors cursor-pointer"
                  >
                    <span className="text-[#3049F5]">{tool.icon}</span>
                    <span>{tool.label}</span>
                  </button>
                ))}
              </div>
            </Card>

            <Card padding="p-0">
              <div className="px-5 py-3.5 border-b border-[#E5E6EB]">
                <h2 className="text-sm font-semibold text-[#171923]">Recent Activity</h2>
              </div>
              <div className="divide-y divide-[#E5E6EB]">
                {recentActivity.map((act) => (
                  <div key={act.id} className="px-5 py-3 flex items-start gap-2.5">
                    <div className="mt-0.5 text-[#3049F5] shrink-0">
                      {act.status === 'completed' ? (
                        <CheckCircle2 size={15} className="text-[#249B67]" />
                      ) : (
                        <Clock size={15} className="text-[#3049F5]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[#171923] truncate">{act.title}</p>
                      <p className="text-[11px] text-[#777B87] mt-0.5">{act.detail}</p>
                      <p className="text-[11px] text-[#777B87] mt-1 font-mono-num">{act.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
