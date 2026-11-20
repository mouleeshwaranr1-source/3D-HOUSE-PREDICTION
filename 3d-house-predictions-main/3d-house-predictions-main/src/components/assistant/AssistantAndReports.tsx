import React, { useEffect, useState } from 'react';
import JSZip from 'jszip';
import {
  CheckCircle2,
  Download,
  FileArchive,
  FileJson,
  FileSpreadsheet,
  MessageSquareText,
  Printer,
  Send,
  Settings,
} from 'lucide-react';
import { apiRequest, downloadSourceProjectZip } from '../../lib/api';
import type {
  CostBreakdownResult,
  ProjectRecord,
  RegionMultiplierItem,
  UserProfile,
} from '../../types/app';
import { formatArea, formatCurrency } from '../../types/app';
import {
  Button,
  Card,
  DataTable,
  InputField,
  SelectField,
  UserAvatar,
} from '../ui/Primitives';

export function AIAssistantView({
  projects,
  activeProject,
  onSelectProject,
}: {
  projects: ProjectRecord[];
  activeProject: ProjectRecord | null;
  onSelectProject: (id: number) => void;
}) {
  const [messages, setMessages] = useState<
    Array<{ role: 'user' | 'assistant'; text: string }>
  >([
    {
      role: 'assistant',
      text: activeProject
        ? `Ready to assist with "${activeProject.name}". Ask about room proportions, electrical circuit loads, plumbing runs, material substitutions, or cost reductions.`
        : 'Select a project to ask architectural, structural, MEP, or cost estimation questions.',
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        text: activeProject
          ? `Ready to assist with "${activeProject.name}". Ask about room proportions, electrical circuit loads, plumbing runs, material substitutions, or cost reductions.`
          : 'Select a project to ask architectural, structural, MEP, or cost estimation questions.',
      },
    ]);
    setInput('');
  }, [activeProject?.id]);

  const sendMessage = async (questionText?: string) => {
    const q = (questionText ?? input).trim();
    if (!q || !activeProject || sending) return;
    if (!questionText) setInput('');

    const nextHistory = [...messages, { role: 'user' as const, text: q }];
    setMessages(nextHistory);
    setSending(true);
    try {
      const data = await apiRequest<{ reply: string }>(
        `/api/projects/${activeProject.id}/assistant`,
        {
          method: 'POST',
          body: JSON.stringify({ question: q, history: messages }),
        }
      );
      setMessages([...nextHistory, { role: 'assistant', text: data.reply }]);
    } catch (err: any) {
      setMessages([
        ...nextHistory,
        { role: 'assistant', text: `Unable to complete query: ${err.message}` },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-[#171923]">
            AI House Assistant
          </h1>
          <p className="text-xs text-[#777B87] mt-0.5">
            Project-grounded architectural advisor connected to your real blueprint dimensions and cost index.
          </p>
        </div>
        {projects.length > 0 && activeProject && (
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
        )}
      </div>

      <Card padding="p-0" className="flex flex-col h-[560px]">
        <div className="px-4 py-3 border-b border-[#E5E6EB] flex flex-wrap gap-2">
          {[
            'How can I reduce total construction cost by 12%?',
            'Summarize electrical circuits and socket count by room.',
            'Are any room dimensions flagged for manual review?',
          ].map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={!activeProject || sending}
              onClick={() => sendMessage(prompt)}
              className="px-2.5 py-1 text-xs rounded-md border border-[#E5E6EB] bg-[#F1F0EC]/60 hover:bg-[#EEF1FF] text-[#171923] cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[82%] rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-[#3049F5] text-white'
                    : 'bg-[#F1F0EC]/70 border border-[#E5E6EB] text-[#171923]'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {sending && (
            <div className="text-xs text-[#777B87] flex items-center gap-2">
              <MessageSquareText size={14} className="text-[#3049F5]" />
              <span>Analyzing project geometry and cost ledger...</span>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="p-3 border-t border-[#E5E6EB] flex items-center gap-2 bg-white"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!activeProject || sending}
            placeholder={
              activeProject
                ? `Ask about ${activeProject.name}...`
                : 'Create or select a project first'
            }
            className="flex-1 h-10 px-3.5 text-sm border border-[#E5E6EB] rounded-lg focus:outline-none focus:border-[#3049F5]"
          />
          <Button type="submit" disabled={!activeProject || sending || !input.trim()}>
            <Send size={15} />
            <span>Send</span>
          </Button>
        </form>
      </Card>
    </div>
  );
}

export function ReportsExportsView({
  projects,
  activeProject,
  costBreakdown,
  onSelectProject,
}: {
  projects: ProjectRecord[];
  activeProject: ProjectRecord | null;
  costBreakdown: CostBreakdownResult | null;
  onSelectProject: (id: number) => void;
}) {
  const [downloadingSourceZip, setDownloadingSourceZip] = useState(false);
  const [downloadingProjectZip, setDownloadingProjectZip] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const downloadFile = (filename: string, content: string | Blob, mime: string) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const buildCsvContent = () => {
    if (!costBreakdown) return '';
    const headers = [
      'Room',
      'Type',
      'Floor',
      'Area_Sqm',
      'Material_Cost',
      'Labour_Cost',
      'Electrical_Cost',
      'Plumbing_Cost',
      'Interior_Cost',
      'Total_Cost',
    ];
    const rows = costBreakdown.roomWiseCosts.map((r) =>
      [
        `"${r.roomName}"`,
        r.roomType,
        r.floor,
        r.areaSqm,
        r.materialCost,
        r.labourCost,
        r.electricalCost,
        r.plumbingCost,
        r.interiorCost,
        r.totalCost,
      ].join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  };

  const handleExportCsv = () => {
    if (!activeProject || !costBreakdown) return;
    downloadFile(
      `${activeProject.name.replace(/\s+/g, '_')}_BOQ.csv`,
      buildCsvContent(),
      'text/csv'
    );
  };

  const handleExportJson = () => {
    if (!activeProject) return;
    downloadFile(
      `${activeProject.name.replace(/\s+/g, '_')}_Architectural_Package.json`,
      JSON.stringify({ project: activeProject, costBreakdown }, null, 2),
      'application/json'
    );
  };

  const handleExportProjectZip = async () => {
    if (!activeProject) return;
    setExportError(null);
    setDownloadingProjectZip(true);
    try {
      const zip = new JSZip();
      const safeName = activeProject.name.replace(/[^a-zA-Z0-9_-]+/g, '_');

      zip.file(
        `${safeName}_Architectural_Package.json`,
        JSON.stringify({ project: activeProject, costBreakdown }, null, 2)
      );

      if (costBreakdown && costBreakdown.roomWiseCosts.length > 0) {
        zip.file(`${safeName}_BOQ.csv`, buildCsvContent());
      }

      if (activeProject.blueprintFileUrl) {
        try {
          const bpRes = await fetch(activeProject.blueprintFileUrl);
          if (bpRes.ok) {
            const bpBlob = await bpRes.blob();
            const bpName = activeProject.blueprintFileName || 'blueprint_source';
            zip.file(`blueprint/${bpName}`, bpBlob);
          }
        } catch {
          // Optional blueprint attachment; proceed without failing package export
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadFile(`${safeName}_Package.zip`, zipBlob, 'application/zip');
    } catch (err: any) {
      setExportError(err?.message || 'Failed to build project ZIP package.');
    } finally {
      setDownloadingProjectZip(false);
    }
  };

  const handleDownloadSourceZip = async () => {
    setExportError(null);
    setDownloadingSourceZip(true);
    try {
      await downloadSourceProjectZip();
    } catch (err: any) {
      setExportError(err?.message || 'Failed to download application source ZIP.');
    } finally {
      setDownloadingSourceZip(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-[#171923]">
            Reports and Exports
          </h1>
          <p className="text-xs text-[#777B87] mt-0.5">
            Download Bill of Quantities (CSV), architectural ZIP packages, or the full project source code ZIP.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {projects.length > 0 && activeProject && (
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
          )}
          <Button
            variant="secondary"
            size="sm"
            disabled={!costBreakdown}
            onClick={handleExportCsv}
          >
            <FileSpreadsheet size={14} className="text-[#3049F5]" />
            <span>Export CSV BOQ</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!activeProject}
            onClick={handleExportJson}
          >
            <FileJson size={14} className="text-[#3049F5]" />
            <span>Export JSON</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!activeProject || downloadingProjectZip}
            onClick={handleExportProjectZip}
          >
            <FileArchive size={14} className="text-[#3049F5]" />
            <span>{downloadingProjectZip ? 'Zipping...' : 'Project ZIP'}</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={downloadingSourceZip}
            onClick={handleDownloadSourceZip}
          >
            <Download size={14} className="text-[#3049F5]" />
            <span>{downloadingSourceZip ? 'Preparing ZIP...' : 'App Source (.zip)'}</span>
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer size={14} />
            <span>Print Report</span>
          </Button>
        </div>
      </div>

      {exportError && (
        <div className="no-print flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#D94A50]">
          <span>{exportError}</span>
          <button
            type="button"
            onClick={() => setExportError(null)}
            className="text-[11px] font-medium underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {activeProject && costBreakdown ? (
        <Card className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E5E6EB] pb-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#171923]">
                {activeProject.name} — Architectural & Cost Schedule
              </h2>
              <p className="text-xs text-[#777B87] mt-1">
                Region: {costBreakdown.region} · Source: {costBreakdown.priceSource} · Updated{' '}
                {costBreakdown.lastUpdated}
              </p>
            </div>
            <div className="text-right font-mono-num">
              <span className="text-xs text-[#777B87] block">Approximate Total Estimate</span>
              <span className="text-xl font-semibold text-[#3049F5]">
                {formatCurrency(costBreakdown.totalHouseCost, costBreakdown.currency)}
              </span>
            </div>
          </div>

          <DataTable
            rows={costBreakdown.roomWiseCosts}
            columns={[
              { key: 'name', header: 'Room', render: (r) => <span className="font-medium text-xs">{r.roomName}</span> },
              { key: 'floor', header: 'Floor', render: (r) => <span className="font-mono-num text-xs">{r.floor}</span> },
              { key: 'area', header: 'Area', align: 'right', render: (r) => <span className="font-mono-num text-xs">{formatArea(r.areaSqm)}</span> },
              { key: 'mat', header: 'Materials', align: 'right', render: (r) => <span className="font-mono-num text-xs">{formatCurrency(r.materialCost, costBreakdown.currency)}</span> },
              { key: 'lab', header: 'Labour', align: 'right', render: (r) => <span className="font-mono-num text-xs">{formatCurrency(r.labourCost, costBreakdown.currency)}</span> },
              { key: 'total', header: 'Total', align: 'right', render: (r) => <span className="font-mono-num text-xs font-semibold">{formatCurrency(r.totalCost, costBreakdown.currency)}</span> },
            ]}
          />

          <p className="text-[11px] text-[#777B87]">
            Disclaimer: Estimates are preliminary approximations derived from regional indices and detected spatial areas. Licensed architectural, structural, and MEP reviews are required prior to permitting or construction.
          </p>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-[#777B87] flex items-center gap-2">
            <Download size={16} className="text-[#3049F5]" />
            <span>Select an analyzed project to preview and export architectural reports.</span>
          </p>
        </Card>
      )}
    </div>
  );
}

export function SettingsView({
  user,
  regions,
  onSaveProfile,
  onVerifyEmail,
}: {
  user: UserProfile;
  regions: RegionMultiplierItem[];
  onSaveProfile: (updates: {
    fullName: string;
    phone: string;
    preferences: { unit: 'm' | 'ft'; currency: string; region: string };
  }) => Promise<void>;
  onVerifyEmail: () => Promise<void>;
}) {
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone || '');
  const [unit, setUnit] = useState<'m' | 'ft'>(user.preferences?.unit || 'm');
  const [region, setRegion] = useState(
    user.preferences?.region || regions[0]?.regionName || 'Global Standard'
  );
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setFullName(user.fullName);
    setPhone(user.phone || '');
    setUnit(user.preferences?.unit || 'm');
    setRegion(user.preferences?.region || regions[0]?.regionName || 'Global Standard');
  }, [user, regions]);

  const selectedRegionObj = regions.find((r) => r.regionName === region);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(false);
    setErrorMsg(null);
    try {
      await onSaveProfile({
        fullName,
        phone,
        preferences: {
          unit,
          region,
          currency: selectedRegionObj?.currency || 'USD',
        },
      });
      setSavedNotice(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save workspace settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyEmailClick = async () => {
    setVerifying(true);
    setErrorMsg(null);
    try {
      await onVerifyEmail();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Email verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-[#171923]">
          Workspace Settings
        </h1>
        <p className="text-xs text-[#777B87] mt-0.5">
          Manage your account profile, architectural measurement units, and default regional cost index.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#E5E6EB]">
            <div className="flex items-center gap-3">
              <UserAvatar name={fullName || user.fullName} email={user.email} size="lg" />
              <div>
                <h2 className="text-sm font-semibold text-[#171923] flex items-center gap-1.5">
                  <Settings size={14} className="text-[#3049F5]" />
                  <span>Profile & Preferences</span>
                </h2>
                <p className="text-[11px] text-[#777B87]">{user.email}</p>
              </div>
            </div>
          </div>

          <InputField
            label="Full Name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Email Address" value={user.email} disabled />
            <InputField
              label="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label="Default Measurement Unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as 'm' | 'ft')}
            >
              <option value="m">Metric (Meters / m²)</option>
              <option value="ft">Imperial (Feet / sq ft)</option>
            </SelectField>
            <SelectField
              label="Default Regional Cost Database"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              {regions.map((r) => (
                <option key={r.regionName} value={r.regionName}>
                  {r.regionName} ({r.currency})
                </option>
              ))}
            </SelectField>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#E5E6EB]">
            <div className="text-xs">
              {user.emailVerified ? (
                <span className="inline-flex items-center gap-1.5 text-[#249B67]">
                  <CheckCircle2 size={14} /> Email Verified
                </span>
              ) : (
                <button
                  type="button"
                  disabled={verifying}
                  onClick={handleVerifyEmailClick}
                  className="text-[#E8A13A] hover:underline cursor-pointer disabled:opacity-60"
                >
                  {verifying ? 'Verifying...' : 'Verify Email Address Now'}
                </button>
              )}
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
          {errorMsg && (
            <p className="text-xs text-[#D94A50]">{errorMsg}</p>
          )}
          {savedNotice && (
            <p className="text-xs text-[#249B67]">Settings saved to PostgreSQL.</p>
          )}
        </form>
      </Card>

      <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[#171923] flex items-center gap-1.5">
            <FileArchive size={15} className="text-[#3049F5]" />
            <span>Download Full Project Source (.zip)</span>
          </h2>
          <p className="text-xs text-[#777B87] mt-1">
            Package all application source files, configuration, and assets into a portable ZIP archive (secrets and dependencies excluded).
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={downloadingZip}
          onClick={async () => {
            setDownloadingZip(true);
            setErrorMsg(null);
            try {
              await downloadSourceProjectZip();
            } catch (err: any) {
              setErrorMsg(err?.message || 'Failed to download project ZIP.');
            } finally {
              setDownloadingZip(false);
            }
          }}
          className="shrink-0"
        >
          <Download size={14} className="text-[#3049F5]" />
          <span>{downloadingZip ? 'Preparing ZIP...' : 'Download .zip'}</span>
        </Button>
      </Card>
    </div>
  );
}
