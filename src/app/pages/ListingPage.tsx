import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Plus, Search, MoreHorizontal, Eye, Edit2, Info,
  Play, Square, CheckCircle, Copy, Trash2, X,
  Layers, AlertTriangle,
} from 'lucide-react';
import { useConfigs } from '../store/ConfigContext';
import StatusBadge from '../components/remote-config/StatusBadge';
import { Status, ConfigType, RemoteConfig } from '../types';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

function TypeBadge({ type }: { type: ConfigType }) {
  return (
    <span
      className="inline-flex items-center rounded-md"
      style={{ background: '#F3F4F6', color: '#374151', fontSize: 12, fontWeight: 500, padding: '4px 10px', lineHeight: 1 }}
    >
      {type}
    </span>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 200, background: 'rgba(17,24,39,0.5)' }} onClick={onClose}>
      <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', maxWidth: 480, width: '90%', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

const CREATOR_NAMES = ['Emre Sumer', 'Emre Demir', 'Can Aydin', 'Deniz Kaya', 'Aylin Yildiz'];

function hashSeed(seed: string) {
  return seed.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 7);
}

function getSegmentUsers(seed: string) {
  const hash = hashSeed(`users-${seed}`);
  return ((hash % 85000) + 1200).toLocaleString('en-US');
}

function getCreatorAndDate(seed: string) {
  const hash = hashSeed(`creator-${seed}`);
  const name = CREATOR_NAMES[hash % CREATOR_NAMES.length];
  const day = ((hash % 28) + 1).toString().padStart(2, '0');
  const month = ((((hash >>> 3) % 12) + 1)).toString().padStart(2, '0');
  const year = 2024 + ((hash >>> 7) % 3);
  return { name, date: `${day}.${month}.${year}` };
}

function getRandomName(seed: string) {
  const hash = hashSeed(`name-${seed}`);
  return CREATOR_NAMES[hash % CREATOR_NAMES.length];
}

