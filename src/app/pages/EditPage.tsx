import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowRight, ChevronDown, ChevronUp, Code2, Copy, Info, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useConfigs } from '../store/ConfigContext';
import StatusBadge from '../components/remote-config/StatusBadge';
import { ConfigType, ParameterType } from '../types';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

type Parameter = {
  id: string;
  name: string;
  dataType: ConfigType;
  description: string;
  value: string;
  collapsed: boolean;
};

type Variant = {
  id: string;
  name: string;
  role: 'control' | 'variant';
  traffic: number;
  overrides: Record<string, string>;
  expanded: boolean;
};

type AudienceRule = {
  id: string;
  category: string;
  field: string;
  operator: string;
  value: string;
};

type AudienceSubgroup = {
  id: string;
  name: string;
  logic: 'AND' | 'OR';
  rules: AudienceRule[];
};

type AudienceGroup = {
  id: string;
  name: string;
  logic: 'AND' | 'OR';
  rules: AudienceRule[];
  subgroups: AudienceSubgroup[];
};

const TYPE_OPTIONS: ConfigType[] = ['Boolean', 'String', 'Integer', 'JSON'];
const FILTER_FIELD_OPTIONS = ['Channel', 'Platform', 'Region'];
const FILTER_VALUE_OPTIONS: Record<string, string[]> = {
  Channel: ['Mobile', 'Web', 'Email'],
  Platform: ['iOS', 'Android', 'Web'],
  Region: ['EU', 'US', 'MENA', 'APAC'],
};
const FILTER_OPERATOR_OPTIONS = ['equals', 'contains'];
const MAX_VARIANTS = 8;
const CONVERSION_EVENTS = [
  'flight_booking_completed',
  'add_passenger_clicked',
  'checkout_started',
  'seat_selected',
];
const EVENT_ATTRIBUTES: Record<string, string[]> = {
  flight_booking_completed: ['ticket_class', 'route', 'device_type', 'passenger_count', 'payment_method'],
  add_passenger_clicked: ['ticket_class', 'route', 'device_type', 'passenger_count', 'payment_method'],
  checkout_started: ['ticket_class', 'route', 'device_type', 'passenger_count', 'payment_method'],
  seat_selected: ['ticket_class', 'route', 'device_type', 'passenger_count', 'payment_method'],
};
const SELECT_TRIGGER_CLASS = 'h-9 min-w-36 rounded-lg border px-3 text-[13px] font-medium text-[#111827] shadow-none';
const SELECT_TRIGGER_STYLE: React.CSSProperties = { borderColor: '#E5E7EB', background: '#FFFFFF' };

function createId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function createAudienceRule(): AudienceRule {
  return { id: createId('aud_rule'), category: 'Channel', field: 'Mobile', operator: 'equals', value: '' };
}

function createAudienceGroup(name: string): AudienceGroup {
  return { id: createId('aud_group'), name, logic: 'AND', rules: [createAudienceRule()], subgroups: [] };
}

function parseValue(type: ConfigType, value: string) {
  if (type === 'Boolean') return value === 'true';
  if (type === 'Integer') {
    const n = Number(value);
    return Number.isNaN(n) ? 0 : n;
  }
  if (type === 'JSON') {
    try {
      return JSON.parse(value || '{}');
    } catch {
      return {};
    }
  }
  return value;
}

function isValidJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

function isValidKey(value: string) {
  return /^[a-z0-9_]+$/.test(value);
}

function toParameterType(type: ConfigType): ParameterType {
  if (type === 'Boolean') return 'BOOLEAN';
  if (type === 'String') return 'STRING';
  if (type === 'Integer') return 'INTEGER';
  return 'JSON';
}

function normalizeParameterValue(type: ConfigType, rawValue: string) {
  if (type === 'Boolean') return rawValue === 'true';
  if (type === 'Integer') return Number(rawValue);
  if (type === 'JSON') return JSON.parse(rawValue || '{}');
  return rawValue;
}

function getTargetAudienceUsersFromFilters(ruleCount: number) {
  const seed = `rules-${ruleCount}`;
  let hash = 7;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const base = ((hash % 85000) + 1200);
  const divisor = Math.pow(2, Math.max(0, ruleCount - 1));
  return Math.max(1, Math.floor(base / divisor));
}

