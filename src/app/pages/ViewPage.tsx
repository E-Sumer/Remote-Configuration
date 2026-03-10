import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  Edit2, Play, Square, ChevronDown, ChevronRight,
  BarChart2, Settings, Clock, Users, TrendingUp, Award, Zap, AlertTriangle,
  Copy, Target, Info, ChevronUp
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { useConfigs } from '../store/ConfigContext';
import StatusBadge from '../components/remote-config/StatusBadge';
import { RemoteConfig, Status } from '../types';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  Boolean: { bg: '#FEF3C7', text: '#92400E' },
  String:  { bg: '#EDE9FE', text: '#5B21B6' },
  Integer: { bg: '#DBEAFE', text: '#1E40AF' },
  JSON:    { bg: '#FCE7F3', text: '#9D174D' },
};

const REPORT_COLORS = ['#6B7280', '#2563EB', '#7C3AED', '#0EA5E9', '#14B8A6', '#22C55E', '#F59E0B', '#EF4444'];

function formatVariantAxisLabel(name: string) {
  const trimmed = name.trim();
  if (trimmed.length <= 14) return trimmed;
  return `${trimmed.slice(0, 13)}.`;
}

function StatCard({ label, value, sub, color, icon: Icon }: { label: string; value: string; sub?: string; color: string; icon: any }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center justify-center rounded-lg" style={{ width: 30, height: 30, background: `${color}15` }}>
          <Icon size={15} color={color} />
        </div>
        <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: color, fontWeight: 500, marginTop: 4 }}>{sub}</div>}
    </div>
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

function parsePayloadValue(value: string, type: string): unknown {
  if (type === 'Boolean') return value === 'true';
  if (type === 'Integer') {
    const n = Number(value);
    return Number.isNaN(n) ? 0 : n;
  }
  if (type === 'JSON') {
    try { return JSON.parse(value || '{}'); } catch { return {}; }
  }
  return value;
}