export default function ListingPage() {
  const navigate = useNavigate();
  const { configs, startConfig, stopConfig, completeConfig, duplicateConfig, deleteConfig, stopAndCreateNewVersion } = useConfigs();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<Status | 'All'>('All');
  const [filterType, setFilterType] = useState<ConfigType | 'All'>('All');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RemoteConfig | null>(null);
  const [stopTarget, setStopTarget] = useState<RemoteConfig | null>(null);

  const filtered = useMemo(() => configs.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.key.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== 'All' && c.status !== filterStatus) return false;
    if (filterType !== 'All' && c.type !== filterType) return false;
    return true;
  }), [configs, search, filterStatus, filterType]);

  const hasActiveFilters = filterStatus !== 'All' || filterType !== 'All' || search !== '';

  const clearFilters = () => {
    setFilterStatus('All');
    setFilterType('All');
    setSearch('');
  };

  const handleEdit = (config: RemoteConfig) => {
    if (config.status === 'LIVE') { setStopTarget(config); return; }
    if (config.status === 'COMPLETED') return;
    navigate(`/edit_remote_configuration/${config.id}`);
  };

  function SelectFilter({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
    return (
      <div className="shrink-0">
        <Select
          value={value}
          onValueChange={(next) => { onChange(next); }}
        >
          <SelectTrigger
            className="h-9 min-w-36 rounded-lg border px-3 text-[13px] font-medium text-[#111827] shadow-none"
            style={{ borderColor: '#E5E7EB', background: '#FFFFFF' }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-lg border border-[#E5E7EB]">
            {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="p-6" style={{ minHeight: '100%', background: '#F9FAFB', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-full" style={{ width: 4, height: 36, background: '#2563EB', marginTop: 2 }} />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.3 }}>Remote Configuration</h1>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '3px 0 0', fontWeight: 400 }}>
              Control app behavior and features without releasing a new version.
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/create_remote_configuration')}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 transition-opacity hover:opacity-90"
          style={{ background: '#2563EB', color: '#FFFFFF', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}
        >
          <Plus size={15} />
          Create Configuration
        </button>
      </div>

      {/* Search + Filters */}
      <div style={{ marginBottom: 16 }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 rounded-lg px-3" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', height: 36, minWidth: 280, flex: '1 1 auto', maxWidth: 440 }}>
            <Search size={14} color="#9CA3AF" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); }}
              placeholder="Search configurations by name"
              className="flex-1 bg-transparent outline-none"
              style={{ fontSize: 13, color: '#374151', border: 'none', fontFamily: 'Inter, sans-serif' }}
            />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={12} color="#9CA3AF" /></button>}
          </div>
          <div className="flex items-center justify-end gap-3" style={{ minWidth: 308 }}>
            <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>Filter:</span>
            <SelectFilter value={filterStatus} onChange={v => setFilterStatus(v as any)} options={[{ value: 'All', label: 'All Statuses' }, { value: 'DRAFT', label: 'Draft' }, { value: 'LIVE', label: 'Live' }, { value: 'STOPPED', label: 'Stopped' }, { value: 'COMPLETED', label: 'Completed' }]} />
            <SelectFilter value={filterType} onChange={v => setFilterType(v as any)} options={[{ value: 'All', label: 'All Types' }, { value: 'Boolean', label: 'Boolean' }, { value: 'String', label: 'String' }, { value: 'Integer', label: 'Integer' }, { value: 'JSON', label: 'JSON' }]} />
          </div>
        </div>
        {hasActiveFilters && (
          <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
            <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
              Showing <strong style={{ color: '#111827' }}>{filtered.length}</strong> of {configs.length} configurations
            </p>
            <button onClick={clearFilters} className="flex items-center gap-1 px-3 rounded-lg" style={{ height: 30, fontSize: 12, color: '#2563EB', background: '#EFF6FF', border: '1px solid #BFDBFE', cursor: 'pointer', fontWeight: 500 }}>
              <X size={11} /> Clear
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
        {filtered.length === 0 ? (
          <EmptyState hasFilters={hasActiveFilters} onClear={clearFilters} onCreate={() => navigate('/create_remote_configuration')} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                    {['STATUS', 'CONFIGURATION NAME', 'TYPE', 'DESCRIPTION', 'USER COUNT', 'CREATED BY', 'LAST EDITED', ''].map(col => (
                      <th
                        key={col}
                        style={{
                          padding: '12px 16px',
                          textAlign: col === 'USER COUNT' ? 'center' : 'left',
                          fontSize: 12,
                          fontWeight: 500,
                          color: '#6B7280',
                          letterSpacing: '0.06em',
                          whiteSpace: 'nowrap',
                          textTransform: 'uppercase',
                        }}
                      >
                        {col === 'USER COUNT' ? (
                          <span className="inline-flex items-center gap-1" style={{ textTransform: 'uppercase' }}>
                            USER COUNT
                            <Tooltip delayDuration={150}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  aria-label="User count information"
                                  style={{ border: 'none', background: 'transparent', padding: 0, display: 'inline-flex', cursor: 'help', color: '#6B7280' }}
                                >
                                  <Info size={12} />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                sideOffset={6}
                                style={{ background: '#111827', color: '#FFFFFF', padding: 12, borderRadius: 6, boxShadow: '0 10px 24px rgba(17, 24, 39, 0.2)', textTransform: 'none', letterSpacing: 'normal', maxWidth: 340 }}
                              >
                                <span style={{ display: 'block', lineHeight: 1.45, fontSize: 12, fontWeight: 500 }}>
                                  User Count displays the total number of users who got exposed to the given configuration.
                                </span>
                              </TooltipContent>
                            </Tooltip>
                          </span>
                        ) : col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((config, idx) => (
                    <TableRow
                      key={config.id}
                      config={config}
                      isLast={idx === filtered.length - 1}
                      openMenu={openMenu}
                      setOpenMenu={setOpenMenu}
                      onView={() => navigate(`/view_remote_configuration/${config.id}`)}
                      onEdit={() => handleEdit(config)}
                      onStart={() => { startConfig(config.id); setOpenMenu(null); }}
                      onStop={() => { stopConfig(config.id); setOpenMenu(null); }}
                      onComplete={() => { completeConfig(config.id); setOpenMenu(null); }}
                      onDuplicate={() => { duplicateConfig(config.id); setOpenMenu(null); }}
                      onDelete={() => { setDeleteTarget(config); setOpenMenu(null); }}
                    />
                  ))}
                </tbody>
              </table>
            </div>

          </>
        )}
      </div>

      {openMenu && <div className="fixed inset-0" style={{ zIndex: 50 }} onClick={() => setOpenMenu(null)} />}

      {/* Delete Modal */}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <div className="flex items-start gap-3 mb-4">
            <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 42, height: 42, background: '#FEE2E2' }}>
              <Trash2 size={18} color="#EF4444" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>Delete Configuration</h3>
              <p style={{ fontSize: 13, color: '#6B7280', margin: '6px 0 0', lineHeight: 1.6 }}>
                Are you sure you want to delete <strong style={{ color: '#111827' }}>{deleteTarget.name}</strong>? This action cannot be undone and all configuration data will be lost.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setDeleteTarget(null)} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, color: '#374151', background: '#F3F4F6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={() => { deleteConfig(deleteTarget.id); setDeleteTarget(null); }} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#FFFFFF', background: '#EF4444', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              Delete Configuration
            </button>
          </div>
        </Modal>
      )}

      {/* Stop & Edit Modal */}
      {stopTarget && (
        <Modal onClose={() => setStopTarget(null)}>
          <div className="flex items-start gap-3 mb-4">
            <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 42, height: 42, background: '#FEF3C7' }}>
              <AlertTriangle size={18} color="#F59E0B" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>Configuration is Currently LIVE</h3>
              <p style={{ fontSize: 13, color: '#6B7280', margin: '6px 0 0', lineHeight: 1.6 }}>
                To edit <strong style={{ color: '#111827' }}>{stopTarget.name}</strong>, you must stop the current version. Stopping will preserve all reporting data and create a new editable version.
              </p>
            </div>
          </div>
          <div className="rounded-xl p-4 mt-2" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge status="LIVE" />
              <span style={{ fontSize: 12, color: '#6B7280' }}>{stopTarget.version} → will be marked as STOPPED</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status="DRAFT" />
              <span style={{ fontSize: 12, color: '#6B7280' }}>
                v{stopTarget.versionMajor}.{stopTarget.versionMinor + 1} → new editable draft created
              </span>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setStopTarget(null)} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, color: '#374151', background: '#F3F4F6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              onClick={() => {
                const newConfig = stopAndCreateNewVersion(stopTarget.id);
                setStopTarget(null);
                navigate(`/edit_remote_configuration/${newConfig.id}`);
              }}
              style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#FFFFFF', background: '#2563EB', border: 'none', borderRadius: 8, cursor: 'pointer' }}
            >
              Stop & Create New Version
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function TableRow({
  config, isLast, openMenu, setOpenMenu,
  onView, onEdit, onStart, onStop, onComplete, onDuplicate, onDelete
}: {
  config: RemoteConfig; isLast: boolean; openMenu: string | null; setOpenMenu: (id: string | null) => void;
  onView: () => void; onEdit: () => void; onStart: () => void; onStop: () => void;
  onComplete: () => void; onDuplicate: () => void; onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isMenuOpen = openMenu === config.id;
  const createdBy = getCreatorAndDate(config.id);

  const canStart = config.status === 'DRAFT' || config.status === 'STOPPED';
  const canStop = config.status === 'LIVE';
  const canComplete = config.status === 'LIVE';
  const canEdit = config.status !== 'COMPLETED';
  const canDelete = config.status !== 'LIVE' && config.status !== 'COMPLETED';

  return (
    <tr
      style={{ borderBottom: isLast ? 'none' : '1px solid #F3F4F6', background: hovered ? '#F9FAFB' : 'transparent', transition: 'background 0.1s', height: 48 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
        <StatusBadge status={config.status} />
      </td>
      <td style={{ padding: '10px 16px', maxWidth: 220, verticalAlign: 'middle' }}>
        <div className="flex items-center gap-2">
          <div>
            <ConfigurationNameText text={config.name} onClick={onView} />
            <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 1 }}>{config.configKey || config.key || '-'}</div>
          </div>
        </div>
      </td>
      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
        <TypeBadge type={config.type} />
      </td>
      <td style={{ padding: '10px 16px', maxWidth: 320, verticalAlign: 'middle' }}>
        <DescriptionText text={config.description} />
      </td>
      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', verticalAlign: 'middle', textAlign: 'center' }}>
        <SegmentUsersText value={getSegmentUsers(config.id)} />
      </td>
      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
        <div style={{ fontSize: 12, color: '#374151' }}>{createdBy.name}</div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{createdBy.date}</div>
      </td>
      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
        <div style={{ fontSize: 12, color: '#374151' }}>{getRandomName(`last-edited-${config.id}`)}</div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{config.lastEdited}</div>
      </td>
      <td style={{ padding: '10px 12px', position: 'relative', verticalAlign: 'middle' }}>
        <div className="relative" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setOpenMenu(isMenuOpen ? null : config.id)}
            className="flex items-center justify-center rounded-lg transition-colors"
            style={{ width: 30, height: 30, border: 'none', cursor: 'pointer', background: isMenuOpen ? '#F3F4F6' : 'transparent' }}
          >
            <MoreHorizontal size={16} color="#6B7280" />
          </button>
          {isMenuOpen && (
            <div
              className="absolute right-0 mt-1 rounded-xl overflow-hidden py-1"
              style={{ zIndex: 100, background: '#FFFFFF', border: '1px solid #E5E7EB', top: '100%', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', minWidth: 168 }}
              onClick={e => e.stopPropagation()}
            >
              {[
                { icon: Eye, label: 'View', action: onView, show: true, disabled: false, danger: false },
                { icon: Edit2, label: 'Edit', action: onEdit, show: canEdit, disabled: false, danger: false, note: config.status === 'LIVE' ? 'Stop first' : undefined },
                { icon: Play, label: 'Start', action: onStart, show: canStart, disabled: false, danger: false },
                { icon: Square, label: 'Stop', action: onStop, show: canStop, disabled: false, danger: false },
                { icon: CheckCircle, label: 'Complete', action: onComplete, show: canComplete, disabled: false, danger: false },
                null,
                { icon: Copy, label: 'Duplicate', action: onDuplicate, show: true, disabled: false, danger: false },
                { icon: Trash2, label: 'Delete', action: onDelete, show: true, disabled: !canDelete, danger: true, note: !canDelete ? 'Not allowed' : undefined },
              ].map((item, i) => {
                if (item === null) return <div key={i} style={{ height: 1, background: '#F3F4F6', margin: '4px 0' }} />;
                if (!item.show) return null;
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => { if (!item.disabled) { item.action(); setOpenMenu(null); } }}
                    disabled={item.disabled}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-left"
                    style={{ fontSize: 13, color: item.disabled ? '#D1D5DB' : item.danger ? '#EF4444' : '#374151', cursor: item.disabled ? 'not-allowed' : 'pointer', background: 'transparent', border: 'none', fontFamily: 'Inter, sans-serif' }}
                    onMouseEnter={e => { if (!item.disabled) (e.currentTarget as HTMLElement).style.background = '#F9FAFB'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <Icon size={13} />
                    <span>{item.label}</span>
                    {item.note && <span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 'auto' }}>{item.note}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function ConfigurationNameText({ text, onClick }: { text: string; onClick: () => void }) {
  const content = (
    <span
      className="cursor-pointer"
      onClick={onClick}
      style={{ display: 'inline-block', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600, color: '#111827' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#2563EB'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#111827'}
    >
      {text}
    </span>
  );

  if (text.trim().length <= 30) return content;

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        {content}
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="border-0 text-left"
        style={{ background: '#111827', color: '#FFFFFF', padding: 12, borderRadius: 6, boxShadow: '0 10px 24px rgba(17, 24, 39, 0.2)', maxWidth: 420, whiteSpace: 'normal', wordBreak: 'break-word' }}
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function DescriptionText({ text }: { text: string }) {
  const MAX_DESC_CHARS = 25;
  const trimmed = text.trim();
  const displayText = trimmed.length > MAX_DESC_CHARS ? `${trimmed.slice(0, MAX_DESC_CHARS)}...` : text;

  const content = (
    <span
      style={{
        display: 'block',
        width: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: 12,
        color: '#4B5563'
      }}
    >
      {displayText}
    </span>
  );

  if (trimmed.length <= MAX_DESC_CHARS) return content;

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        {content}
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="border-0 text-left max-w-[420px]"
        style={{ background: '#111827', color: '#FFFFFF', padding: 12, borderRadius: 6, boxShadow: '0 10px 24px rgba(17, 24, 39, 0.2)', maxWidth: 560, whiteSpace: 'normal', wordBreak: 'break-word' }}
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function SegmentUsersText({ value }: { value: string }) {
  return <span style={{ fontSize: 12, color: '#6B7280' }}>{value}</span>;
}

function EmptyState({ hasFilters, onClear, onCreate }: { hasFilters: boolean; onClear: () => void; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="flex items-center justify-center rounded-2xl mb-5" style={{ width: 72, height: 72, background: '#EFF6FF' }}>
        <Layers size={32} color="#2563EB" />
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
        {hasFilters ? 'No Configurations Found' : 'Control Your Application Without Releasing New Versions'}
      </h3>
      <p style={{ fontSize: 13, color: '#6B7280', maxWidth: 420, margin: '0 0 24px', lineHeight: 1.6 }}>
        {hasFilters
          ? 'No configurations match your current filters. Try adjusting your search or filter criteria.'
          : 'Remote configurations let you change app behavior, run A/B tests, and roll out features to specific user segments — all without a new release.'}
      </p>
      {hasFilters ? (
        <button onClick={onClear} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, color: '#2563EB', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, cursor: 'pointer' }}>
          Clear Filters
        </button>
      ) : (
        <button onClick={onCreate} className="flex items-center gap-2" style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, color: '#FFFFFF', background: '#2563EB', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          <Plus size={14} />
          Create First Configuration
        </button>
      )}
    </div>
  );
}
