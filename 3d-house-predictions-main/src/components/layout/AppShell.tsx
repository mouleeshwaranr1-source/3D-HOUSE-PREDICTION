import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  Box,
  Calculator,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  Cpu,
  CreditCard,
  Database,
  Droplets,
  FileCheck2,
  FileSpreadsheet,
  FileUp,
  FolderKanban,
  Globe,
  Hammer,
  HardHat,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  PaintBucket,
  PanelLeftClose,
  PanelLeftOpen,
  PlusSquare,
  ScanSearch,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  UserCheck,
  Users,
  X,
  Zap,
} from 'lucide-react';
import type {
  ActiveRoute,
  AdminModuleKey,
  NotificationItem,
  ProjectRecord,
  UserModuleKey,
  UserProfile,
} from '../../types/app';
import { Breadcrumbs, BuildVisionLogo, DropdownMenu, UserAvatar } from '../ui/Primitives';

interface NavItem {
  key: ActiveRoute;
  label: string;
  icon: React.ReactNode;
  group?: string;
}

const USER_NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={17} /> },
  { key: 'projects', label: 'My Projects', icon: <FolderKanban size={17} /> },
  { key: 'upload_blueprint', label: 'Upload Blueprint', icon: <FileUp size={17} />, group: 'Blueprint' },
  { key: 'blueprint_analysis', label: 'Blueprint Analysis', icon: <ScanSearch size={17} />, group: 'Blueprint' },
  { key: 'studio_3d', label: '3D House Studio', icon: <Box size={17} />, group: '3D & Engineering' },
  { key: 'room_explorer', label: 'Room Explorer', icon: <Compass size={17} />, group: '3D & Engineering' },
  { key: 'structural_view', label: 'Structural View', icon: <Layers size={17} />, group: '3D & Engineering' },
  { key: 'electrical_layout', label: 'Electrical Layout', icon: <Zap size={17} />, group: '3D & Engineering' },
  { key: 'plumbing_layout', label: 'Plumbing Layout', icon: <Droplets size={17} />, group: '3D & Engineering' },
  { key: 'interior_design', label: 'Interior Design', icon: <PaintBucket size={17} />, group: 'Design & Cost' },
  { key: 'construction_cost', label: 'Construction Cost', icon: <Calculator size={17} />, group: 'Design & Cost' },
  { key: 'cost_analytics', label: 'Cost Analytics', icon: <BarChart3 size={17} />, group: 'Design & Cost' },
  { key: 'future_planning', label: 'Future House Planning', icon: <PlusSquare size={17} />, group: 'Planning & AI' },
  { key: 'budget_optimizer', label: 'Budget Optimizer', icon: <TrendingUp size={17} />, group: 'Planning & AI' },
  { key: 'ai_assistant', label: 'AI House Assistant', icon: <MessageSquareText size={17} />, group: 'Planning & AI' },
  { key: 'reports_exports', label: 'Reports and Exports', icon: <FileSpreadsheet size={17} /> },
  { key: 'settings', label: 'Settings', icon: <Settings size={17} /> },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { key: 'admin_overview', label: 'Admin Overview', icon: <ShieldCheck size={17} /> },
  { key: 'admin_users', label: 'User Management', icon: <Users size={17} /> },
  { key: 'admin_registered_accounts', label: 'Registered Accounts', icon: <UserCheck size={17} /> },
  { key: 'admin_project_monitoring', label: 'Project Monitoring', icon: <Activity size={17} /> },
  { key: 'admin_blueprint_processing', label: 'Blueprint Processing', icon: <Cpu size={17} /> },
  { key: 'admin_materials', label: 'Construction Materials', icon: <Hammer size={17} /> },
  { key: 'admin_labour', label: 'Labour Price Management', icon: <HardHat size={17} /> },
  { key: 'admin_regions', label: 'Regional Price Database', icon: <Globe size={17} /> },
  { key: 'admin_cost_estimation', label: 'Cost Estimation Management', icon: <CreditCard size={17} /> },
  { key: 'admin_reports', label: 'Reports', icon: <FileCheck2 size={17} /> },
  { key: 'admin_settings', label: 'Application Settings', icon: <SlidersHorizontal size={17} /> },
  { key: 'admin_audit_logs', label: 'Audit Logs', icon: <Database size={17} /> },
];