export default function ViewPage() {
  const { config_id } = useParams();
  const navigate = useNavigate();
  const { getConfigById, startConfig, stopConfig, duplicateConfig, stopAndCreateNewVersion } = useConfigs();

  const config = getConfigById(config_id || '');
  const [activeTab, setActiveTab] = useState<'configuration' | 'report'>('configuration');
  const [stopModal, setStopModal] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set(config?.keys.map(k => k.id) || []));
  const [expandedHistory, setExpandedHistory] = useState(true);

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ fontFamily: 'Inter, sans-serif' }}>
        <div style={{ fontSize: 15, color: '#6B7280' }}>Configuration not found.</div>
        <button onClick={() => navigate('/remote_configuration')} className="mt-3" style={{ fontSize: 13, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer' }}>← Back to listing</button>
      </div>
    );
  }

  const canEdit = config.status !== 'COMPLETED';
  const isLive = config.status === 'LIVE';
  const isCompleted = config.status === 'COMPLETED';
  const primaryAction = config.status === 'LIVE'
    ? { label: 'Stop', onClick: () => stopConfig(config.id), icon: Square, color: '#EF4444', bg: '#FEE2E2', border: '#FECACA' }
    : config.status === 'COMPLETED'
      ? { label: 'Duplicate', onClick: () => { duplicateConfigAndStay(); }, icon: Copy, color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' }
      : { label: config.status === 'STOPPED' ? 'Restart' : 'Start', onClick: () => startConfig(config.id), icon: Play, color: '#FFFFFF', bg: '#2563EB', border: '#2563EB' };

  function duplicateConfigAndStay() {
    const duplicated = duplicateConfig(config.id);
    navigate(`/view_remote_configuration/${duplicated.id}`);
  }

  const handleEdit = () => {
    if (isLive) { setStopModal(true); return; }
    if (!isCompleted) navigate(`/edit_remote_configuration/${config.id}`);
  };

  return (
    <div className="p-6" style={{ minHeight: '100%', background: '#F9FAFB', fontFamily: 'Inter, sans-serif', paddingBottom: 92 }}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>{config.name}</h1>
          <StatusBadge status={config.status} size="md" />
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'monospace' }}>{config.configKey || config.key || '-'}</div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 rounded-xl p-1" style={{ background: '#F3F4F6', width: 'fit-content' }}>
        {[
          { key: 'configuration', label: 'Configuration', icon: Settings },
          { key: 'report', label: 'Report', icon: BarChart2 },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all"
            style={{
              fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: activeTab === tab.key ? '#FFFFFF' : 'transparent',
              color: activeTab === tab.key ? '#111827' : '#6B7280',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'configuration' && (
        <ConfigurationTab
          config={config}
          expandedKeys={expandedKeys}
          setExpandedKeys={setExpandedKeys}
          expandedHistory={expandedHistory}
          setExpandedHistory={setExpandedHistory}
        />
      )}

      {activeTab === 'report' && (
        <ReportTab config={config} onDeclareWinner={() => {}} onFullRollout={() => {}} onStop={() => stopConfig(config.id)} />
      )}

      {/* Stop & Edit Modal */}
      {stopModal && (
        <Modal onClose={() => setStopModal(false)}>
          <div className="flex items-start gap-3 mb-4">
            <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 42, height: 42, background: '#FEF3C7' }}>
              <AlertTriangle size={18} color="#F59E0B" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>Configuration is Currently LIVE</h3>
              <p style={{ fontSize: 13, color: '#6B7280', margin: '6px 0 0', lineHeight: 1.6 }}>
                To edit, you must stop the current version. Stopping will preserve reporting and create a new editable version.
              </p>
            </div>
          </div>
          <div className="rounded-xl p-4" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge status="LIVE" />
              <span style={{ fontSize: 12, color: '#6B7280' }}>{config.version} → will be STOPPED</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status="DRAFT" />
              <span style={{ fontSize: 12, color: '#6B7280' }}>v{config.versionMajor}.{config.versionMinor + 1} → new editable version</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setStopModal(false)} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, color: '#374151', background: '#F3F4F6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
            <button
              onClick={() => {
                const newConfig = stopAndCreateNewVersion(config.id);
                setStopModal(false);
                navigate(`/edit_remote_configuration/${newConfig.id}`);
              }}
              style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#FFFFFF', background: '#2563EB', border: 'none', borderRadius: 8, cursor: 'pointer' }}
            >
              Stop & Create New Version
            </button>
          </div>
        </Modal>
      )}

      <div className="p-3 flex justify-end" style={{ position: 'fixed', left: 350, right: 0, bottom: 0, zIndex: 20, background: '#FFFFFF', borderTop: '1px solid #E5E7EB', borderLeft: '1px solid #E5E7EB', paddingLeft: 24, paddingRight: 24 }}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/remote_configuration')}
            className="px-4 rounded-lg"
            style={{ height: 40, fontSize: 13, fontWeight: 600, color: '#374151', background: '#FFFFFF', border: '1px solid #E5E7EB', cursor: 'pointer' }}
          >
            Back
          </button>
          <button
            onClick={handleEdit}
            disabled={!canEdit}
            className="flex items-center gap-1.5 px-4 rounded-lg"
            style={{ height: 40, fontSize: 13, fontWeight: 600, color: canEdit ? '#374151' : '#9CA3AF', background: '#FFFFFF', border: '1px solid #E5E7EB', cursor: canEdit ? 'pointer' : 'not-allowed' }}
          >
            <Edit2 size={13} />
            Edit
          </button>
          <button
            onClick={primaryAction.onClick}
            className="flex items-center gap-1.5 px-4 rounded-lg"
            style={{ height: 40, fontSize: 13, fontWeight: 700, color: primaryAction.color, background: primaryAction.bg, border: `1px solid ${primaryAction.border}`, cursor: 'pointer' }}
          >
            <primaryAction.icon size={13} />
            {primaryAction.label}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfigurationTab({ config, expandedKeys, setExpandedKeys, expandedHistory, setExpandedHistory }: {
  config: RemoteConfig; expandedKeys: Set<string>; setExpandedKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandedHistory: boolean; setExpandedHistory: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const typeColor = TYPE_COLORS[config.type] || { bg: '#F3F4F6', text: '#374151' };
  const keys = config.keys || [];
  const detailItems: Array<{ label: string; value: React.ReactNode }> = [
    { label: 'Type', value: <span style={{ background: typeColor.bg, color: typeColor.text, padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>{config.type}</span> },
    { label: 'Target Segment', value: config.targetSegment },
    { label: 'Rollout', value: `${config.rolloutPercentage}%` },
    {
      label: 'Conversion Goal',
      value: config.conversionGoal?.eventName ? (
        <div>
          <div style={{ fontSize: 12, color: '#374151' }}>Event: {config.conversionGoal.eventName}</div>
          {config.conversionGoal.attribute && <div style={{ fontSize: 12, color: '#6B7280' }}>Attribute: {config.conversionGoal.attribute}</div>}
          {config.conversionGoal.attribute && config.conversionGoal.attributeValue && <div style={{ fontSize: 12, color: '#6B7280' }}>Value: {config.conversionGoal.attributeValue}</div>}
        </div>
      ) : (
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>Not selected</span>
      ),
    },
    { label: 'Variants', value: `${config.variantsCount} variants` },
    { label: 'Created By', value: config.createdBy },
    { label: 'Created', value: config.createdAt },
    { label: 'Status', value: <StatusBadge status={config.status} /> },
    { label: 'Version', value: <code style={{ fontSize: 11, fontFamily: 'monospace' }}>{config.version}</code> },
    { label: 'Last Edited', value: config.lastEdited },
  ];

  return (
    <div className="grid grid-cols-3 gap-5">
      <div className="col-span-2 flex flex-col gap-4">
        <div className="rounded-xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>Overview</h3>
          <div className="grid grid-cols-3 gap-4">
            {detailItems.map(item => (
              <div key={item.label}>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.04em', marginBottom: 4 }}>{item.label.toUpperCase()}</div>
                <div style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>Keys & Variants</h3>
          </div>
          {keys.map(keyObj => {
            const isExpanded = expandedKeys.has(keyObj.id);
            return (
              <div key={keyObj.id} style={{ borderBottom: '1px solid #F9FAFB' }}>
                <div
                  className="flex items-center gap-3 px-5 py-3 cursor-pointer"
                  style={{ background: '#FAFAFA' }}
                  onClick={() => setExpandedKeys(prev => { const s = new Set(prev); if (s.has(keyObj.id)) s.delete(keyObj.id); else s.add(keyObj.id); return s; })}
                >
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#111827', fontFamily: 'monospace' }}>{keyObj.name}</div>
                  <span style={{ fontSize: 11, color: '#6B7280' }}>{keyObj.variants.length || 0} variants</span>
                  {isExpanded ? <ChevronUp size={15} color="#6B7280" /> : <ChevronDown size={15} color="#6B7280" />}
                </div>
                {isExpanded && (
                  <div className="px-5 pb-4">
                    {keyObj.variants.length === 0 ? (
                      <div className="rounded-lg p-3" style={{ border: '1px dashed #D1D5DB', background: '#F9FAFB', fontSize: 12, color: '#6B7280' }}>
                        No variants configured. All users receive the default configuration.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {keyObj.variants.map(variant => (
                          <div key={variant.id} className="rounded-lg p-3" style={{ background: '#FFFFFF', border: `1px solid ${variant.isControl ? '#BBF7D0' : '#E5E7EB'}` }}>
                            <div className="flex items-center justify-between mb-1">
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
                                {variant.name?.trim() || (variant.role === 'control' || variant.isControl ? 'Control' : 'Variant')}
                              </div>
                              <span style={{ fontSize: 11, color: '#6B7280' }}>Traffic: {variant.traffic}%</span>
                            </div>
                            <div style={{ fontSize: 11, color: '#6B7280', fontFamily: 'monospace', marginBottom: 6 }}>
                              {variant.value.length > 90 ? `${variant.value.slice(0, 90)}...` : variant.value || '—'}
                            </div>
                            <div className="rounded-full overflow-hidden" style={{ width: '100%', height: 6, background: '#E5E7EB' }}>
                              <div className="h-full rounded-full" style={{ width: `${variant.traffic}%`, background: variant.isControl ? '#22C55E' : '#2563EB' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
          <button
            className="w-full flex items-center justify-between px-5 py-4"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
            onClick={() => setExpandedHistory(v => !v)}
          >
            <div className="flex items-center gap-2">
              <Clock size={14} color="#6B7280" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Version History</span>
              <span className="px-1.5 py-0.5 rounded-full" style={{ fontSize: 10, color: '#6B7280', background: '#F3F4F6', fontWeight: 600 }}>{config.versionHistory.length}</span>
            </div>
            {expandedHistory ? <ChevronUp size={14} color="#9CA3AF" /> : <ChevronDown size={14} color="#9CA3AF" />}
          </button>

          {expandedHistory && (
            <div className="px-5 pb-4">
              <div className="relative">
                <div className="absolute left-2.5 top-0 bottom-0" style={{ width: 1, background: '#E5E7EB' }} />
                {[...config.versionHistory].reverse().map((entry) => (
                  <div key={entry.version} className="relative flex items-start gap-3 mb-4 last:mb-0">
                    <div
                      className="relative rounded-full shrink-0 flex items-center justify-center"
                      style={{ width: 16, height: 16, background: '#FFFFFF', border: `2px solid ${entry.version === config.version ? '#2563EB' : '#D1D5DB'}`, zIndex: 1, marginTop: 2 }}
                    >
                      <div className="rounded-full" style={{ width: 6, height: 6, background: entry.version === config.version ? '#2563EB' : '#D1D5DB' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <Tooltip delayDuration={150}>
                          <TooltipTrigger asChild>
                            <span style={{ fontSize: 12, fontWeight: 700, color: entry.version === config.version ? '#2563EB' : '#111827', fontFamily: 'monospace', cursor: 'help' }}>
                              {entry.version} {entry.version === config.version ? '(Current)' : ''}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" sideOffset={6} style={{ background: '#111827', color: '#FFFFFF', padding: 12, borderRadius: 6, maxWidth: 280 }}>
                            {entry.notes}
                          </TooltipContent>
                        </Tooltip>
                        <StatusBadge status={entry.status} showDot={false} />
                      </div>
                      <div style={{ fontSize: 10, color: '#9CA3AF' }}>{entry.date} · {entry.author}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {config.usedInCampaign && (
          <div className="rounded-xl p-4" style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} color="#F59E0B" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>Used in Active Campaign</span>
            </div>
            <p style={{ fontSize: 12, color: '#78350F', margin: 0, lineHeight: 1.5 }}>
              Changes to this configuration may impact a live campaign. Review before making modifications.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportTab({ config, onDeclareWinner, onFullRollout, onStop }: {
  config: RemoteConfig; onDeclareWinner: () => void; onFullRollout: () => void; onStop: () => void;
}) {
  const canDeclareWinner = config.status === 'LIVE';
  const sourceVariants = (config.keys?.[0]?.variants || []).slice(0, 8);
  const normalizedVariants = (sourceVariants.length > 0 ? sourceVariants : [{
    id: 'control_fallback',
    name: 'Control',
    value: '',
    traffic: 100,
    isControl: true,
    role: 'control' as const,
  }]).map((variant, index) => {
    const isControl = Boolean(variant.isControl || variant.role === 'control' || index === 0);
    const name = variant.name?.trim() || (isControl ? 'Control' : `Variant ${String.fromCharCode(65 + index)}`);
    const traffic = Math.max(0, Math.min(100, Number(variant.traffic) || 0));
    const rate = isControl ? 3.2 : Number((3.1 + index * 0.45).toFixed(1));
    const users = Math.round(45231 * (traffic / 100));
    const conversions = Math.round(users * (rate / 100));
    return { ...variant, isControl, name, traffic, rate, users, conversions, color: REPORT_COLORS[index % REPORT_COLORS.length], key: `v${index}` };
  });
  const controlRate = normalizedVariants.find(v => v.isControl)?.rate || 3.2;
  const bestVariant = normalizedVariants.filter(v => !v.isControl).sort((a, b) => b.rate - a.rate)[0];
  const liftValue = bestVariant ? ((bestVariant.rate - controlRate) / controlRate) * 100 : 0;
  const totalUsers = normalizedVariants.reduce((sum, v) => sum + v.users, 0);
  const conversionGoal = config.conversionGoal;
  const exposureData = normalizedVariants.map(v => ({ name: v.name, value: v.traffic, color: v.color }));
  const trendData = Array.from({ length: 7 }, (_, idx) => {
    const row: Record<string, string | number> = { day: `Day ${idx + 1}` };
    normalizedVariants.forEach(v => {
      const drift = ((idx - 2) * 0.05) + (v.isControl ? 0 : 0.08);
      row[v.key] = Number((v.rate + drift).toFixed(1));
    });
    return row;
  });
  const maxRate = Math.max(...normalizedVariants.map(v => v.rate), 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl p-4" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Primary Metric: Conversion Rate</div>
        {conversionGoal?.eventName ? (
          <div style={{ fontSize: 12, color: '#6B7280' }}>
            Event: {conversionGoal.eventName}
            {conversionGoal.attribute ? ` | Attribute: ${conversionGoal.attribute}` : ''}
            {conversionGoal.attribute && conversionGoal.attributeValue ? ` | Value: ${conversionGoal.attributeValue}` : ''}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#9CA3AF' }}>No conversion goal selected.</div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard label="Users Exposed" value={totalUsers.toLocaleString('en-US')} sub="+12.3% this week" color="#2563EB" icon={Users} />
        <StatCard label="Control Conv. Rate" value={`${controlRate.toFixed(1)}%`} sub={normalizedVariants.find(v => v.isControl)?.name || 'Control'} color="#6B7280" icon={Target} />
        <StatCard label={bestVariant ? `${bestVariant.name} Conv. Rate` : 'Variant Conv. Rate'} value={bestVariant ? `${bestVariant.rate.toFixed(1)}%` : '—'} sub={bestVariant ? 'Best performer' : 'No test variant'} color="#22C55E" icon={TrendingUp} />
        <StatCard label="Lift" value={bestVariant ? `${liftValue >= 0 ? '+' : ''}${Math.round(liftValue)}%` : '—'} sub="vs control" color="#7C3AED" icon={Zap} />
        <StatCard label="Confidence" value="95%" sub="Statistically significant" color="#2563EB" icon={Award} />
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Variant comparison */}
        <div className="col-span-2 rounded-xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>Conversion Rate by Variant</h3>
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
              <Info size={11} color="#2563EB" />
              <span style={{ fontSize: 11, color: '#2563EB', fontWeight: 500 }}>95% confidence</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={normalizedVariants} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
                interval={0}
                tickFormatter={(value) => formatVariantAxisLabel(String(value ?? ''))}
              />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, Math.max(6, Math.ceil(maxRate + 2))]} />
              <RechartsTooltip formatter={(v: any) => [`${v}%`, 'Conv. Rate']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                {normalizedVariants.map((entry, index) => <Cell key={index} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Exposure pie */}
        <div className="rounded-xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Exposure Distribution</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={exposureData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                {exposureData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
              </Pie>
              <RechartsTooltip formatter={(v: any) => [`${v}%`]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-1.5 mt-2">
            {exposureData.map(e => (
              <div key={e.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-full" style={{ width: 8, height: 8, background: e.color }} />
                  <span style={{ fontSize: 12, color: '#6B7280' }}>{e.name}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{e.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trend chart */}
      <div className="rounded-xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Conversion Rate Trend</h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 6]} />
            <RechartsTooltip formatter={(v: any) => [`${v}%`]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
            <Legend formatter={v => <span style={{ fontSize: 12, color: '#6B7280' }}>{v}</span>} />
            {normalizedVariants.map(v => (
              <Line
                key={v.key}
                dataKey={v.key}
                name={v.name}
                stroke={v.color}
                strokeWidth={v.isControl ? 2 : 2.5}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Variant table */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>Variant Performance</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              {['VARIANT', 'USERS', 'CONVERSIONS', 'CONV. RATE', 'LIFT', 'CONFIDENCE'].map(col => (
                <th key={col} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {normalizedVariants.map((row, i) => (
              <tr key={row.name} style={{ borderBottom: i === 0 ? '1px solid #F3F4F6' : 'none' }}>
                <td style={{ padding: '14px 20px' }}>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{row.name}</span>
                    {bestVariant && row.id === bestVariant.id && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ fontSize: 10, color: '#15803D', background: '#DCFCE7', fontWeight: 700 }}>
                        <Award size={9} />LEADING
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '14px 20px', fontSize: 13, color: '#374151' }}>{row.users.toLocaleString('en-US')}</td>
                <td style={{ padding: '14px 20px', fontSize: 13, color: '#374151' }}>{row.conversions.toLocaleString('en-US')}</td>
                <td style={{ padding: '14px 20px' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: bestVariant && row.id === bestVariant.id ? '#15803D' : '#374151' }}>{row.rate.toFixed(1)}%</span>
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: row.isControl ? '#9CA3AF' : '#7C3AED' }}>
                    {row.isControl ? '—' : `${(((row.rate - controlRate) / controlRate) * 100) >= 0 ? '+' : ''}${Math.round(((row.rate - controlRate) / controlRate) * 100)}%`}
                  </span>
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: row.isControl ? '#9CA3AF' : '#2563EB' }}>{row.isControl ? '—' : '95%'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Action buttons */}
      {canDeclareWinner && (
        <div className="flex items-center gap-3 rounded-xl p-4" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Ready to Conclude?</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Declare a winner, roll out fully, or stop this experiment.</div>
          </div>
          <button onClick={onDeclareWinner} className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF', background: '#7C3AED', border: 'none', cursor: 'pointer' }}>
            <Award size={14} />
            Declare Winner
          </button>
          <button onClick={onFullRollout} className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ fontSize: 13, fontWeight: 600, color: '#15803D', background: '#DCFCE7', border: '1px solid #BBF7D0', cursor: 'pointer' }}>
            <Zap size={14} />
            Full Rollout
          </button>
          <button onClick={onStop} className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ fontSize: 13, fontWeight: 600, color: '#B45309', background: '#FEF3C7', border: '1px solid #FDE68A', cursor: 'pointer' }}>
            <Square size={14} />
            Stop
          </button>
        </div>
      )}
    </div>
  );
}