export default function EditPage() {
  const { config_id } = useParams();
  const navigate = useNavigate();
  const { getConfigById, updateConfig, stopAndCreateNewVersion } = useConfigs();
  const config = getConfigById(config_id || '');

  const [params, setParams] = useState<Parameter[]>([]);
  const [showDeveloperView, setShowDeveloperView] = useState(true);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [copyOk, setCopyOk] = useState(false);
  const [jsonFlash, setJsonFlash] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [configName, setConfigName] = useState('');
  const [configKey, setConfigKey] = useState('');
  const [configDescription, setConfigDescription] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [rolloutTraffic, setRolloutTraffic] = useState(100);
  const [showStep2Errors, setShowStep2Errors] = useState(false);
  const [trafficTouched, setTrafficTouched] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [audienceRules, setAudienceRules] = useState<AudienceRule[]>([]);
  const [audienceGroups, setAudienceGroups] = useState<AudienceGroup[]>([]);
  const [audienceLogic, setAudienceLogic] = useState<'AND' | 'OR'>('AND');
  const [openAudienceGroupMenuId, setOpenAudienceGroupMenuId] = useState<string | null>(null);
  const [renamingAudienceGroupId, setRenamingAudienceGroupId] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [audienceUsers, setAudienceUsers] = useState(46842);
  const [audienceUsersLoading, setAudienceUsersLoading] = useState(false);
  const [goalEventName, setGoalEventName] = useState('');
  const [goalAttribute, setGoalAttribute] = useState('');
  const [goalAttributeValue, setGoalAttributeValue] = useState('');

  useEffect(() => {
    if (!config) return;
    setSelectedVersion(config.version);
    setConfigName(config.name || '');
    setConfigKey((config.configKey || config.key || '').trim());
    setConfigDescription(config.description || '');
    setGoalEventName(config.conversionGoal?.eventName || '');
    setGoalAttribute(config.conversionGoal?.attribute || '');
    setGoalAttributeValue(config.conversionGoal?.attributeValue || '');
    setRolloutTraffic(config.rolloutPercentage ?? 100);
    if (config.parameters && config.parameters.length > 0) {
      setParams(config.parameters.map(p => ({
        id: p.id,
        name: p.key,
        dataType: p.type === 'BOOLEAN' ? 'Boolean' : p.type === 'STRING' ? 'String' : p.type === 'INTEGER' ? 'Integer' : 'JSON',
        description: p.description || '',
        value: typeof p.value === 'object' ? JSON.stringify(p.value) : `${p.value ?? ''}`,
        collapsed: false,
      })));
    } else {
      setParams((config.keys || []).map(k => ({
        id: k.id,
        name: k.name,
        dataType: k.dataType,
        description: '',
        value: k.defaultValue,
        collapsed: false,
      })));
    }

    const sourceVariants = (config.keys && config.keys[0]?.variants && config.keys[0].variants.length > 0)
      ? config.keys[0].variants
      : [
        { id: `variant_${Date.now()}_a`, name: 'Variant A', value: '', traffic: 50, isControl: true },
        { id: `variant_${Date.now()}_b`, name: 'Variant B', value: '', traffic: 50, isControl: false },
      ];
    setVariants(sourceVariants.map((v, index) => ({
      id: v.id,
      name: v.name || `Variant ${String.fromCharCode(65 + index)}`,
      role: v.role || ((v.isControl || index === 0) ? 'control' : 'variant'),
      traffic: Number.isNaN(Number(v.traffic)) ? 0 : Number(v.traffic),
      overrides: Object.fromEntries((config.keys || []).map(k => [k.id, k.variants[index]?.value ?? k.defaultValue])),
      expanded: false,
    })));
  }, [config?.id]);

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ fontFamily: 'Inter, sans-serif' }}>
        <div style={{ fontSize: 15, color: '#6B7280' }}>Configuration not found.</div>
      </div>
    );
  }

  const isHistorical = Boolean(selectedVersion && selectedVersion !== config.version);
  const isReadOnly = config.status === 'LIVE' || config.status === 'COMPLETED' || isHistorical;

  const errors = useMemo(() => {
    const next: Record<string, string> = {};
    if (!configName.trim()) next.configName = 'Configuration name is required';
    if (!configKey.trim()) next.configKey = 'Configuration key is required';
    else if (!isValidKey(configKey.trim())) next.configKey = 'Use lowercase letters, numbers, and underscore only';
    if (!configDescription.trim()) next.configDescription = 'Description is required';
    if (params.length === 0) next.params = 'At least one parameter is required';
    params.forEach(p => {
      if (!p.name.trim()) next[`name_${p.id}`] = 'Parameter key is required';
      if (!isValidKey(p.name.trim())) next[`name_${p.id}`] = 'Use lowercase letters, numbers, and underscore only';
      if (p.value.trim() === '') next[`value_${p.id}`] = 'Value is required';
      if (p.dataType === 'Boolean' && p.value !== 'true' && p.value !== 'false') next[`value_${p.id}`] = 'Invalid Boolean';
      if (p.dataType === 'Integer' && Number.isNaN(Number(p.value))) next[`value_${p.id}`] = 'Invalid Integer';
      if (p.dataType === 'JSON') {
        try {
          const parsed = JSON.parse(p.value || '{}');
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            next[`value_${p.id}`] = 'Invalid JSON';
          }
        } catch {
          next[`value_${p.id}`] = 'Invalid JSON';
        }
      }
    });
    return next;
  }, [configName, configKey, configDescription, params]);

  const isStep1Valid = params.length > 0 && Object.keys(errors).length === 0;
  const availableEventAttributes = EVENT_ATTRIBUTES[goalEventName] || [];
  const totalAudienceRuleCount = useMemo(() => (
    audienceRules.length
    + audienceGroups.reduce(
      (sum, g) => sum + g.rules.length + g.subgroups.reduce((subSum, sg) => subSum + sg.rules.length, 0),
      0,
    )
  ), [audienceRules, audienceGroups]);
  const trafficTotal = variants.reduce((sum, v) => sum + v.traffic, 0);
  const variantNameErrors = useMemo(() => {
    const counts: Record<string, number> = {};
    variants.forEach(v => {
      const key = v.name.trim().toLowerCase();
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
    });
    const next: Record<string, string> = {};
    variants.forEach(v => {
      const key = v.name.trim().toLowerCase();
      if (!key) return;
      if ((counts[key] || 0) > 1) next[v.id] = 'Variant name must be unique.';
    });
    return next;
  }, [variants]);
  const step2Errors = useMemo(() => {
    const next: Record<string, string> = {};
    if (totalAudienceRuleCount === 0) next.segments = 'Add at least one filter rule or group.';
    if (rolloutTraffic === 0) next.rollout = 'Rollout must be greater than 0%.';
    if (!goalEventName.trim()) next.conversionGoal = 'Please select a conversion event to measure experiment performance.';
    if (Object.keys(variantNameErrors).length > 0) next.variantNames = 'Variant names must be unique.';
    if (Math.abs(trafficTotal - 100) > 0.01) next.traffic = `Variant traffic must equal 100%. Current total: ${Math.round(trafficTotal)}%.`;
    return next;
  }, [totalAudienceRuleCount, rolloutTraffic, trafficTotal, variantNameErrors, goalEventName]);
  const isValid = isStep1Valid && Object.keys(step2Errors).length === 0 && !isReadOnly;
  const appliedSegmentFilterLabel = useMemo(() => {
    if (totalAudienceRuleCount === 0) return 'No filters';
    return `${totalAudienceRuleCount} rule${totalAudienceRuleCount > 1 ? 's' : ''}`;
  }, [totalAudienceRuleCount]);
  const approveUsersCount = useMemo(
    () => Math.max(0, Math.round(audienceUsers * (rolloutTraffic / 100))),
    [audienceUsers, rolloutTraffic],
  );
  const jsonPreview = useMemo(() => {
    const rootKey = configKey.trim();
    const paramEntries = params
      .filter(p => p.name.trim())
      .map(p => [p.name.trim(), parseValue(p.dataType, p.value)] as const);
    if (!rootKey) return JSON.stringify({}, null, 2);
    return JSON.stringify({ [rootKey]: Object.fromEntries(paramEntries) }, null, 2);
  }, [params, configKey]);

  const lines = jsonPreview.split('\n');

  useEffect(() => {
    setJsonFlash(true);
    const timer = window.setTimeout(() => setJsonFlash(false), 300);
    return () => window.clearTimeout(timer);
  }, [jsonPreview]);

  useEffect(() => {
    if (isReadOnly) return;
    const timer = window.setTimeout(() => setSavedAt(new Date()), 10000);
    return () => window.clearTimeout(timer);
  }, [configName, configKey, configDescription, params, rolloutTraffic, variants, goalEventName, goalAttribute, goalAttributeValue, audienceRules, audienceGroups, isDirty, isReadOnly]);

  useEffect(() => {
    setAudienceUsersLoading(true);
    const timer = window.setTimeout(() => {
      setAudienceUsers(getTargetAudienceUsersFromFilters(totalAudienceRuleCount));
      setAudienceUsersLoading(false);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [totalAudienceRuleCount]);

  useEffect(() => {
    if (!savedAt) return;
    const timer = window.setTimeout(() => setSavedAt(null), 2000);
    return () => window.clearTimeout(timer);
  }, [savedAt]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!isReadOnly) setSavedAt(new Date());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReadOnly]);

  const onAdd = () => {
    if (isReadOnly) return;
    setParams(prev => [...prev, { id: `param_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name: '', dataType: 'String', description: '', value: '', collapsed: false }]);
  };

  const onDelete = (id: string) => {
    if (isReadOnly) return;
    setParams(prev => prev.filter(p => p.id !== id));
  };

  const onUpdate = (id: string, patch: Partial<Parameter>) => {
    if (isReadOnly) return;
    setParams(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));
  };

  const onGoStep2 = () => {
    setShowErrors(true);
    if (!isStep1Valid) return;
    setStep(2);
  };

  const onAddVariant = () => {
    if (isReadOnly) return;
    if (variants.length >= MAX_VARIANTS) return;
    const label = `Variant ${String.fromCharCode(65 + variants.length)}`;
    setVariants(prev => [...prev, { id: `variant_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name: label, role: 'variant', traffic: 0, overrides: {}, expanded: false }]);
  };

  const onRemoveVariant = (variantId: string) => {
    if (isReadOnly) return;
    setVariants(prev => prev.filter(v => v.id !== variantId));
  };
  const persistChanges = (navigateToListing: boolean) => {
    setShowErrors(true);
    setShowStep2Errors(true);
    if (!isValid) return;
    const keysPayload = params.map((p, paramIndex) => ({
      id: p.id,
      name: p.name.trim(),
      dataType: p.dataType,
      defaultValue: p.value,
      variants: variants.map((v, variantIndex) => ({
        id: `${p.id}_v_${variantIndex}`,
        name: v.name,
        role: v.role,
        value: v.overrides[p.id] ?? p.value,
        traffic: v.traffic,
        isControl: v.role === 'control',
      })),
    }));
    updateConfig(config.id, {
      name: configName.trim(),
      configKey: configKey.trim(),
      key: configKey.trim(),
      description: configDescription.trim(),
      type: params[0]?.dataType || config.type,
      keys: keysPayload,
      parameters: params.map(p => ({
        id: p.id,
        key: p.name.trim(),
        type: toParameterType(p.dataType),
        description: p.description.trim() || undefined,
        value: normalizeParameterValue(p.dataType, p.value),
      })),
      variantsCount: Math.max(variants.length, 1),
      hasGradualRollout: rolloutTraffic < 100,
      rolloutPercentage: rolloutTraffic,
      targetSegment: appliedSegmentFilterLabel,
      conversionGoal: {
        eventName: goalEventName.trim(),
        attribute: goalAttribute.trim() || undefined,
        attributeValue: goalAttribute.trim() ? (goalAttributeValue.trim() || undefined) : undefined,
      },
    });
    setSavedAt(new Date());
    navigate(navigateToListing ? '/remote_configuration' : `/view_remote_configuration/${config.id}`);
  };
  const onSave = () => persistChanges(false);
  const onApproveSave = () => {
    setShowErrors(true);
    setShowStep2Errors(true);
    if (!isValid) return;
    setShowApproveModal(true);
  };

  const goStep2 = onGoStep2;
  const addVariant = onAddVariant;
  const removeVariant = onRemoveVariant;
  const onSaveDraft = onSave;

  const inputStyle = (invalid?: boolean): React.CSSProperties => ({
    width: '100%',
    height: 48,
    padding: '0 12px',
    fontSize: 13,
    color: '#111827',
    border: `1px solid ${invalid ? '#EF4444' : '#E5E7EB'}`,
    borderRadius: 8,
    outline: 'none',
    boxSizing: 'border-box',
    background: '#FFFFFF',
    fontFamily: 'Inter, sans-serif',
  });

  return (
    <div className="p-6" style={{ minHeight: '100%', background: '#F9FAFB', fontFamily: 'Inter, sans-serif', paddingBottom: 92 }}>
      <div className="mb-4">
        <h1 style={{ margin: 0, fontSize: 24, color: '#111827', fontWeight: 700 }}>Edit Remote Configuration</h1>
        <div className="flex items-center gap-2 mt-1">
          <select value={selectedVersion} onChange={e => setSelectedVersion(e.target.value)} style={{ height: 24, fontSize: 11, color: '#6B7280', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 6, padding: '0 8px' }}>
            {config.versionHistory.map(v => <option key={v.version} value={v.version}>{v.version}</option>)}
          </select>
          <StatusBadge status={config.status} />
          {savedAt && <span style={{ fontSize: 11, color: '#22C55E' }}>Saved just now</span>}
        </div>
      </div>

      {isHistorical && (
        <div className="rounded-lg p-3 mb-3" style={{ border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8', fontSize: 12 }}>
          Viewing {selectedVersion}. Historical versions are read-only.
        </div>
      )}

      {config.status === 'LIVE' && (
        <div className="rounded-lg p-3 mb-3" style={{ border: '1px solid #FDE68A', background: '#FFFBEB' }}>
          <div style={{ fontSize: 13, color: '#92400E', fontWeight: 600, marginBottom: 4 }}>This configuration is currently LIVE.</div>
          <div style={{ fontSize: 12, color: '#B45309', marginBottom: 8 }}>To make changes, stop the current version and create a new one.</div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(`/view_remote_configuration/${config.id}`)} style={{ padding: '6px 12px', fontSize: 12, color: '#374151', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => {
              const next = stopAndCreateNewVersion(config.id);
              navigate(`/edit_remote_configuration/${next.id}`);
            }} style={{ padding: '6px 12px', fontSize: 12, color: '#FFFFFF', background: '#2563EB', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              Stop & Create New Version
            </button>
          </div>
        </div>
      )}

      {config.status === 'COMPLETED' && (
        <div className="rounded-lg p-3 mb-3" style={{ border: '1px solid #E5E7EB', background: '#F3F4F6', color: '#374151', fontSize: 12 }}>
          This configuration has been completed and cannot be modified.
        </div>
      )}

      <div className="mb-4 rounded-lg grid grid-cols-[1fr_auto_1fr] overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
        <button
          onClick={() => setStep(1)}
          className="text-left px-4 py-2"
          style={{ border: 'none', background: '#FFFFFF', cursor: 'pointer' }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: step === 1 ? '#2563EB' : '#6B7280', lineHeight: 1.1 }}>Parameters & Keys</div>
          <div style={{ marginTop: 2, fontSize: 11, color: '#6B7280' }}>Define the configuration your app will receive.</div>
        </button>
        <div className="flex items-center justify-center px-2" style={{ background: '#FFFFFF' }}>
          <div className="flex items-center justify-center" style={{ width: 28, height: 28, borderRadius: 9999, border: '1px solid #E5E7EB', color: '#6B7280', fontWeight: 700, fontSize: 14 }}>
            →
          </div>
        </div>
        <button
          onClick={() => { if (isStep1Valid) setStep(2); }}
          className="text-left px-4 py-2"
          disabled={!isStep1Valid}
          style={{ border: 'none', background: '#FFFFFF', cursor: isStep1Valid ? 'pointer' : 'not-allowed', opacity: isStep1Valid ? 1 : 0.6 }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: step === 2 ? '#2563EB' : '#6B7280', lineHeight: 1.1 }}>Targeting & Rollout</div>
          <div style={{ marginTop: 2, fontSize: 11, color: '#6B7280' }}>Choose who receives the configuration and how it rolls out.</div>
        </button>
      </div>

      {step === 1 && (
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 rounded-xl p-4" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Basic Information</h2>
          <p style={{ margin: '4px 0 12px', fontSize: 12, color: '#6B7280' }}>Update root key and metadata before editing parameters.</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                CONFIGURATION NAME *
                <Tooltip delayDuration={150}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="A human-readable name used to identify this configuration in the list"
                      className="inline-flex items-center justify-center text-[#6B7280] hover:text-[#374151] focus:text-[#374151]"
                      style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'help' }}
                    >
                      <Info size={14} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={8}
                    style={{ background: '#111827', color: '#FFFFFF', fontSize: 12, padding: '8px 10px', borderRadius: 6, boxShadow: '0px 6px 16px rgba(0,0,0,0.12)', maxWidth: 240 }}
                  >
                    A human-readable name used to identify this configuration in the list.
                  </TooltipContent>
                </Tooltip>
              </label>
              <input value={configName} disabled={isReadOnly} onChange={e => setConfigName(e.target.value)} style={inputStyle(showErrors && Boolean(errors.configName))} />
              {showErrors && errors.configName && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#EF4444' }}>{errors.configName}</p>}
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                CONFIGURATION KEY *
                <Tooltip delayDuration={150}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="The unique key your app uses to fetch this configuration from the SDK"
                      className="inline-flex items-center justify-center text-[#6B7280] hover:text-[#374151] focus:text-[#374151]"
                      style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'help' }}
                    >
                      <Info size={14} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={8}
                    style={{ background: '#111827', color: '#FFFFFF', fontSize: 12, padding: '8px 10px', borderRadius: 6, boxShadow: '0px 6px 16px rgba(0,0,0,0.12)', maxWidth: 240 }}
                  >
                    The unique key your app uses to fetch this configuration from the SDK.
                    <br />
                    Example: <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>flight_details_ui</span>
                  </TooltipContent>
                </Tooltip>
              </label>
              <input value={configKey} disabled={isReadOnly} onChange={e => setConfigKey(e.target.value)} placeholder="e.g. flight_details_ui" style={inputStyle(showErrors && Boolean(errors.configKey))} />
              {showErrors && errors.configKey && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#EF4444' }}>{errors.configKey}</p>}
            </div>
            <div className="col-span-2">
              <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>DESCRIPTION *</label>
              <input value={configDescription} disabled={isReadOnly} onChange={e => setConfigDescription(e.target.value)} style={inputStyle(showErrors && Boolean(errors.configDescription))} />
              {showErrors && errors.configDescription && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#EF4444' }}>{errors.configDescription}</p>}
            </div>
          </div>
          <div style={{ height: 12 }} />
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Configuration Parameters</h2>
          <p style={{ margin: '4px 0 12px', fontSize: 12, color: '#6B7280' }}>Define the parameters your application will receive.</p>

          {params.length === 0 && (
            <div className="rounded-xl p-6 text-center" style={{ border: '1px dashed #D1D5DB', background: '#F9FAFB' }}>
              <Code2 size={22} color="#9CA3AF" />
              <p style={{ margin: '8px 0 4px', fontSize: 14, fontWeight: 600, color: '#111827' }}>No parameters added yet</p>
              <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>Add your first parameter to define your configuration structure.</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {params.map((p, i) => {
              const nameErr = errors[`name_${p.id}`];
              const valueErr = errors[`value_${p.id}`];
              return (
                <div key={p.id} className="rounded-xl" style={{ border: `1px solid ${(showErrors && (nameErr || valueErr)) ? '#FCA5A5' : '#E5E7EB'}`, background: '#FFFFFF' }}>
                  <div className="flex items-center gap-2 px-3" style={{ height: 48, borderBottom: p.collapsed ? 'none' : '1px solid #F3F4F6' }}>
                    <strong style={{ flex: 1, fontSize: 13, color: '#111827' }}>{p.name || `Parameter ${i + 1}`}</strong>
                    <span className="px-2 py-0.5 rounded" style={{ fontSize: 11, color: '#374151', background: '#F3F4F6', fontWeight: 600 }}>{p.dataType}</span>
                    <button onClick={() => onUpdate(p.id, { collapsed: !p.collapsed })} className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, border: 'none', background: '#F3F4F6', cursor: 'pointer' }}>
                      {p.collapsed ? <ChevronDown size={13} color="#6B7280" /> : <ChevronUp size={13} color="#6B7280" />}
                    </button>
                    {!isReadOnly && (
                      <button onClick={() => onDelete(p.id)} className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, border: 'none', background: '#FEE2E2', cursor: 'pointer' }}>
                        <Trash2 size={13} color="#EF4444" />
                      </button>
                    )}
                  </div>

                  {!p.collapsed && (
                    <div className="p-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>PARAMETER KEY *</label>
                          <input value={p.name} disabled={isReadOnly} onChange={e => onUpdate(p.id, { name: e.target.value })} placeholder="e.g. promo_banner_enabled" style={inputStyle(showErrors && Boolean(nameErr))} />
                          {showErrors && nameErr && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#EF4444' }}>{nameErr}</p>}
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>DATA TYPE *</label>
                          <div className="relative">
                            <select value={p.dataType} disabled={isReadOnly} onChange={e => onUpdate(p.id, { dataType: e.target.value as ConfigType, value: e.target.value === 'Boolean' ? 'false' : '' })} style={{ ...inputStyle(), appearance: 'none', paddingRight: 28 }}>
                              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <ChevronDown size={13} color="#9CA3AF" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>
                        <div className="col-span-2">
                          <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>DESCRIPTION (OPTIONAL)</label>
                          <input value={p.description} disabled={isReadOnly} onChange={e => onUpdate(p.id, { description: e.target.value })} style={inputStyle()} />
                        </div>
                        <div className="col-span-2">
                          <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>VALUE *</label>
                          <ValueEditor param={p} disabled={isReadOnly} invalid={showErrors && Boolean(valueErr)} onChange={v => onUpdate(p.id, { value: v })} />
                          {p.dataType === 'JSON' && p.value.trim() && isValidJsonObject(p.value) && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#22C55E' }}>Valid JSON</p>}
                          {showErrors && valueErr && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#EF4444' }}>{valueErr}</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!isReadOnly && (
            <button onClick={onAdd} className="mt-3 inline-flex items-center gap-1.5 px-4 rounded-lg" style={{ height: 40, fontSize: 13, fontWeight: 600, color: '#2563EB', background: '#EFF6FF', border: '1px solid #BFDBFE', cursor: 'pointer' }}>
              <Plus size={14} />
              Add New Parameter
            </button>
          )}

        </div>

        <div className="sticky self-start" style={{ top: 16 }}>
          <button onClick={() => setShowDeveloperView(v => !v)} className="mb-2 px-3 rounded-lg" style={{ height: 36, fontSize: 12, fontWeight: 600, color: '#374151', background: '#FFFFFF', border: '1px solid #E5E7EB', cursor: 'pointer' }}>
            {showDeveloperView ? 'Hide Developer View' : 'Show Developer View'}
          </button>
          {showDeveloperView && (
            <div className="rounded-xl p-3" style={{ background: '#0F172A', border: '1px solid #1F2937', maxHeight: 'calc(100vh - 120px)', overflow: 'auto' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#F9FAFB' }}>JSON Output</h3>
                  <span className="px-2 py-0.5 rounded" style={{ fontSize: 10, color: '#CBD5E1', background: '#1E293B', fontWeight: 600 }}>READ-ONLY</span>
                </div>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(jsonPreview);
                    setCopyOk(true);
                    window.setTimeout(() => setCopyOk(false), 1200);
                  }}
                  className="inline-flex items-center gap-1 px-2 rounded"
                  style={{ height: 28, fontSize: 11, color: '#E2E8F0', background: '#1E293B', border: '1px solid #334155', cursor: 'pointer' }}
                >
                  <Copy size={11} />
                  {copyOk ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p style={{ margin: '0 0 8px', fontSize: 11, color: '#94A3B8' }}>This is the payload your SDK will receive.</p>
              <div className="rounded-lg" style={{ border: '1px solid #334155', background: jsonFlash ? '#0B1226' : '#020617', padding: 12, transition: 'background 0.25s ease' }}>
                {lines.map((line, idx) => (
                  <div key={`${idx}_${line}`} className="flex gap-3" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 12, lineHeight: 1.5 }}>
                    <span style={{ color: '#64748B', minWidth: 16, textAlign: 'right' }}>{idx + 1}</span>
                    <span style={{ color: '#E2E8F0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{line}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 rounded-xl p-4" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
            <h2 style={{ margin: 0, fontSize: 14, color: '#111827', fontWeight: 700 }}>Target Audience</h2>
            <p style={{ margin: '4px 0 10px', fontSize: 12, color: '#6B7280' }}>Only users in these segments are eligible for this configuration.</p>
            <div className="rounded-lg p-3" style={{ border: '1px solid #E5E7EB', background: '#FFFFFF', marginBottom: 10 }}>
              {audienceRules.length === 0 && audienceGroups.length === 0 ? (
                <div className="rounded-lg border" style={{ borderStyle: 'dashed', borderColor: '#D1D5DB', padding: '20px 16px', textAlign: 'center', color: '#4B5563', fontSize: 13, fontWeight: 600 }}>
                  Add a Filter Rule or Filter Group to start segmenting your users.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {audienceRules.map((row, topRuleIndex) => (
                    <React.Fragment key={row.id}>
                    <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-2 py-2 overflow-hidden">
                      <Select value={row.category} onValueChange={(category) => {
                        if (isReadOnly) return;
                        setIsDirty(true);
                        setAudienceRules(prev => prev.map(r => r.id === row.id ? { ...r, category, field: FILTER_VALUE_OPTIONS[category]?.[0] || '' } : r));
                      }} disabled={isReadOnly}>
                        <SelectTrigger className={`${SELECT_TRIGGER_CLASS} min-w-0`} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger>
                        <SelectContent>{FILTER_FIELD_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={row.field} onValueChange={(field) => {
                        if (isReadOnly) return;
                        setIsDirty(true);
                        setAudienceRules(prev => prev.map(r => r.id === row.id ? { ...r, field } : r));
                      }} disabled={isReadOnly}>
                        <SelectTrigger className={`${SELECT_TRIGGER_CLASS} min-w-0`} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger>
                        <SelectContent>{(FILTER_VALUE_OPTIONS[row.category] || []).map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={row.operator} onValueChange={(operator) => {
                        if (isReadOnly) return;
                        setIsDirty(true);
                        setAudienceRules(prev => prev.map(r => r.id === row.id ? { ...r, operator } : r));
                      }} disabled={isReadOnly}>
                        <SelectTrigger className={`${SELECT_TRIGGER_CLASS} min-w-0`} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger>
                        <SelectContent>{FILTER_OPERATOR_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                      </Select>
                      <input value={row.value} disabled={isReadOnly} onChange={(e) => {
                        if (isReadOnly) return;
                        setIsDirty(true);
                        const value = e.target.value;
                        setAudienceRules(prev => prev.map(r => r.id === row.id ? { ...r, value } : r));
                      }} placeholder="Enter value..." style={{ height: 36, borderRadius: 8, border: '1px solid #E5E7EB', padding: '0 10px', fontSize: 12, color: '#212121', outline: 'none', width: '100%', background: isReadOnly ? '#F9FAFB' : '#FFFFFF' }} />
                      <button onClick={() => {
                        if (isReadOnly) return;
                        setIsDirty(true);
                        setAudienceRules(prev => prev.filter(r => r.id !== row.id));
                      }} className="rounded-lg flex items-center justify-center" style={{ width: 30, height: 30, border: '1px solid #FECACA', background: '#FFF5F5', cursor: isReadOnly ? 'not-allowed' : 'pointer', opacity: isReadOnly ? 0.5 : 1 }} aria-label="Delete filter rule" disabled={isReadOnly}>
                        <Trash2 size={11} color="#DC2626" />
                      </button>
                    </div>
                    {topRuleIndex < (audienceRules.length + audienceGroups.length - 1) && (
                      <div style={{ paddingLeft: 8, width: 96 }}>
                        <Select value={audienceLogic} onValueChange={(logic) => setAudienceLogic(logic as 'AND' | 'OR')} disabled={isReadOnly || topRuleIndex !== 0}>
                          <SelectTrigger className={SELECT_TRIGGER_CLASS} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="AND">AND</SelectItem><SelectItem value="OR">OR</SelectItem></SelectContent>
                        </Select>
                      </div>
                    )}
                    </React.Fragment>
                  ))}

                  {audienceGroups.map((group, groupIndex) => (
                    <React.Fragment key={group.id}>
                    <div className="rounded-lg border p-3" style={{ borderColor: '#C7D2FE', background: 'rgb(251, 252, 255)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="inline-flex items-center gap-2 min-w-0">
                          {renamingAudienceGroupId === group.id ? (
                            <input
                              autoFocus
                              value={group.name}
                              disabled={isReadOnly}
                              onBlur={() => setRenamingAudienceGroupId(null)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') setRenamingAudienceGroupId(null);
                                if (e.key === 'Escape') setRenamingAudienceGroupId(null);
                              }}
                              onChange={(e) => {
                                if (isReadOnly) return;
                                setIsDirty(true);
                                const name = e.target.value;
                                setAudienceGroups(prev => prev.map(g => g.id === group.id ? { ...g, name } : g));
                              }}
                              style={{ height: 30, width: 120, borderRadius: 8, border: '1px solid #5566E8', background: '#5566E8', color: '#FFFFFF', fontSize: 12, fontWeight: 700, padding: '0 10px', outline: 'none', opacity: isReadOnly ? 0.7 : 1 }}
                            />
                          ) : (
                            <span style={{ height: 30, width: 120, borderRadius: 8, border: '1px solid #5566E8', background: '#5566E8', color: '#FFFFFF', fontSize: 12, fontWeight: 700, padding: '0 10px', display: 'inline-flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: isReadOnly ? 0.7 : 1 }}>
                              {group.name}
                            </span>
                          )}
                          <Select value={audienceLogic} onValueChange={() => {}} disabled>
                            <SelectTrigger className={SELECT_TRIGGER_CLASS} style={{ ...SELECT_TRIGGER_STYLE, width: 90 }}><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="AND">AND</SelectItem><SelectItem value="OR">OR</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => {
                            if (isReadOnly) return;
                            setIsDirty(true);
                            setAudienceGroups(prev => prev.map(g => g.id === group.id ? { ...g, rules: [...g.rules, createAudienceRule()] } : g));
                          }} style={{ border: 'none', background: 'transparent', color: isReadOnly ? '#9CA3AF' : '#3B82F6', fontSize: 12, fontWeight: 600, cursor: isReadOnly ? 'not-allowed' : 'pointer' }}>Add Rule</button>
                          <button onClick={() => {
                            if (isReadOnly || group.subgroups.length >= 2) return;
                            setIsDirty(true);
                            const subgroup: AudienceSubgroup = { id: createId('aud_subgroup'), name: `Subgroup ${group.subgroups.length + 1}`, logic: 'AND', rules: [createAudienceRule()] };
                            setAudienceGroups(prev => prev.map(g => g.id === group.id ? { ...g, subgroups: [...g.subgroups, subgroup] } : g));
                          }} style={{ border: 'none', background: 'transparent', color: (isReadOnly || group.subgroups.length >= 2) ? '#9CA3AF' : '#3B82F6', fontSize: 12, fontWeight: 600, cursor: (isReadOnly || group.subgroups.length >= 2) ? 'not-allowed' : 'pointer' }}>Add Subgroup</button>
                          <div className="relative">
                            <button
                              onClick={() => { if (!isReadOnly) setOpenAudienceGroupMenuId(prev => prev === group.id ? null : group.id); }}
                              className="rounded-md flex items-center justify-center"
                              style={{ width: 28, height: 28, border: 'none', background: '#F3F4F6', cursor: isReadOnly ? 'not-allowed' : 'pointer', opacity: isReadOnly ? 0.5 : 1 }}
                              aria-label="Group actions"
                              disabled={isReadOnly}
                            >
                              <MoreHorizontal size={14} color="#6B7280" />
                            </button>
                            {openAudienceGroupMenuId === group.id && !isReadOnly && (
                              <div className="absolute right-0 mt-1 rounded-lg py-1" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 8px 20px rgba(17,24,39,0.12)', minWidth: 140, zIndex: 20 }}>
                                <button
                                  onClick={() => { setRenamingAudienceGroupId(group.id); setOpenAudienceGroupMenuId(null); }}
                                  className="w-full text-left px-3 py-1.5"
                                  style={{ border: 'none', background: 'transparent', fontSize: 12, color: '#374151', cursor: 'pointer' }}
                                >
                                  Rename
                                </button>
                                <button
                                  onClick={() => {
                                    setIsDirty(true);
                                    const copy: AudienceGroup = { ...group, id: createId('aud_group'), name: `${group.name} Copy`, rules: group.rules.map(r => ({ ...r, id: createId('aud_rule') })), subgroups: group.subgroups.map(sg => ({ ...sg, id: createId('aud_subgroup'), rules: sg.rules.map(r => ({ ...r, id: createId('aud_rule') })) })) };
                                    setAudienceGroups(prev => [...prev, copy]);
                                    setOpenAudienceGroupMenuId(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5"
                                  style={{ border: 'none', background: 'transparent', fontSize: 12, color: '#374151', cursor: 'pointer' }}
                                >
                                  Duplicate
                                </button>
                                <button
                                  onClick={() => {
                                    setIsDirty(true);
                                    setAudienceGroups(prev => prev.filter(g => g.id !== group.id));
                                    setOpenAudienceGroupMenuId(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5"
                                  style={{ border: 'none', background: 'transparent', fontSize: 12, color: '#EF4444', cursor: 'pointer' }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {group.rules.map((row, groupRuleIndex) => (
                          <React.Fragment key={row.id}>
                          <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-2 py-2 overflow-hidden">
                            <Select value={row.category} onValueChange={(category) => {
                              if (isReadOnly) return;
                              setIsDirty(true);
                              setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : { ...g, rules: g.rules.map(r => r.id === row.id ? { ...r, category, field: FILTER_VALUE_OPTIONS[category]?.[0] || '' } : r) }));
                            }} disabled={isReadOnly}><SelectTrigger className={`${SELECT_TRIGGER_CLASS} min-w-0`} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger><SelectContent>{FILTER_FIELD_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>
                            <Select value={row.field} onValueChange={(field) => {
                              if (isReadOnly) return;
                              setIsDirty(true);
                              setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : { ...g, rules: g.rules.map(r => r.id === row.id ? { ...r, field } : r) }));
                            }} disabled={isReadOnly}><SelectTrigger className={`${SELECT_TRIGGER_CLASS} min-w-0`} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger><SelectContent>{(FILTER_VALUE_OPTIONS[row.category] || []).map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>
                            <Select value={row.operator} onValueChange={(operator) => {
                              if (isReadOnly) return;
                              setIsDirty(true);
                              setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : { ...g, rules: g.rules.map(r => r.id === row.id ? { ...r, operator } : r) }));
                            }} disabled={isReadOnly}><SelectTrigger className={`${SELECT_TRIGGER_CLASS} min-w-0`} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger><SelectContent>{FILTER_OPERATOR_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>
                            <input value={row.value} disabled={isReadOnly} onChange={(e) => {
                              if (isReadOnly) return;
                              setIsDirty(true);
                              const value = e.target.value;
                              setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : { ...g, rules: g.rules.map(r => r.id === row.id ? { ...r, value } : r) }));
                            }} placeholder="Enter value..." style={{ height: 36, borderRadius: 8, border: '1px solid #E5E7EB', padding: '0 10px', fontSize: 12, color: '#212121', outline: 'none', width: '100%', background: isReadOnly ? '#F9FAFB' : '#FFFFFF' }} />
                            <button onClick={() => {
                              if (isReadOnly) return;
                              setIsDirty(true);
                              setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : { ...g, rules: g.rules.filter(r => r.id !== row.id) }));
                            }} className="rounded-lg flex items-center justify-center" style={{ width: 30, height: 30, border: '1px solid #FECACA', background: '#FFF5F5', cursor: isReadOnly ? 'not-allowed' : 'pointer', opacity: isReadOnly ? 0.5 : 1 }} disabled={isReadOnly}>
                              <Trash2 size={11} color="#DC2626" />
                            </button>
                          </div>
                          {groupRuleIndex < group.rules.length - 1 && (
                            <div style={{ paddingLeft: 8, width: 96 }}>
                              <Select value={audienceLogic} onValueChange={() => {}} disabled>
                                <SelectTrigger className={SELECT_TRIGGER_CLASS} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="AND">AND</SelectItem><SelectItem value="OR">OR</SelectItem></SelectContent>
                              </Select>
                            </div>
                          )}
                          </React.Fragment>
                        ))}

                        {group.subgroups.map((sg) => (
                          <div key={sg.id} className="rounded-lg border p-2" style={{ borderColor: '#D1D5DB', background: '#FFFFFF' }}>
                            <div className="flex items-center justify-between mb-2">
                              <strong style={{ fontSize: 12, color: '#374151' }}>{sg.name}</strong>
                              <button onClick={() => {
                                if (isReadOnly) return;
                                setIsDirty(true);
                                setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : { ...g, subgroups: g.subgroups.filter(s => s.id !== sg.id) }));
                              }} className="rounded-md flex items-center justify-center" style={{ width: 24, height: 24, border: 'none', background: '#F3F4F6', cursor: isReadOnly ? 'not-allowed' : 'pointer', opacity: isReadOnly ? 0.5 : 1 }} disabled={isReadOnly}>
                                <Trash2 size={10} color="#9CA3AF" />
                              </button>
                            </div>
                            {sg.rules.map((r, subgroupRuleIndex) => (
                              <React.Fragment key={r.id}>
                              <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-2 py-2 overflow-hidden" style={{ marginBottom: 6 }}>
                                <Select value={r.category} onValueChange={(category) => {
                                  if (isReadOnly) return;
                                  setIsDirty(true);
                                  setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : { ...g, subgroups: g.subgroups.map(s => s.id !== sg.id ? s : { ...s, rules: s.rules.map(rr => rr.id === r.id ? { ...rr, category, field: FILTER_VALUE_OPTIONS[category]?.[0] || '' } : rr) }) }));
                                }} disabled={isReadOnly}><SelectTrigger className={`${SELECT_TRIGGER_CLASS} min-w-0`} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger><SelectContent>{FILTER_FIELD_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>
                                <Select value={r.field} onValueChange={(field) => {
                                  if (isReadOnly) return;
                                  setIsDirty(true);
                                  setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : { ...g, subgroups: g.subgroups.map(s => s.id !== sg.id ? s : { ...s, rules: s.rules.map(rr => rr.id === r.id ? { ...rr, field } : rr) }) }));
                                }} disabled={isReadOnly}><SelectTrigger className={`${SELECT_TRIGGER_CLASS} min-w-0`} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger><SelectContent>{(FILTER_VALUE_OPTIONS[r.category] || []).map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>
                                <Select value={r.operator} onValueChange={(operator) => {
                                  if (isReadOnly) return;
                                  setIsDirty(true);
                                  setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : { ...g, subgroups: g.subgroups.map(s => s.id !== sg.id ? s : { ...s, rules: s.rules.map(rr => rr.id === r.id ? { ...rr, operator } : rr) }) }));
                                }} disabled={isReadOnly}><SelectTrigger className={`${SELECT_TRIGGER_CLASS} min-w-0`} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger><SelectContent>{FILTER_OPERATOR_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>
                                <input value={r.value} disabled={isReadOnly} onChange={(e) => {
                                  if (isReadOnly) return;
                                  setIsDirty(true);
                                  const value = e.target.value;
                                  setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : { ...g, subgroups: g.subgroups.map(s => s.id !== sg.id ? s : { ...s, rules: s.rules.map(rr => rr.id === r.id ? { ...rr, value } : rr) }) }));
                                }} placeholder="Enter value..." style={{ height: 36, borderRadius: 8, border: '1px solid #E5E7EB', padding: '0 10px', fontSize: 12, color: '#212121', outline: 'none', width: '100%', background: isReadOnly ? '#F9FAFB' : '#FFFFFF' }} />
                                <button onClick={() => {
                                  if (isReadOnly) return;
                                  setIsDirty(true);
                                  setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : { ...g, subgroups: g.subgroups.map(s => s.id !== sg.id ? s : { ...s, rules: s.rules.filter(rr => rr.id !== r.id) }) }));
                                }} className="rounded-lg flex items-center justify-center" style={{ width: 30, height: 30, border: '1px solid #FECACA', background: '#FFF5F5', cursor: isReadOnly ? 'not-allowed' : 'pointer', opacity: isReadOnly ? 0.5 : 1 }} disabled={isReadOnly}>
                                  <Trash2 size={11} color="#DC2626" />
                                </button>
                              </div>
                              {subgroupRuleIndex < sg.rules.length - 1 && (
                                <div style={{ paddingLeft: 8, width: 96, marginBottom: 6 }}>
                                  <Select value={audienceLogic} onValueChange={() => {}} disabled>
                                    <SelectTrigger className={SELECT_TRIGGER_CLASS} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="AND">AND</SelectItem><SelectItem value="OR">OR</SelectItem></SelectContent>
                                  </Select>
                                </div>
                              )}
                              </React.Fragment>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                    {audienceRules.length + groupIndex < (audienceRules.length + audienceGroups.length - 1) && (
                      <div style={{ paddingLeft: 8, width: 96 }}>
                        <Select value={audienceLogic} onValueChange={(logic) => setAudienceLogic(logic as 'AND' | 'OR')} disabled={isReadOnly || (audienceRules.length + groupIndex !== 0)}>
                          <SelectTrigger className={SELECT_TRIGGER_CLASS} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="AND">AND</SelectItem><SelectItem value="OR">OR</SelectItem></SelectContent>
                        </Select>
                      </div>
                    )}
                    </React.Fragment>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3" style={{ marginTop: 10 }}>
                <button onClick={() => {
                  if (isReadOnly) return;
                  setIsDirty(true);
                  setAudienceRules(prev => [...prev, createAudienceRule()]);
                }} className="h-8 rounded-md border bg-white px-3 transition-colors" style={{ borderColor: '#E5E7EB', color: isReadOnly ? '#9CA3AF' : '#374151', fontSize: 12, fontWeight: 500, cursor: isReadOnly ? 'not-allowed' : 'pointer' }} disabled={isReadOnly}>
                  Add Filter Rule
                </button>
                <button onClick={() => {
                  if (isReadOnly) return;
                  setIsDirty(true);
                  setAudienceGroups(prev => [...prev, createAudienceGroup(`Group ${String.fromCharCode(65 + prev.length)}`)]);
                }} className="h-8 rounded-md border bg-white px-3 transition-colors" style={{ borderColor: '#E5E7EB', color: isReadOnly ? '#9CA3AF' : '#374151', fontSize: 12, fontWeight: 500, cursor: isReadOnly ? 'not-allowed' : 'pointer' }} disabled={isReadOnly}>
                  Add Filter Group
                </button>
              </div>
            </div>
            {showStep2Errors && step2Errors.segments && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#EF4444' }}>{step2Errors.segments}</p>}

            <div className="flex items-center gap-1" style={{ marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 14, color: '#111827', fontWeight: 700 }}>Rollout Percentage</h2>
              <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="Rollout percentage must be between 0 and 100" style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'help', color: '#6B7280', display: 'inline-flex' }}>
                    <Info size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6} style={{ background: '#111827', color: '#FFFFFF', fontSize: 12, padding: '8px 10px', borderRadius: 6, boxShadow: '0px 6px 16px rgba(0,0,0,0.12)', maxWidth: 240 }}>
                  Enter a percentage between 0 and 100 to control rollout size.
                </TooltipContent>
              </Tooltip>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6B7280' }}>Controls what percentage of eligible users will receive this configuration.</p>
            <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 13, color: '#111827', fontWeight: 700 }}>Rollout:</div>
              <input
                type="number"
                min={0}
                max={100}
                value={rolloutTraffic}
                disabled={isReadOnly}
                onChange={e => {
                  if (isReadOnly) return;
                  setIsDirty(true);
                  const next = Number(e.target.value);
                  const clamped = Math.max(0, Math.min(100, Number.isNaN(next) ? 0 : next));
                  setRolloutTraffic(clamped);
                }}
                style={{ width: 72, height: 32, borderRadius: 8, border: `1px solid ${(showStep2Errors && step2Errors.rollout) ? '#EF4444' : '#E5E7EB'}`, padding: '0 8px', fontSize: 12 }}
              />
              <span style={{ fontSize: 12, color: '#6B7280' }}>%</span>
            </div>
            {rolloutTraffic === 0 && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#F59E0B' }}>Rollout is 0%. Start Configuration is disabled.</p>}
            {showStep2Errors && step2Errors.rollout && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#EF4444' }}>{step2Errors.rollout}</p>}

            <h2 style={{ margin: '16px 0 4px', fontSize: 14, color: '#111827', fontWeight: 700 }}>A/B Testing Variants</h2>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>Override parameter values per variant.</p>
              <div style={{ fontSize: 12, color: (showStep2Errors || trafficTouched) && step2Errors.traffic ? '#EF4444' : '#111827', fontWeight: 700 }}>
                Total: {Math.round(trafficTotal)}%
              </div>
            </div>
            {variants.map((variant, idx) => (
              <div key={variant.id} className="rounded-lg p-3 mb-2" style={{ border: '1px solid #E5E7EB', background: '#FFFFFF' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={variant.name}
                      disabled={isReadOnly}
                      onChange={e => {
                        if (isReadOnly) return;
                        setIsDirty(true);
                        setVariants(prev => prev.map(v => v.id === variant.id ? { ...v, name: e.target.value } : v));
                      }}
                      placeholder={variant.role === 'control' ? 'Control' : `Variant ${String.fromCharCode(65 + idx)}`}
                      style={{
                        height: 32,
                        minWidth: 180,
                        padding: '0 10px',
                        borderRadius: 8,
                        border: `1px solid ${((showStep2Errors && step2Errors.variantNames) || variantNameErrors[variant.id]) ? '#EF4444' : '#E5E7EB'}`,
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#111827',
                        background: isReadOnly ? '#F9FAFB' : '#FFFFFF',
                      }}
                    />
                    <span
                      className="px-2 py-0.5 rounded"
                      style={{
                        fontSize: 10,
                        color: variant.role === 'control' ? '#1D4ED8' : '#4338CA',
                        background: variant.role === 'control' ? '#DBEAFE' : '#EEF2FF',
                        fontWeight: 700,
                      }}
                    >
                      {variant.role === 'control' ? 'CONTROL' : 'VARIANT'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>Traffic %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={variant.traffic}
                      disabled={isReadOnly}
                      onBlur={() => setTrafficTouched(true)}
                      onChange={e => {
                        if (isReadOnly) return;
                        setIsDirty(true);
                        const next = Number(e.target.value);
                        setVariants(prev => prev.map(v => v.id === variant.id ? { ...v, traffic: Number.isNaN(next) ? 0 : next } : v));
                      }}
                      style={{
                        width: 72,
                        height: 32,
                        borderRadius: 8,
                        border: `1px solid ${((showStep2Errors || trafficTouched) && step2Errors.traffic) ? '#EF4444' : '#E5E7EB'}`,
                        padding: '0 8px',
                        fontSize: 12,
                        background: '#FFFFFF',
                      }}
                    />
                    {idx > 0 && (
                      <button
                        onClick={() => {
                          if (isReadOnly) return;
                          setIsDirty(true);
                          removeVariant(variant.id);
                        }}
                        disabled={isReadOnly}
                        className="rounded-lg flex items-center justify-center"
                        style={{ width: 28, height: 28, border: 'none', background: '#FEE2E2', cursor: isReadOnly ? 'not-allowed' : 'pointer', opacity: isReadOnly ? 0.5 : 1 }}
                        aria-label={`Delete ${variant.name}`}
                      >
                        <Trash2 size={13} color="#EF4444" />
                      </button>
                    )}
                    <button
                      onClick={() => setVariants(prev => prev.map(v => v.id === variant.id ? { ...v, expanded: !v.expanded } : v))}
                      className="rounded-lg flex items-center justify-center"
                      style={{ width: 28, height: 28, border: 'none', background: '#F3F4F6', cursor: 'pointer' }}
                      aria-label={variant.expanded ? 'Collapse variant' : 'Expand variant'}
                    >
                      {variant.expanded ? <ChevronUp size={13} color="#6B7280" /> : <ChevronDown size={13} color="#6B7280" />}
                    </button>
                  </div>
                </div>
                {variantNameErrors[variant.id] && (
                  <p style={{ margin: '0 0 8px', fontSize: 11, color: '#EF4444' }}>{variantNameErrors[variant.id]}</p>
                )}
                {variant.expanded && (
                  <>
                    {params.map(p => (
                      <div key={`${variant.id}_${p.id}`} style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>{p.name || 'Unnamed parameter'}</label>
                        <ValueEditor
                          disabled={isReadOnly || idx === 0}
                          param={{ ...p, value: variant.overrides[p.id] ?? p.value }}
                          onChange={(nextVal) => {
                            if (isReadOnly || idx === 0) return;
                            setIsDirty(true);
                            setVariants(prev => prev.map(v => v.id === variant.id ? { ...v, overrides: { ...v.overrides, [p.id]: nextVal } } : v));
                          }}
                        />
                      </div>
                    ))}
                  </>
                )}
              </div>
            ))}
            <button
              onClick={() => {
                if (isReadOnly) return;
                setIsDirty(true);
                addVariant();
              }}
              className="inline-flex items-center gap-1.5 px-3 rounded-lg"
              style={{ height: 36, fontSize: 12, color: '#2563EB', background: '#EFF6FF', border: '1px solid #BFDBFE', cursor: (isReadOnly || variants.length >= MAX_VARIANTS) ? 'not-allowed' : 'pointer', opacity: (isReadOnly || variants.length >= MAX_VARIANTS) ? 0.5 : 1 }}
              disabled={isReadOnly || variants.length >= MAX_VARIANTS}
            >
              <Plus size={12} />
              {variants.length >= MAX_VARIANTS ? 'Max 8 Variants' : 'Add Variant'}
            </button>
            {(showStep2Errors || trafficTouched) && step2Errors.traffic && (
              <p style={{ margin: '8px 0 0', fontSize: 11, color: '#EF4444' }}>{step2Errors.traffic}</p>
            )}

            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #F3F4F6' }}>
              <h2 style={{ margin: '0 0 4px', fontSize: 14, color: '#111827', fontWeight: 700 }}>Conversion Goal</h2>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6B7280' }}>
                Define which user action will be used to measure experiment success.
              </p>

              <div style={{ marginBottom: 10 }}>
                <div className="flex items-center gap-1" style={{ marginBottom: 4 }}>
                  <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>EVENT *</label>
                  <Tooltip delayDuration={150}>
                    <TooltipTrigger asChild>
                      <button type="button" style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'help', color: '#6B7280', display: 'inline-flex' }}>
                        <Info size={12} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6} style={{ background: '#111827', color: '#FFFFFF', fontSize: 12, padding: '8px 10px', borderRadius: 6, boxShadow: '0px 6px 16px rgba(0,0,0,0.12)', maxWidth: 280 }}>
                      Select the event that represents a successful outcome for this experiment.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={goalEventName}
                  onValueChange={(nextEvent) => {
                    if (isReadOnly) return;
                    setIsDirty(true);
                    setGoalEventName(nextEvent);
                    setGoalAttribute('');
                    setGoalAttributeValue('');
                  }}
                  disabled={isReadOnly}
                >
                  <SelectTrigger
                    aria-label="Conversion goal event selector"
                    className={SELECT_TRIGGER_CLASS}
                    style={{ ...SELECT_TRIGGER_STYLE, width: '100%', borderColor: (showStep2Errors && step2Errors.conversionGoal) ? '#EF4444' : '#E5E7EB' }}
                  >
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONVERSION_EVENTS.map(eventName => <SelectItem key={eventName} value={eventName}>{eventName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div className="flex items-center gap-1" style={{ marginBottom: 4 }}>
                  <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>EVENT ATTRIBUTE</label>
                  <Tooltip delayDuration={150}>
                    <TooltipTrigger asChild>
                      <button type="button" style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'help', color: '#6B7280', display: 'inline-flex' }}>
                        <Info size={12} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6} style={{ background: '#111827', color: '#FFFFFF', fontSize: 12, padding: '8px 10px', borderRadius: 6, boxShadow: '0px 6px 16px rgba(0,0,0,0.12)', maxWidth: 280 }}>
                      Optionally narrow the conversion measurement using an event property.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={goalAttribute}
                  onValueChange={(nextAttribute) => {
                    if (isReadOnly) return;
                    setIsDirty(true);
                    setGoalAttribute(nextAttribute);
                    setGoalAttributeValue('');
                  }}
                  disabled={isReadOnly || !goalEventName.trim()}
                >
                  <SelectTrigger
                    aria-label="Conversion goal attribute selector"
                    className={SELECT_TRIGGER_CLASS}
                    style={{ ...SELECT_TRIGGER_STYLE, width: '100%', background: (!isReadOnly && goalEventName.trim()) ? '#FFFFFF' : '#F9FAFB' }}
                  >
                    <SelectValue placeholder="Select event attribute" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEventAttributes.map(attribute => <SelectItem key={attribute} value={attribute}>{attribute}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {goalAttribute.trim() && (
                <div>
                  <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>ATTRIBUTE VALUE (OPTIONAL)</label>
                  <input
                    value={goalAttributeValue}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      if (isReadOnly) return;
                      setIsDirty(true);
                      setGoalAttributeValue(e.target.value);
                    }}
                    placeholder="Measure conversions only when this attribute matches a specific value."
                    style={{
                      width: '100%',
                      height: 40,
                      borderRadius: 8,
                      border: '1px solid #E5E7EB',
                      padding: '0 12px',
                      fontSize: 13,
                      color: '#111827',
                      background: isReadOnly ? '#F9FAFB' : '#FFFFFF',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}
              {showStep2Errors && step2Errors.conversionGoal && (
                <p style={{ margin: '8px 0 0', fontSize: 11, color: '#EF4444' }}>{step2Errors.conversionGoal}</p>
              )}
            </div>
          </div>
          <div className="rounded-xl p-4 self-start" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
            <h3 style={{ margin: 0, fontSize: 13, color: '#111827', fontWeight: 700 }}>Summary</h3>
            <p style={{ margin: '8px 0 4px', fontSize: 12, color: '#6B7280' }}>Segments: {appliedSegmentFilterLabel}</p>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6B7280' }}>
              Number of Users: {audienceUsersLoading ? 'Loading...' : audienceUsers.toLocaleString('en-US')}
            </p>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6B7280' }}>Rollout: {rolloutTraffic}%</p>
            <div style={{ fontSize: 12, color: '#111827', fontWeight: 600, marginBottom: 4 }}>Variants:</div>
            {variants.map((v, i) => (
              <div key={v.id} style={{ fontSize: 12, color: '#6B7280', marginBottom: 2 }}>
                {(v.name || (v.role === 'control' ? 'Control' : `Variant ${String.fromCharCode(65 + i)}`)).trim()} - {v.traffic}% ({Math.round(audienceUsers * (rolloutTraffic / 100) * (v.traffic / 100)).toLocaleString('en-US')} users)
              </div>
            ))}
            <div style={{ fontSize: 12, color: '#111827', fontWeight: 600, marginTop: 10, marginBottom: 4 }}>Conversion Goal:</div>
            {goalEventName.trim() ? (
              <>
                <p style={{ margin: '0 0 2px', fontSize: 12, color: '#6B7280' }}>Event: {goalEventName}</p>
                {goalAttribute.trim() && <p style={{ margin: '0 0 2px', fontSize: 12, color: '#6B7280' }}>Attribute: {goalAttribute}</p>}
                {goalAttribute.trim() && goalAttributeValue.trim() && <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>Value: {goalAttributeValue}</p>}
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>Not selected</p>
            )}
          </div>
        </div>
      )}

      <div className="p-3 flex items-center justify-between" style={{ position: 'fixed', left: 350, right: 0, bottom: 0, zIndex: 20, background: '#FFFFFF', borderTop: '1px solid #E5E7EB', borderLeft: '1px solid #E5E7EB', paddingLeft: 24, paddingRight: 24 }}>
        <button
          onClick={() => (step === 2 ? setStep(1) : navigate('/remote_configuration'))}
          className="px-4 rounded-lg"
          style={{ height: 40, fontSize: 13, fontWeight: 600, color: '#374151', background: '#FFFFFF', border: '1px solid #E5E7EB', cursor: 'pointer' }}
        >
          Back
        </button>
        <div className="flex items-center gap-2">
          <button onClick={onSave} className="px-4 rounded-lg" style={{ height: 40, fontSize: 13, fontWeight: 600, color: '#2563EB', background: '#EFF6FF', border: '1px solid #BFDBFE', cursor: 'pointer' }}>
            Save Draft
          </button>
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <span>
                <button
                  onClick={step === 1 ? onGoStep2 : onApproveSave}
                  className="inline-flex items-center gap-2 px-5 rounded-lg"
                  style={{ height: 40, fontSize: 13, fontWeight: 700, color: '#FFFFFF', background: '#2563EB', border: 'none', cursor: 'pointer' }}
                >
                  {step === 1 ? 'Next' : 'Save Changes'}
                  <ArrowRight size={14} />
                </button>
              </span>
            </TooltipTrigger>
            {step === 1 && !isStep1Valid && (
              <TooltipContent side="top" sideOffset={8} style={{ background: '#111827', color: '#FFFFFF', padding: 12, borderRadius: 6 }}>
                Complete Parameters & Keys to continue.
              </TooltipContent>
            )}
            {step === 2 && !isValid && (
              <TooltipContent side="top" sideOffset={8} style={{ background: '#111827', color: '#FFFFFF', padding: 12, borderRadius: 6 }}>
                Fix targeting/rollout validation to save.
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </div>

      {showApproveModal && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 210, background: 'rgba(17, 24, 39, 0.42)' }}
          onClick={() => setShowApproveModal(false)}
        >
          <div
            className="rounded-2xl p-6"
            style={{ width: 'min(620px, 90vw)', background: '#FFFFFF', boxShadow: '0 18px 50px rgba(0,0,0,0.22)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div style={{ width: 4, height: 32, borderRadius: 9999, background: '#2563EB' }} />
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#2563EB' }}>Approve Configuration</h3>
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: '#111827', textAlign: 'center', lineHeight: 1.4 }}>
              Are you sure you want to deploy the following changes to the users?
            </p>
            <div className="flex justify-center mb-4">
              <span className="px-3 py-1 rounded" style={{ fontSize: 15, fontWeight: 700, color: '#2563EB', background: '#EFF6FF', border: '1px solid #DBEAFE' }}>
                {approveUsersCount.toLocaleString('en-US')} users
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setShowApproveModal(false)}
                className="rounded-xl"
                style={{ height: 48, fontSize: 14, fontWeight: 600, color: '#111827', border: '1px solid #D1D5DB', background: '#FFFFFF', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowApproveModal(false);
                  persistChanges(true);
                }}
                className="rounded-xl"
                style={{ height: 48, fontSize: 14, fontWeight: 600, color: '#FFFFFF', border: '1px solid #2563EB', background: '#2563EB', cursor: 'pointer' }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ValueEditor({
  param,
  disabled,
  invalid,
  onChange,
}: {
  param: Parameter;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  const style: React.CSSProperties = {
    width: '100%',
    minHeight: 48,
    padding: '10px 12px',
    fontSize: 13,
    color: '#111827',
    border: `1px solid ${invalid ? '#EF4444' : '#E5E7EB'}`,
    borderRadius: 8,
    outline: 'none',
    boxSizing: 'border-box',
    background: disabled ? '#F9FAFB' : '#FFFFFF',
    fontFamily: 'Inter, sans-serif',
  };

  if (param.dataType === 'Boolean') {
    const boolValue = param.value === 'true' ? 'true' : 'false';
    return (
      <Select value={boolValue} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          className={SELECT_TRIGGER_CLASS}
          style={{
            ...SELECT_TRIGGER_STYLE,
            width: '100%',
            height: 48,
            minHeight: 48,
            borderColor: invalid ? '#EF4444' : '#E5E7EB',
          }}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="false">FALSE</SelectItem>
          <SelectItem value="true">TRUE</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (param.dataType === 'JSON') {
    return <textarea value={param.value} disabled={disabled} onChange={e => onChange(e.target.value)} rows={4} style={{ ...style, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', resize: 'vertical' }} />;
  }

  if (param.dataType === 'Integer') {
    return <input type="number" value={param.value} disabled={disabled} onChange={e => onChange(e.target.value)} style={style} />;
  }

  return <input type="text" value={param.value} disabled={disabled} onChange={e => onChange(e.target.value)} style={style} />;
}