const TOP_BAR_LINKS: Array<{ key: UserModuleKey; label: string; icon: React.ReactNode }> = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={15} /> },
  { key: 'projects', label: 'My Projects', icon: <FolderKanban size={15} /> },
  { key: 'blueprint_analysis', label: 'Blueprint Studio', icon: <ScanSearch size={15} /> },
  { key: 'studio_3d', label: '3D House Studio', icon: <Box size={15} /> },
  { key: 'cost_analytics', label: 'Cost Analytics', icon: <BarChart3 size={15} /> },
  { key: 'interior_design', label: 'Interior Design', icon: <PaintBucket size={15} /> },
];

export function AppShell({
  user,
  activeRoute,
  onNavigate,
  projects,
  activeProjectId,
  onSelectProject,
  notifications,
  onMarkAllRead,
  onSignOut,
  onVerifyEmailPrompt,
  children,
}: {
  user: UserProfile;
  activeRoute: ActiveRoute;
  onNavigate: (route: ActiveRoute) => void;
  projects: ProjectRecord[];
  activeProjectId: number | null;
  onSelectProject: (id: number) => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onSignOut: () => void;
  onVerifyEmailPrompt: () => void;
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Blueprint: true,
    '3D & Engineering': true,
    'Design & Cost': true,
    'Planning & AI': true,
  });

  const isAdminRoute = String(activeRoute).startsWith('admin_');
  const isAdminUser = user.role === 'admin';
  const navItems = isAdminRoute && isAdminUser ? ADMIN_NAV_ITEMS : USER_NAV_ITEMS;
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const activeProject = projects.find((p) => p?.id === activeProjectId) || null;
  const activeNavObj = [...USER_NAV_ITEMS, ...ADMIN_NAV_ITEMS].find(
    (item) => item.key === activeRoute
  );

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const renderSidebarNav = (mobile = false) => {
    const renderedGroups = new Set<string>();
    return (
      <div className="flex flex-col h-full">
        {isAdminUser && (
          <div className="px-3 pt-3 pb-2 border-b border-[#E5E6EB]">
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#F1F0EC] rounded-lg border border-[#E5E6EB]">
              <button
                type="button"
                onClick={() => {
                  onNavigate('dashboard');
                  if (mobile) setMobileDrawerOpen(false);
                }}
                className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  !isAdminRoute
                    ? 'bg-white text-[#3049F5] border border-[#E5E6EB]'
                    : 'text-[#777B87] hover:text-[#171923]'
                }`}
              >
                {sidebarCollapsed && !mobile ? 'User' : 'Workspace'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate('admin_overview' as AdminModuleKey);
                  if (mobile) setMobileDrawerOpen(false);
                }}
                className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  isAdminRoute
                    ? 'bg-white text-[#3049F5] border border-[#E5E6EB]'
                    : 'text-[#777B87] hover:text-[#171923]'
                }`}
              >
                {sidebarCollapsed && !mobile ? 'Adm' : 'Admin'}
              </button>
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">
          {navItems.map((item) => {
            if (item.group && !sidebarCollapsed && !isAdminRoute) {
              const showHeader = !renderedGroups.has(item.group);
              if (showHeader) renderedGroups.add(item.group);
              const isOpen = expandedGroups[item.group] ?? true;

              return (
                <React.Fragment key={item.key}>
                  {showHeader && (
                    <button
                      type="button"
                      onClick={() => toggleGroup(item.group!)}
                      className="w-full flex items-center justify-between px-2.5 pt-3 pb-1 text-[11px] font-medium text-[#777B87] hover:text-[#171923] cursor-pointer"
                    >
                      <span>{item.group}</span>
                      {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                  )}
                  {isOpen && (
                    <SidebarButton
                      item={item}
                      active={activeRoute === item.key}
                      collapsed={false}
                      onClick={() => {
                        onNavigate(item.key);
                        if (mobile) setMobileDrawerOpen(false);
                      }}
                    />
                  )}
                </React.Fragment>
              );
            }

            return (
              <SidebarButton
                key={item.key}
                item={item}
                active={activeRoute === item.key}
                collapsed={sidebarCollapsed && !mobile}
                onClick={() => {
                  onNavigate(item.key);
                  if (mobile) setMobileDrawerOpen(false);
                }}
              />
            );
          })}
        </nav>

        <div className="p-2.5 border-t border-[#E5E6EB] hidden lg:flex justify-end">
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="w-full flex items-center justify-center gap-2 py-2 px-2.5 text-xs text-[#777B87] hover:text-[#171923] hover:bg-[#F1F0EC] rounded-md transition-colors cursor-pointer"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            {!sidebarCollapsed && <span>Collapse Sidebar</span>}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white text-[#171923] flex flex-col">
      {/* TOP NAVIGATION BAR */}
      <header className="no-print sticky top-0 z-30 h-14 bg-white border-b border-[#E5E6EB] px-4 lg:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open navigation menu"
            className="lg:hidden p-1.5 rounded-md text-[#3049F5] hover:bg-[#EEF1FF] cursor-pointer"
          >
            <Menu size={20} />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="cursor-pointer focus:outline-none"
          >
            <BuildVisionLogo />
          </button>
        </div>

        {/* Desktop top links */}
        <nav className="hidden xl:flex items-center gap-1 overflow-x-auto">
          {TOP_BAR_LINKS.map((link) => {
            const isActive = activeRoute === link.key;
            return (
              <button
                key={link.key}
                type="button"
                onClick={() => onNavigate(link.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#EEF1FF] text-[#3049F5]'
                    : 'text-[#777B87] hover:text-[#171923] hover:bg-[#F1F0EC]/70'
                }`}
              >
                <span className="text-[#3049F5]">{link.icon}</span>
                <span>{link.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Utility Zone: Project Switcher + Notifications + Profile */}
        <div className="flex items-center gap-2.5 shrink-0">
          {projects.length > 0 && !isAdminRoute && (
            <div className="hidden md:block">
              <select
                aria-label="Active project selector"
                value={activeProjectId || ''}
                onChange={(e) => onSelectProject(Number(e.target.value))}
                className="h-8 pl-2.5 pr-7 text-xs font-medium bg-[#F1F0EC]/70 border border-[#E5E6EB] rounded-md text-[#171923] max-w-[190px] truncate focus:outline-none focus:border-[#3049F5]"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notifications Dropdown */}
          <DropdownMenu
            trigger={
              <button
                type="button"
                aria-label="Notifications"
                className="relative p-2 rounded-lg border border-[#E5E6EB] bg-white hover:bg-[#F1F0EC] text-[#3049F5] transition-colors cursor-pointer"
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#3049F5] text-white text-[10px] font-mono-num flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            }
          >
            <div className="w-[300px] sm:w-[330px]">
              <div className="flex items-center justify-between px-3.5 py-2 border-b border-[#E5E6EB]">
                <span className="text-xs font-semibold text-[#171923]">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={onMarkAllRead}
                    className="inline-flex items-center gap-1 text-[11px] text-[#3049F5] hover:text-[#172D9B] cursor-pointer"
                  >
                    <Check size={12} /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-[#E5E6EB]">
                {notifications.length === 0 ? (
                  <p className="px-3.5 py-5 text-xs text-center text-[#777B87]">
                    No notifications yet.
                  </p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`px-3.5 py-2.5 ${n.isRead ? 'bg-white' : 'bg-[#EEF1FF]/50'}`}
                    >
                      <p className="text-xs font-medium text-[#171923]">{n.title}</p>
                      <p className="text-[11px] text-[#777B87] mt-0.5 leading-relaxed">
                        {n.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </DropdownMenu>

          {/* Profile Menu */}
          <DropdownMenu
            trigger={
              <button
                type="button"
                className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-lg border border-[#E5E6EB] bg-white hover:bg-[#F1F0EC] transition-colors cursor-pointer"
              >
                <UserAvatar name={user.fullName} email={user.email} size="sm" />
                <span className="hidden sm:inline text-xs font-medium text-[#171923] max-w-[120px] truncate">
                  {user.fullName}
                </span>
                <ChevronDown size={13} className="text-[#777B87]" />
              </button>
            }
          >
            <div className="px-3.5 py-2.5 border-b border-[#E5E6EB] flex items-center gap-2.5">
              <UserAvatar name={user.fullName} email={user.email} size="md" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#171923] truncate">{user.fullName}</p>
                <p className="text-[11px] text-[#777B87] truncate">{user.email}</p>
                <p className="text-[11px] text-[#3049F5] mt-0.5">
                  {user.role === 'admin' ? 'Administrator Account' : 'Architectural Planner'}
                </p>
              </div>
            </div>
            {!user.emailVerified && (
              <button
                type="button"
                onClick={onVerifyEmailPrompt}
                className="w-full text-left px-3.5 py-2 text-xs text-[#E8A13A] hover:bg-[#F1F0EC] cursor-pointer"
              >
                Verify Email Address
              </button>
            )}
            {isAdminUser && (
              <button
                type="button"
                onClick={() =>
                  onNavigate(isAdminRoute ? 'dashboard' : ('admin_overview' as AdminModuleKey))
                }
                className="w-full text-left px-3.5 py-2 text-xs text-[#3049F5] hover:bg-[#EEF1FF] flex items-center gap-2 cursor-pointer"
              >
                <ShieldCheck size={14} />
                <span>{isAdminRoute ? 'Switch to User Workspace' : 'Open Admin Console'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="w-full text-left px-3.5 py-2 text-xs text-[#171923] hover:bg-[#F1F0EC] flex items-center gap-2 cursor-pointer"
            >
              <Settings size={14} className="text-[#3049F5]" />
              <span>Workspace Settings</span>
            </button>
            <div className="border-t border-[#E5E6EB] mt-1 pt-1">
              <button
                type="button"
                onClick={onSignOut}
                className="w-full text-left px-3.5 py-2 text-xs text-[#D94A50] hover:bg-[#FEF2F2] flex items-center gap-2 cursor-pointer"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </DropdownMenu>
        </div>
      </header>

      {/* BODY: FIXED LEFT SIDEBAR + WORKSPACE */}
      <div className="flex-1 flex min-h-0">
        {/* Desktop Sidebar */}
        <aside
          className={`no-print hidden lg:block shrink-0 bg-white border-r border-[#E5E6EB] transition-all duration-200 ${
            sidebarCollapsed ? 'w-16' : 'w-60'
          }`}
        >
          <div className="sticky top-14 h-[calc(100vh-3.5rem)]">{renderSidebarNav(false)}</div>
        </aside>

        {/* Mobile Drawer */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-[#171923]/30"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <aside className="relative w-72 max-w-[85vw] bg-white border-r border-[#E5E6EB] h-full flex flex-col z-10">
              <div className="h-14 px-4 flex items-center justify-between border-b border-[#E5E6EB]">
                <BuildVisionLogo />
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  aria-label="Close navigation menu"
                  className="p-1.5 text-[#777B87] hover:text-[#171923]"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">{renderSidebarNav(true)}</div>
            </aside>
          </div>
        )}

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 bg-[#F1F0EC]/35 flex flex-col">
          {/* Context Breadcrumb Strip */}
          <div className="no-print bg-white border-b border-[#E5E6EB] px-4 lg:px-7 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <Breadcrumbs
              items={[
                {
                  label: isAdminRoute ? 'Admin Console' : 'BUILDVISION AI',
                  onClick: () =>
                    onNavigate(isAdminRoute ? 'admin_overview' : 'dashboard'),
                },
                ...(activeProject && !isAdminRoute
                  ? [
                      {
                        label: activeProject.name,
                        onClick: () => onNavigate('projects'),
                      },
                    ]
                  : []),
                { label: activeNavObj?.label || 'Workspace' },
              ]}
            />
            {activeProject && !isAdminRoute && (
              <div className="flex items-center gap-2 text-xs text-[#777B87] tabular-nums">
                <span>{activeProject.location}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {Number(activeProject.floorsCount || 1)} Floor
                  {Number(activeProject.floorsCount || 1) > 1 ? 's' : ''}
                </span>
                <span aria-hidden="true">·</span>
                <span>{Number(activeProject.totalAreaSqm || 0).toFixed(1)} m²</span>
              </div>
            )}
          </div>

          <div className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarButton({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={`relative w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors cursor-pointer ${
        active
          ? 'bg-[#EEF1FF] text-[#172D9B] font-medium'
          : 'text-[#171923] hover:bg-[#F1F0EC]/70 font-normal'
      } ${collapsed ? 'justify-center' : ''}`}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[#3049F5]"
        />
      )}
      <span className={active ? 'text-[#3049F5]' : 'text-[#3049F5]/85'}>{item.icon}</span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  );
}
