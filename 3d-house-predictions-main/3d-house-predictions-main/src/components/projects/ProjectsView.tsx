import React, { useState } from 'react';
import {
  Box,
  FileUp,
  FolderKanban,
  Plus,
  Trash2,
} from 'lucide-react';
import type { ActiveRoute, ProjectRecord, RegionMultiplierItem } from '../../types/app';
import { formatArea, formatCurrency } from '../../types/app';
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  InputField,
  Modal,
  SearchBar,
  SelectField,
} from '../ui/Primitives';

export function ProjectsView({
  projects,
  regions,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onNavigate,
  newModalOpen,
  setNewModalOpen,
}: {
  projects: ProjectRecord[];
  regions: RegionMultiplierItem[];
  activeProjectId: number | null;
  onSelectProject: (id: number) => void;
  onCreateProject: (payload: {
    name: string;
    description: string;
    location: string;
    floorsCount: number;
  }) => Promise<void>;
  onDeleteProject: (id: number) => Promise<void>;
  onNavigate: (route: ActiveRoute) => void;
  newModalOpen: boolean;
  setNewModalOpen: (open: boolean) => void;
}) {
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(regions[0]?.regionName || 'Global Standard');
  const [floorsCount, setFloorsCount] = useState(1);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.location.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreateError(null);
    setCreating(true);
    try {
      await onCreateProject({ name, description, location, floorsCount });
      setName('');
      setDescription('');
      setFloorsCount(1);
      setNewModalOpen(false);
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create project.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    setActionError(null);
    setDeletingId(id);
    try {
      await onDeleteProject(id);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to delete project.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-[#171923]">My Projects</h1>
          <p className="text-xs text-[#777B87] mt-0.5">
            Manage residential house plans, blueprint uploads, and 3D construction estimates.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Filter projects..."
            className="w-56"
          />
          <Button
            onClick={() => {
              setCreateError(null);
              setNewModalOpen(true);
            }}
          >
            <Plus size={15} />
            <span>New Project</span>
          </Button>
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

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={22} />}
          title="Start your first architectural project"
          description="Create a project container for your residential floor plan, then upload a PDF, PNG, or JPG blueprint for AI spatial analysis."
          action={
            <Button onClick={() => setNewModalOpen(true)}>
              <Plus size={15} /> Create Project
            </Button>
          }
        />
      ) : (
        <Card padding="p-0">
          <DataTable
            rows={filtered}
            emptyMessage="No projects match your search."
            columns={[
              {
                key: 'name',
                header: 'Project Name',
                render: (row) => (
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectProject(row.id);
                        onNavigate(row.analysisData ? 'studio_3d' : 'upload_blueprint');
                      }}
                      className={`font-medium hover:text-[#3049F5] cursor-pointer text-left ${
                        row.id === activeProjectId ? 'text-[#3049F5]' : 'text-[#171923]'
                      }`}
                    >
                      {row.name}
                    </button>
                    <p className="text-xs text-[#777B87] mt-0.5 truncate max-w-xs">
                      {row.description || 'Residential planning project'}
                    </p>
                  </div>
                ),
              },
              {
                key: 'location',
                header: 'Pricing Region',
                render: (row) => <span className="text-xs text-[#171923]">{row.location}</span>,
              },
              {
                key: 'area',
                header: 'Built-up Area',
                align: 'right',
                render: (row) => (
                  <span className="font-mono-num text-xs">
                    {formatArea(row.totalAreaSqm, 'm')}
                  </span>
                ),
              },
              {
                key: 'cost',
                header: 'Est. Construction Cost',
                align: 'right',
                render: (row) => (
                  <span className="font-mono-num text-xs font-medium">
                    {formatCurrency(row.estimatedCost, row.currency)}
                  </span>
                ),
              },
              {
                key: 'blueprint',
                header: 'Blueprint Status',
                render: (row) => (
                  <span className="text-xs text-[#777B87] capitalize">
                    {row.blueprintStatus.replace('_', ' ')}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (row) => (
                  <div className="inline-flex items-center justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        onSelectProject(row.id);
                        onNavigate('upload_blueprint');
                      }}
                    >
                      <FileUp size={13} className="text-[#3049F5]" />
                      <span>Blueprint</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        onSelectProject(row.id);
                        onNavigate('studio_3d');
                      }}
                    >
                      <Box size={13} className="text-[#3049F5]" />
                      <span>3D</span>
                    </Button>
                    <button
                      type="button"
                      disabled={deletingId === row.id}
                      onClick={() => handleDelete(row.id)}
                      aria-label={`Delete ${row.name}`}
                      className="p-2 rounded-md text-[#777B87] hover:text-[#D94A50] hover:bg-[#FEF2F2] cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </Card>
      )}

      <Modal
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        title="Create Architectural Project"
        subtitle="Initialize a new house planning workspace in PostgreSQL"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {createError && (
            <div className="px-3 py-2 text-xs text-[#D94A50] bg-[#FEF2F2] border border-[#FECACA] rounded-lg">
              {createError}
            </div>
          )}
          <InputField
            label="Project Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Hillside Modern Courtyard Residence"
          />
          <InputField
            label="Project Brief / Notes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. 2-story 3-bedroom residence with open kitchen"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <SelectField
              label="Regional Cost Index"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            >
              {regions.map((r) => (
                <option key={r.regionName} value={r.regionName}>
                  {r.regionName} ({r.currency})
                </option>
              ))}
            </SelectField>
            <InputField
              label="Planned Floors"
              type="number"
              min={1}
              max={5}
              value={floorsCount}
              onChange={(e) => setFloorsCount(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="secondary" onClick={() => setNewModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
