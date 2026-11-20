import React, { useCallback, useEffect, useRef, useState } from 'react';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { CostAnalyticsWorkspace } from './components/analytics/CostAnalyticsWorkspace';
import {
  AIAssistantView,
  ReportsExportsView,
  SettingsView,
} from './components/assistant/AssistantAndReports';
import { AuthScreens } from './components/auth/AuthScreens';
import { BlueprintWorkspace } from './components/blueprint/BlueprintWorkspace';
import { DashboardView } from './components/dashboard/DashboardView';
import { FuturePlanningWorkspace } from './components/future/FuturePlanningWorkspace';
import { AppShell } from './components/layout/AppShell';
import { ProjectsView } from './components/projects/ProjectsView';
import { Studio3DWorkspace } from './components/studio3d/Studio3DWorkspace';
import { Button, InputField, Modal, SelectField } from './components/ui/Primitives';
import { apiRequest, getAuthToken, setAuthToken } from './lib/api';
import { auth } from './lib/firebase';
import type {
  ActiveRoute,
  AdminModuleKey,
  BlueprintAnalysisPayload,
  CostBreakdownResult,
  FuturePlanPayload,
  InteriorVersion,
  NotificationItem,
  ProjectRecord,
  RegionMultiplierItem,
  UserProfile,
} from './types/app';

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showVerifyScreen, setShowVerifyScreen] = useState(false);

  const [activeRoute, setActiveRoute] = useState<ActiveRoute>('dashboard');
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [activeCostBreakdown, setActiveCostBreakdown] =
    useState<CostBreakdownResult | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [regions, setRegions] = useState<RegionMultiplierItem[]>([]);
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);

  // Quick-create project modal state when triggered from Dashboard
  const [quickName, setQuickName] = useState('');
  const [quickDesc, setQuickDesc] = useState('');
  const [quickLocation, setQuickLocation] = useState('Global Standard');
  const [quickFloors, setQuickFloors] = useState(1);
  const [quickCreating, setQuickCreating] = useState(false);
  const [quickCreateError, setQuickCreateError] = useState<string | null>(null);

  const fetchPricingCatalog = useCallback(async () => {
    try {
      const cat = await apiRequest<{ regions: RegionMultiplierItem[] }>(
        '/api/pricing/catalog'
      );
      setRegions(cat.regions || []);
    } catch {
      // Ignore if unauthenticated
    }
  }, []);

  const fetchWorkspaceData = useCallback(async () => {
    const [projRes, notifRes, catRes] = await Promise.all([
      apiRequest<{ projects: ProjectRecord[] }>('/api/projects'),
      apiRequest<{ notifications: NotificationItem[] }>('/api/notifications'),
      apiRequest<{ regions: RegionMultiplierItem[] }>('/api/pricing/catalog'),
    ]);
    const list = (projRes.projects || []).filter(
      (p): p is ProjectRecord => Boolean(p && typeof p.id === 'number')
    );
    setProjects(list);
    setNotifications(notifRes.notifications || []);
    setRegions(catRes.regions || []);
    setActiveProjectId((prev) => {
      if (prev && list.some((p) => p?.id === prev)) return prev;
      return list[0]?.id || null;
    });
  }, []);

  const loadActiveProjectDetails = useCallback(async (projectId: number) => {
    try {
      const res = await apiRequest<{
        project: ProjectRecord;
        costBreakdown: CostBreakdownResult;
      }>(`/api/projects/${projectId}`);
      if (res?.project?.id) {
        setProjects((prev) =>
          prev
            .filter((p): p is ProjectRecord => Boolean(p && p.id))
            .map((p) => (p.id === projectId ? res.project : p))
        );
      }
      setActiveCostBreakdown(res?.costBreakdown || null);
    } catch {
      setActiveCostBreakdown(null);
    }
  }, []);

  // Restore existing session on load
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setBooting(false);
      return;
    }
    apiRequest<{ user: UserProfile }>('/api/auth/me')
      .then(async (res) => {
        setUser(res.user);
        await fetchWorkspaceData();
      })
      .catch(() => {
        setAuthToken(null);
      })
      .finally(() => setBooting(false));
  }, [fetchWorkspaceData]);

  useEffect(() => {
    if (user && activeProjectId) {
      loadActiveProjectDetails(activeProjectId);
    } else {
      setActiveCostBreakdown(null);
    }
  }, [user, activeProjectId, loadActiveProjectDetails]);

  const handleAuthenticated = async (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    setShowVerifyScreen(false);
    try {
      await fetchWorkspaceData();
    } catch (err) {
      console.error('Failed to load initial workspace data:', err);
    }
  };

  const handleSignOut = async () => {
    setAuthToken(null);
    await firebaseSignOut(auth).catch(() => {});
    setUser(null);
    setProjects([]);
    setActiveProjectId(null);
    setActiveCostBreakdown(null);
    setActiveRoute('dashboard');
  };

  const handleCreateProject = async (payload: {
    name: string;
    description: string;
    location: string;
    floorsCount: number;
  }) => {
    const res = await apiRequest<{ project: ProjectRecord }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res?.project?.id) {
      throw new Error('Server did not return a valid project record.');
    }
    const createdProject = res.project;
    setProjects((prev) => [
      createdProject,
      ...prev.filter((p): p is ProjectRecord => Boolean(p && p.id)),
    ]);
    setActiveProjectId(createdProject.id);
    await loadActiveProjectDetails(createdProject.id);
  };

  const handleDeleteProject = async (id: number) => {
    await apiRequest(`/api/projects/${id}`, { method: 'DELETE' });
    setProjects((prev) => {
      const next = prev.filter((p): p is ProjectRecord => Boolean(p && p.id && p.id !== id));
      if (activeProjectId === id) {
        setActiveProjectId(next[0]?.id || null);
      }
      return next;
    });
  };

  const handleUploadBlueprint = async (
    projectId: number | null,
    options: {
      file?: File;
      useSample?: boolean;
      unit: 'm' | 'ft';
      targetMode?: 'alter' | 'new';
      projectName?: string;
    }
  ) => {
    const form = new FormData();
    form.append('unit', options.unit);
    if (options.projectName?.trim()) {
      form.append('projectName', options.projectName.trim());
    }
    if (options.file) {
      form.append('blueprint', options.file);
    } else if (options.useSample) {
      form.append('useSample', 'true');
    }

    const createNew = options.targetMode === 'new' || !projectId;
    const endpoint = createNew
      ? '/api/blueprints/predict'
      : `/api/projects/${projectId}/blueprint`;

    const res = await apiRequest<{
      project: ProjectRecord;
      costBreakdown: CostBreakdownResult;
      created?: boolean;
    }>(endpoint, {
      method: 'POST',
      body: form,
    });

    if (!res?.project?.id) {
      throw new Error('Blueprint prediction did not return a valid project record.');
    }
    const updatedProject = res.project;

    setProjects((prev) => {
      const cleanPrev = prev.filter((p): p is ProjectRecord => Boolean(p && p.id));
      const exists = cleanPrev.some((p) => p.id === updatedProject.id);
      if (exists) {
        return cleanPrev.map((p) => (p.id === updatedProject.id ? updatedProject : p));
      }
      return [updatedProject, ...cleanPrev];
    });
    setActiveProjectId(updatedProject.id);
    setActiveCostBreakdown(res.costBreakdown);
    apiRequest<{ notifications: NotificationItem[] }>('/api/notifications')
      .then((notifRes) => setNotifications(notifRes.notifications || []))
      .catch(() => {});

    return {
      project: updatedProject,
      costBreakdown: res.costBreakdown,
      created: Boolean(res.created ?? createNew),
    };
  };

  const patchSeqRef = useRef(0);

  const handlePatchProject = async (
    projectId: number,
    updates: {
      location?: string;
      analysisData?: BlueprintAnalysisPayload;
      interiorVersions?: InteriorVersion[];
      futurePlanData?: FuturePlanPayload;
    }
  ) => {
    const seq = ++patchSeqRef.current;

    // Optimistically apply changes immediately so 3D walls/materials reflect updates instantaneously
    setProjects((prev) =>
      prev
        .filter((p): p is ProjectRecord => Boolean(p && p.id))
        .map((p) =>
          p.id === projectId
            ? {
                ...p,
                ...(updates.location !== undefined ? { location: updates.location } : {}),
                ...(updates.analysisData !== undefined ? { analysisData: updates.analysisData } : {}),
                ...(updates.interiorVersions !== undefined
                  ? { interiorVersions: updates.interiorVersions }
                  : {}),
                ...(updates.futurePlanData !== undefined
                  ? { futurePlanData: updates.futurePlanData }
                  : {}),
              }
            : p
        )
    );

    try {
      const res = await apiRequest<{
        project: ProjectRecord;
        costBreakdown: CostBreakdownResult;
      }>(`/api/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      if (!res?.project?.id) {
        throw new Error('Project update did not return a valid project record.');
      }
      if (seq !== patchSeqRef.current) {
        return;
      }
      const updatedProject = res.project;
      setProjects((prev) =>
        prev
          .filter((p): p is ProjectRecord => Boolean(p && p.id))
          .map((p) => (p.id === projectId ? updatedProject : p))
      );
      setActiveCostBreakdown(res.costBreakdown);
    } catch (err) {
      if (seq === patchSeqRef.current) {
        await loadActiveProjectDetails(projectId);
      }
      throw err;
    }
  };

  const handleMarkAllRead = async () => {
    await apiRequest('/api/notifications/read-all', { method: 'POST' });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleQuickCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim()) return;
    setQuickCreateError(null);
    setQuickCreating(true);
    try {
      await handleCreateProject({
        name: quickName,
        description: quickDesc,
        location: quickLocation,
        floorsCount: quickFloors,
      });
      setQuickName('');
      setQuickDesc('');
      setNewProjectModalOpen(false);
      setActiveRoute('upload_blueprint');
    } catch (err: any) {
      setQuickCreateError(err?.message || 'Failed to create project.');
    } finally {
      setQuickCreating(false);
    }
  };

  if (booting) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-sm text-[#777B87]">
        Loading BUILDVISION AI workspace...
      </div>
    );
  }

  if (!user) {
    return <AuthScreens onAuthenticated={handleAuthenticated} />;
  }

  if (showVerifyScreen) {
    return (
      <AuthScreens
        initialMode="verify"
        pendingVerificationUser={user}
        onAuthenticated={handleAuthenticated}
        onSkipVerification={() => setShowVerifyScreen(false)}
      />
    );
  }

  const activeProject = projects.find((p) => p?.id === activeProjectId) || null;
  const isAdminRoute = String(activeRoute).startsWith('admin_');

  return (
    <AppShell
      user={user}
      activeRoute={activeRoute}
      onNavigate={(route) => {
        if (String(route).startsWith('admin_') && user.role !== 'admin') {
          return;
        }
        setActiveRoute(route);
      }}
      projects={projects}
      activeProjectId={activeProjectId}
      onSelectProject={setActiveProjectId}
      notifications={notifications}
      onMarkAllRead={handleMarkAllRead}
      onSignOut={handleSignOut}
      onVerifyEmailPrompt={() => setShowVerifyScreen(true)}
    >
      {isAdminRoute && user.role === 'admin' ? (
        <AdminDashboard
          activeModule={activeRoute as AdminModuleKey}
          onNavigateAdmin={(m) => setActiveRoute(m)}
          onRefreshPricing={fetchPricingCatalog}
        />
      ) : activeRoute === 'dashboard' ? (
        <DashboardView
          user={user}
          projects={projects}
          onSelectProject={setActiveProjectId}
          onNavigate={setActiveRoute}
          onOpenNewProjectModal={() => setNewProjectModalOpen(true)}
        />
      ) : activeRoute === 'projects' ? (
        <ProjectsView
          projects={projects}
          regions={regions}
          activeProjectId={activeProjectId}
          onSelectProject={setActiveProjectId}
          onCreateProject={handleCreateProject}
          onDeleteProject={handleDeleteProject}
          onNavigate={setActiveRoute}
          newModalOpen={newProjectModalOpen}
          setNewModalOpen={setNewProjectModalOpen}
        />
      ) : activeRoute === 'upload_blueprint' || activeRoute === 'blueprint_analysis' ? (
        <BlueprintWorkspace
          mode={activeRoute === 'upload_blueprint' ? 'upload' : 'analysis'}
          projects={projects}
          activeProject={activeProject}
          onSelectProject={setActiveProjectId}
          onUploadBlueprint={handleUploadBlueprint}
          onSaveAnalysis={(pid, analysisData) =>
            handlePatchProject(pid, { analysisData })
          }
          onNavigate={setActiveRoute}
          onOpenNewProjectModal={() => setNewProjectModalOpen(true)}
        />
      ) : activeRoute === 'studio_3d' ||
        activeRoute === 'room_explorer' ||
        activeRoute === 'structural_view' ||
        activeRoute === 'electrical_layout' ||
        activeRoute === 'plumbing_layout' ||
        activeRoute === 'interior_design' ? (
        <Studio3DWorkspace
          initialMode={
            activeRoute === 'room_explorer'
              ? 'room_explorer'
              : activeRoute === 'structural_view'
              ? 'structural'
              : activeRoute === 'electrical_layout'
              ? 'electrical'
              : activeRoute === 'plumbing_layout'
              ? 'plumbing'
              : activeRoute === 'interior_design'
              ? 'interior'
              : 'architectural'
          }
          projects={projects}
          activeProject={activeProject}
          costBreakdown={activeCostBreakdown}
          onSelectProject={setActiveProjectId}
          onSaveProjectUpdates={(pid, updates) => handlePatchProject(pid, updates)}
          onNavigate={setActiveRoute}
        />
      ) : activeRoute === 'construction_cost' ||
        activeRoute === 'cost_analytics' ||
        activeRoute === 'budget_optimizer' ? (
        <CostAnalyticsWorkspace
          mode={activeRoute}
          projects={projects}
          activeProject={activeProject}
          costBreakdown={activeCostBreakdown}
          regions={regions}
          onSelectProject={setActiveProjectId}
          onChangeRegion={(pid, regionName) =>
            handlePatchProject(pid, { location: regionName })
          }
          onApplyMaterialPreset={(pid, analysisData) =>
            handlePatchProject(pid, { analysisData })
          }
          onNavigate={setActiveRoute}
        />
      ) : activeRoute === 'future_planning' ? (
        <FuturePlanningWorkspace
          projects={projects}
          activeProject={activeProject}
          costBreakdown={activeCostBreakdown}
          onSelectProject={setActiveProjectId}
          onSaveFuturePlan={(pid, futurePlanData) =>
            handlePatchProject(pid, { futurePlanData })
          }
          onNavigate={setActiveRoute}
        />
      ) : activeRoute === 'ai_assistant' ? (
        <AIAssistantView
          projects={projects}
          activeProject={activeProject}
          onSelectProject={setActiveProjectId}
        />
      ) : activeRoute === 'reports_exports' ? (
        <ReportsExportsView
          projects={projects}
          activeProject={activeProject}
          costBreakdown={activeCostBreakdown}
          onSelectProject={setActiveProjectId}
        />
      ) : (
        <SettingsView
          user={user}
          regions={regions}
          onSaveProfile={async (updates) => {
            const res = await apiRequest<{ user: UserProfile }>('/api/auth/profile', {
              method: 'PATCH',
              body: JSON.stringify(updates),
            });
            setUser(res.user);
          }}
          onVerifyEmail={async () => {
            const res = await apiRequest<{ user: UserProfile }>('/api/auth/verify-email', {
              method: 'POST',
            });
            setUser(res.user);
          }}
        />
      )}

      {/* Global New Project Modal when triggered outside ProjectsView */}
      {activeRoute !== 'projects' && (
        <Modal
          open={newProjectModalOpen}
          onClose={() => setNewProjectModalOpen(false)}
          title="Create Architectural Project"
          subtitle="Start a new house planning workspace and upload a blueprint"
        >
          <form onSubmit={handleQuickCreateSubmit} className="space-y-4">
            {quickCreateError && (
              <div className="px-3 py-2 text-xs text-[#D94A50] bg-[#FEF2F2] border border-[#FECACA] rounded-lg">
                {quickCreateError}
              </div>
            )}
            <InputField
              label="Project Name"
              required
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              placeholder="e.g. Oakridge Contemporary Residence"
            />
            <InputField
              label="Project Brief"
              value={quickDesc}
              onChange={(e) => setQuickDesc(e.target.value)}
              placeholder="e.g. Two-story modern family residence"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <SelectField
                label="Regional Cost Index"
                value={quickLocation}
                onChange={(e) => setQuickLocation(e.target.value)}
              >
                {regions.map((r) => (
                  <option key={r.regionName} value={r.regionName}>
                    {r.regionName} ({r.currency})
                  </option>
                ))}
              </SelectField>
              <InputField
                label="Floors"
                type="number"
                min={1}
                max={5}
                value={quickFloors}
                onChange={(e) => setQuickFloors(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setNewProjectModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={quickCreating}>
                {quickCreating ? 'Creating...' : 'Create & Upload Blueprint'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </AppShell>
  );
}
