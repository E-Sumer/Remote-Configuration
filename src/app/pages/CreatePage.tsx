import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle, ArrowRight, ChevronDown, ChevronUp, Code2, Copy, Info, MoreHorizontal, Plus, Trash2, X } from 'lucide-react';
import { useConfigs } from '../store/ConfigContext';
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
  description: string;
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

type ConversionGoalRow = {
  id: string;
  event: string;
  attribute: string;
};

const TYPE_OPTIONS: ConfigType[] = ['Boolean', 'String', 'Integer', 'JSON'];
const FILTER_FIELD_OPTIONS = ['Segment Name', 'Channel', 'Platform', 'Region'];
const FILTER_VALUE_OPTIONS: Record<string, string[]> = {
  'Segment Name': ['VIP', 'New Users', 'Churn Risk', 'High Intent'],
  Channel: ['Mobile', 'Web', 'Email'],
  Platform: ['iOS', 'Android', 'Web'],
  Region: ['EU', 'US', 'MENA', 'APAC'],
};
const FILTER_OPERATOR_OPTIONS = ['is equal', 'does not equal'];
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

function createParameter(): Parameter {
  return { id: createId('param'), name: '', dataType: 'String', description: '', value: '', collapsed: false };
}

function createAudienceRule(): AudienceRule {
  return { id: createId('aud_rule'), category: 'Segment Name', field: 'New Users', operator: 'is equal', value: '' };
}

function createAudienceGroup(name: string): AudienceGroup {
  return { id: createId('aud_group'), name, logic: 'AND', rules: [createAudienceRule()], subgroups: [] };
}

function createConversionGoalRow(): ConversionGoalRow {
  return { id: createId('conv_goal'), event: '', attribute: '' };
}

function createVariant(name: string, traffic: number, role: 'control' | 'variant'): Variant {
  return { id: createId('variant'), name, role, traffic, overrides: {}, description: '', expanded: false };
}

function getVariantDefaultName(index: number) {
  if (index === 0) return 'Control';
  return `Variant ${String.fromCharCode(65 + index)}`;
}

function parseValue(type: ConfigType, value: string) {
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

function getTargetAudienceUsers(segments: string[]) {
  const seed = segments.join('|') || 'all-users';
  let hash = 7;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return ((hash % 85000) + 1200).toLocaleString('en-US');
}

function validateStep1(configName: string, configKey: string, configDescription: string, params: Parameter[]) {
  const next: Record<string, string> = {};
  if (!configName.trim()) next.configName = 'Configuration name is required';
  if (!configKey.trim()) next.configKey = 'Configuration key is required';
  else if (!isValidKey(configKey.trim())) next.configKey = 'Use lowercase letters, numbers, and underscores only';
  if (!configDescription.trim()) next.configDescription = 'Description is required';
  if (params.length === 0) next.params = 'At least one parameter is required.';
  params.forEach(p => {
    if (!p.name.trim()) next[`name_${p.id}`] = 'Parameter key is required';
    else if (!isValidKey(p.name.trim())) next[`name_${p.id}`] = 'Only lowercase letters, numbers, and underscores allowed';
    if (p.value.trim() === '') next[`value_${p.id}`] = 'Value is required';
    if (p.dataType === 'Boolean' && p.value !== 'true' && p.value !== 'false') next[`value_${p.id}`] = 'Invalid Boolean';
    if (p.dataType === 'Integer' && Number.isNaN(Number(p.value))) next[`value_${p.id}`] = 'Invalid Integer';
    if (p.dataType === 'JSON' && p.value.trim()) {
      try {
        const parsed = JSON.parse(p.value);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          next[`value_${p.id}`] = 'Invalid JSON';
        }
      } catch {
        next[`value_${p.id}`] = 'Invalid JSON';
      }
    }
  });
  return next;
}

export default function CreatePage() {
  const navigate = useNavigate();
  const { addConfig, configs, stopConfig } = useConfigs();

  const [step, setStep] = useState<1 | 2>(1);
  const [params, setParams] = useState<Parameter[]>([]);
  const [variants, setVariants] = useState<Variant[]>([
    createVariant('Control', 50, 'control'),
    createVariant('Variant B', 50, 'variant'),
  ]);
  const [rolloutTraffic, setRolloutTraffic] = useState(100);
  const [showDeveloperView, setShowDeveloperView] = useState(true);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [copyOk, setCopyOk] = useState(false);
  const [jsonFlash, setJsonFlash] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [showStep2Errors, setShowStep2Errors] = useState(false);
  const [trafficTouched, setTrafficTouched] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [configName, setConfigName] = useState('');
  const [configKey, setConfigKey] = useState('');
  const [configDescription, setConfigDescription] = useState('');
  const [conversionGoalRows, setConversionGoalRows] = useState<ConversionGoalRow[]>([createConversionGoalRow()]);
  const [goalEventSearch, setGoalEventSearch] = useState<Record<string, string>>({});
  const [audienceRules, setAudienceRules] = useState<AudienceRule[]>([]);
  const [audienceGroups, setAudienceGroups] = useState<AudienceGroup[]>([]);
  const [audienceLogic, setAudienceLogic] = useState<'AND' | 'OR'>('AND');
  const [audienceFieldSearch, setAudienceFieldSearch] = useState<Record<string, string>>({});
  const [openAudienceGroupMenuId, setOpenAudienceGroupMenuId] = useState<string | null>(null);
  const [renamingAudienceGroupId, setRenamingAudienceGroupId] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [audienceUsers, setAudienceUsers] = useState(46842);
  const [audienceUsersLoading, setAudienceUsersLoading] = useState(false);
  const [conflictModal, setConflictModal] = useState<null | { configId: string; configName: string; parameterKey: string; paramIds: string[] }>(null);
  const [conflictParamErrors, setConflictParamErrors] = useState<Record<string, string>>({});
  const [conflictSuccessToast, setConflictSuccessToast] = useState<string | null>(null);

  const step1Errors = useMemo(() => validateStep1(configName, configKey, configDescription, params), [configName, configKey, configDescription, params]);
  const isStep1Valid = Object.keys(step1Errors).length === 0;
  const canOpenStep2 = isStep1Valid;
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
    if (!conversionGoalRows.some(row => row.event.trim())) next.conversionGoal = 'Please select at least one conversion event.';
    const duplicateRule = (() => {
      const seen = new Set<string>();
      for (const row of conversionGoalRows) {
        const event = row.event.trim();
        if (!event) continue;
        const key = `${event.toLowerCase()}::${row.attribute.trim().toLowerCase()}`;
        if (seen.has(key)) return true;
        seen.add(key);
      }
      return false;
    })();
    if (duplicateRule) next.conversionGoalDuplicate = 'Duplicate event + attribute rules are not allowed.';
    const missingOverrides = variants.some(v => params.some(p => `${v.overrides[p.id] ?? p.value ?? ''}`.trim() === ''));
    if (missingOverrides) next.overrides = 'Fill required override values.';
    if (Object.keys(variantNameErrors).length > 0) next.variantNames = 'Variant names must be unique.';
    if (Math.abs(trafficTotal - 100) > 0.01) next.traffic = `Variant traffic must equal 100%. Current total: ${Math.round(trafficTotal)}%.`;
    return next;
  }, [trafficTotal, totalAudienceRuleCount, rolloutTraffic, variants, params, variantNameErrors, conversionGoalRows]);
  const canStartConfiguration = isStep1Valid && Object.keys(step2Errors).length === 0;
  const appliedSegmentFilterLabel = useMemo(() => {
    if (totalAudienceRuleCount === 0) return 'No filters';
    return `${totalAudienceRuleCount} rule${totalAudienceRuleCount > 1 ? 's' : ''}`;
  }, [totalAudienceRuleCount]);
  const approveUsersCount = useMemo(
    () => Math.max(0, Math.round(audienceUsers * (rolloutTraffic / 100))),
    [audienceUsers, rolloutTraffic],
  );
  const getNextGroupName = (groups: AudienceGroup[]) => {
    const subgroupCount = groups.reduce((sum, g) => sum + g.subgroups.length, 0);
    const index = groups.length + subgroupCount;
    return `Group ${String.fromCharCode(65 + index)}`;
  };

  useEffect(() => {
    const baseUsers = 46842;
    const divisor = Math.pow(2, Math.max(0, totalAudienceRuleCount - 1));
    const nextUsers = Math.max(1, Math.floor(baseUsers / divisor));
    setAudienceUsersLoading(true);
    const timer = window.setTimeout(() => {
      setAudienceUsers(nextUsers);
      setAudienceUsersLoading(false);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [totalAudienceRuleCount]);

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
    const timer = window.setTimeout(() => {
      if (isDirty) setSavedAt(new Date());
    }, 10000);
    return () => window.clearTimeout(timer);
  }, [configName, configKey, configDescription, params, variants, rolloutTraffic, conversionGoalRows, audienceRules, audienceGroups, isDirty]);

  useEffect(() => {
    if (!savedAt) return;
    const timer = window.setTimeout(() => setSavedAt(null), 2000);
    return () => window.clearTimeout(timer);
  }, [savedAt]);

  const onAddParameter = () => {
    setIsDirty(true);
    setParams(prev => [...prev, createParameter()]);
  };

  const onDeleteParameter = (id: string) => {
    setIsDirty(true);
    setParams(prev => prev.filter(p => p.id !== id));
    setVariants(prev => prev.map(v => {
      const next = { ...v.overrides };
      delete next[id];
      return { ...v, overrides: next };
    }));
  };

  const onUpdateParameter = (id: string, patch: Partial<Parameter>) => {
    setIsDirty(true);
    setParams(prev => {
      const current = prev.find(p => p.id === id);
      const oldValue = current?.value ?? '';
      const nextValue =
        typeof patch.value === 'string'
          ? patch.value
          : (patch.dataType === 'JSON' ? '{\n}' : patch.dataType === 'Boolean' ? 'false' : undefined);

      if (nextValue !== undefined && nextValue !== oldValue) {
        setVariants(vprev => vprev.map(v => {
          const existing = v.overrides[id];
          const shouldSync = v.role === 'control' || existing === undefined || String(existing) === String(oldValue);
          if (!shouldSync) return v;
          return { ...v, overrides: { ...v.overrides, [id]: nextValue } };
        }));
      }

      return prev.map(p => (p.id === id ? { ...p, ...patch, ...(nextValue !== undefined ? { value: nextValue } : {}) } : p));
    });
    if (typeof patch.name === 'string') {
      setConflictParamErrors(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const onSaveDraft = () => {
    setShowErrors(true);
    if (!isStep1Valid) return;
    setSavedAt(new Date());
    setIsDirty(false);
  };

  const goStep2 = () => {
    setShowErrors(true);
    if (!isStep1Valid) return;
    const normalizedKeys = params.map(p => ({ id: p.id, key: p.name.trim().toLowerCase() })).filter(p => p.key);
    const conflict = configs
      .filter(c => c.status === 'LIVE')
      .map(c => {
        const liveKeys = new Set<string>(
          (c.parameters || []).map(p => p.key.trim().toLowerCase())
            .concat((c.keys || []).map(k => k.name.trim().toLowerCase())),
        );
        const conflictingParams = normalizedKeys.filter(p => liveKeys.has(p.key));
        if (conflictingParams.length === 0) return null;
        return {
          configId: c.id,
          configName: c.name,
          parameterKey: conflictingParams[0].key,
          paramIds: conflictingParams.map(p => p.id),
        };
      })
      .find(Boolean) || null;
    if (conflict) {
      setConflictModal(conflict);
      return;
    }
    setShowStep2Errors(false);
    setStep(2);
  };

  const addVariant = () => {
    if (variants.length >= MAX_VARIANTS) return;
    setIsDirty(true);
    const nextIndex = variants.length;
    const label = getVariantDefaultName(nextIndex);
    setVariants(prev => [...prev, createVariant(label, 0, 'variant')]);
  };

  const removeVariant = (variantId: string) => {
    setIsDirty(true);
    setVariants(prev => prev.filter(v => v.id !== variantId));
  };

  const updateConversionGoalRow = (rowId: string, patch: Partial<ConversionGoalRow>) => {
    setIsDirty(true);
    setConversionGoalRows(prev => prev.map(row => (row.id === rowId ? { ...row, ...patch } : row)));
  };

  const addConversionGoalRow = () => {
    setIsDirty(true);
    setConversionGoalRows(prev => [...prev, createConversionGoalRow()]);
  };

  const removeConversionGoalRow = (rowId: string) => {
    setIsDirty(true);
    setConversionGoalRows(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter(row => row.id !== rowId);
    });
    setGoalEventSearch(prev => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  };

  const completeStartConfiguration = () => {
    const selectedConversionGoals = conversionGoalRows
      .filter(row => row.event.trim())
      .map(row => ({
        event: row.event.trim(),
        attribute: row.attribute.trim() || undefined,
      }));

    const keys = params.map(p => ({
      id: p.id,
      name: p.name.trim(),
      dataType: p.dataType,
      defaultValue: p.value,
      variants: variants.map((v, idx) => ({
        id: `${p.id}_v_${idx}`,
        name: v.name,
        role: v.role,
        value: v.overrides[p.id] ?? p.value,
        traffic: v.traffic,
        isControl: v.role === 'control',
      })),
    }));

    const created = addConfig({
      name: configName.trim(),
      key: configKey.trim(),
      configKey: configKey.trim(),
      description: configDescription.trim(),
      status: 'DRAFT',
      type: params[0]?.dataType || 'String',
      variantsCount: Math.max(variants.length, 1),
      rolloutPercentage: rolloutTraffic,
      hasGradualRollout: rolloutTraffic < 100,
      targetSegment: appliedSegmentFilterLabel,
      conversionGoal: selectedConversionGoals[0],
      conversionGoals: selectedConversionGoals,
      environment: 'Prod',
      createdBy: 'John Smith',
      keys,
      parameters: params.map(p => ({
        id: p.id,
        key: p.name.trim(),
        type: toParameterType(p.dataType),
        description: p.description.trim() || undefined,
        value: normalizeParameterValue(p.dataType, p.value),
      })),
      usedInCampaign: false,
    });
    setIsDirty(false);
    navigate('/remote_configuration');
  };

  const startConfiguration = () => {
    setShowStep2Errors(true);
    if (!canStartConfiguration) return;
    setShowApproveModal(true);
  };

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
      <div className="mb-3 rounded-lg px-3 py-2" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
        <div className="flex items-start gap-3">
          <div style={{ width: 4, height: 36, borderRadius: 9999, background: '#2563EB', marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div className="flex items-center gap-2">
              <h1 style={{ margin: 0, fontSize: 18, color: '#111827', fontWeight: 700, lineHeight: 1.2 }}>Create Remote Configuration</h1>
              <span className="px-2 py-0.5 rounded" style={{ fontSize: 11, color: '#2563EB', background: '#EFF6FF', fontWeight: 600 }}>v1.0 (Draft)</span>
              {savedAt && <span style={{ fontSize: 11, color: '#22C55E' }}>Saved just now</span>}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>Create a configuration and control its rollout.</p>
          </div>
        </div>
      </div>

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
          onClick={() => { if (canOpenStep2) setStep(2); }}
          className="text-left px-4 py-2"
          disabled={!canOpenStep2}
          style={{ border: 'none', background: '#FFFFFF', cursor: canOpenStep2 ? 'pointer' : 'not-allowed', opacity: canOpenStep2 ? 1 : 0.6 }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: step === 2 ? '#2563EB' : '#6B7280', lineHeight: 1.1 }}>Targeting & Rollout</div>
          <div style={{ marginTop: 2, fontSize: 11, color: '#6B7280' }}>Choose who receives the configuration and how it rolls out.</div>
        </button>
      </div>

      {step === 1 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 rounded-xl p-4" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Basic Information</h2>
            <p style={{ margin: '4px 0 12px', fontSize: 12, color: '#6B7280' }}>Name your configuration and define the key your app will use to fetch it.</p>

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
                <input value={configName} onChange={e => { setConfigName(e.target.value); setIsDirty(true); }} placeholder="e.g. Flight Details UI" style={inputStyle(showErrors && Boolean(step1Errors.configName))} />
                {showErrors && step1Errors.configName && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#EF4444' }}>{step1Errors.configName}</p>}
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
                <input value={configKey} onChange={e => { setConfigKey(e.target.value); setIsDirty(true); }} placeholder="e.g. flight_details_ui" style={inputStyle(showErrors && Boolean(step1Errors.configKey))} />
                {showErrors && step1Errors.configKey && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#EF4444' }}>{step1Errors.configKey}</p>}
              </div>
              <div className="col-span-2">
                <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>DESCRIPTION *</label>
                <input value={configDescription} onChange={e => { setConfigDescription(e.target.value); setIsDirty(true); }} style={inputStyle(showErrors && Boolean(step1Errors.configDescription))} />
                {showErrors && step1Errors.configDescription && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#EF4444' }}>{step1Errors.configDescription}</p>}
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
                <button onClick={onAddParameter} className="mt-4 inline-flex items-center gap-1.5 px-4 rounded-lg" style={{ height: 40, fontSize: 13, fontWeight: 600, color: '#FFFFFF', background: '#2563EB', border: 'none', cursor: 'pointer' }}>
                  <Plus size={14} />
                  Add Parameter
                </button>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {params.map((p, i) => {
                const nameErr = step1Errors[`name_${p.id}`] || conflictParamErrors[p.id];
                const valueErr = step1Errors[`value_${p.id}`];
                return (
                  <div key={p.id} className="rounded-xl" style={{ border: `1px solid ${(showErrors && (nameErr || valueErr)) ? '#FCA5A5' : '#E5E7EB'}`, background: '#FFFFFF' }}>
                    <div className="flex items-center gap-2 px-3" style={{ height: 48, borderBottom: p.collapsed ? 'none' : '1px solid #F3F4F6' }}>
                      <strong style={{ flex: 1, fontSize: 13, color: '#111827' }}>{p.name || `New Parameter ${i + 1}`}</strong>
                      <span className="px-2 py-0.5 rounded" style={{ fontSize: 11, color: '#374151', background: '#F3F4F6', fontWeight: 600 }}>{p.dataType}</span>
                      <button onClick={() => onUpdateParameter(p.id, { collapsed: !p.collapsed })} className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, border: 'none', background: '#F3F4F6', cursor: 'pointer' }}>
                        {p.collapsed ? <ChevronDown size={13} color="#6B7280" /> : <ChevronUp size={13} color="#6B7280" />}
                      </button>
                      <button
                        onClick={() => onDeleteParameter(p.id)}
                        className="rounded-lg flex items-center justify-center"
                        style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF'; }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {!p.collapsed && (
                      <div className="p-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>PARAMETER KEY *</label>
                            <input value={p.name} onChange={e => onUpdateParameter(p.id, { name: e.target.value })} placeholder="e.g. promo_banner_enabled" style={inputStyle(showErrors && Boolean(nameErr))} />
                            {showErrors && nameErr && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#EF4444' }}>{nameErr}</p>}
                          </div>
                          <div>
                            <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>DATA TYPE *</label>
                            <div>
                              <Select
                                value={p.dataType}
                                onValueChange={(value) =>
                                  onUpdateParameter(p.id, {
                                    dataType: value as ConfigType,
                                    value: value === 'Boolean' ? 'false' : value === 'JSON' ? '{\n}' : '',
                                  })
                                }
                              >
                                <SelectTrigger className={SELECT_TRIGGER_CLASS} style={{ ...SELECT_TRIGGER_STYLE, height: 48, minHeight: 48, width: '100%' }}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TYPE_OPTIONS.map(t => (
                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="col-span-2">
                            <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>DESCRIPTION (OPTIONAL)</label>
                            <input value={p.description} onChange={e => onUpdateParameter(p.id, { description: e.target.value })} style={inputStyle()} />
                          </div>
                          <div className="col-span-2">
                            <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>VALUE *</label>
                            <ValueEditor param={p} invalid={showErrors && Boolean(valueErr)} onChange={(nextValue) => onUpdateParameter(p.id, { value: nextValue })} />
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

            {params.length > 0 && (
              <button onClick={onAddParameter} className="mt-3 inline-flex items-center gap-1.5 px-4 rounded-lg" style={{ height: 40, fontSize: 13, fontWeight: 600, color: '#2563EB', background: '#EFF6FF', border: '1px solid #BFDBFE', cursor: 'pointer' }}>
                <Plus size={14} />
                Add Parameter
              </button>
            )}
          </div>

          <JsonPreviewPanel
            showDeveloperView={showDeveloperView}
            setShowDeveloperView={setShowDeveloperView}
            copyOk={copyOk}
            setCopyOk={setCopyOk}
            jsonPreview={jsonPreview}
            lines={lines}
            jsonFlash={jsonFlash}
          />
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 rounded-xl p-4" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
            <h2 style={{ margin: 0, fontSize: 14, color: '#111827', fontWeight: 700 }}>Target Audience</h2>
            <p style={{ margin: '4px 0 10px', fontSize: 12, color: '#6B7280' }}>Only users in these segments are eligible for this configuration.</p>
            <div className="rounded-lg p-3" style={{ border: `1px solid ${(showStep2Errors && step2Errors.segments) ? '#EF4444' : '#E5E7EB'}`, background: '#FFFFFF', marginBottom: 10 }}>
              {audienceRules.length === 0 && audienceGroups.length === 0 ? (
                <div className="rounded-lg border" style={{ borderStyle: 'dashed', borderColor: '#D1D5DB', padding: '20px 16px', textAlign: 'center', color: '#4B5563', fontSize: 13, fontWeight: 600 }}>
                  Add a Filter Rule or Filter Group to start segmenting your users.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {audienceRules.map((row) => (
                    <React.Fragment key={row.id}>
                      <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-2 py-2 overflow-hidden">
                        <Select value={row.category} onValueChange={(category) => {
                          setIsDirty(true);
                          setAudienceRules(prev => prev.map(r => r.id === row.id ? { ...r, category, field: FILTER_VALUE_OPTIONS[category]?.[0] || '' } : r));
                        }}>
                          <SelectTrigger className={`${SELECT_TRIGGER_CLASS} min-w-0`} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger>
                          <SelectContent>{FILTER_FIELD_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={row.field} onValueChange={(field) => {
                          setIsDirty(true);
                          setAudienceRules(prev => prev.map(r => r.id === row.id ? { ...r, field } : r));
                        }}>
                          <SelectTrigger className={`${SELECT_TRIGGER_CLASS} min-w-0`} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <div style={{ padding: 8 }}>
                              <input
                                value={audienceFieldSearch[row.id] || ''}
                                onChange={(e) => setAudienceFieldSearch(prev => ({ ...prev, [row.id]: e.target.value }))}
                                placeholder="Search segments"
                                style={{ width: '100%', height: 32, borderRadius: 8, border: '1px solid #E5E7EB', padding: '0 10px', fontSize: 12, color: '#111827', outline: 'none' }}
                              />
                            </div>
                            {(FILTER_VALUE_OPTIONS[row.category] || [])
                              .filter(option => option.toLowerCase().includes((audienceFieldSearch[row.id] || '').toLowerCase()))
                              .map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={row.operator} onValueChange={(operator) => {
                          setIsDirty(true);
                          setAudienceRules(prev => prev.map(r => r.id === row.id ? { ...r, operator } : r));
                        }}>
                          <SelectTrigger className={`${SELECT_TRIGGER_CLASS} min-w-0`} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger>
                          <SelectContent>{FILTER_OPERATOR_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                        </Select>
                        <input value={row.value} onChange={(e) => {
                          setIsDirty(true);
                          const value = e.target.value;
                          setAudienceRules(prev => prev.map(r => r.id === row.id ? { ...r, value } : r));
                        }} placeholder="Enter value..." style={{ height: 36, borderRadius: 8, border: '1px solid #E5E7EB', padding: '0 10px', fontSize: 12, color: '#212121', outline: 'none', width: '100%' }} />
                        <button
                          onClick={() => setAudienceRules(prev => prev.filter(r => r.id !== row.id))}
                          className="rounded-lg flex items-center justify-center"
                          style={{ width: 20, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF'; }}
                          aria-label="Delete filter rule"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      {(idx => {
                        const position = idx;
                        const totalTop = audienceRules.length + audienceGroups.length;
                        if (position >= totalTop - 1) return null;
                        const isPrimaryLogicSelector = position === 0;
                        return (
                          <div style={{ paddingLeft: 8, width: 96 }}>
                            {isPrimaryLogicSelector ? (
                              <Select value={audienceLogic} onValueChange={(logic) => setAudienceLogic(logic as 'AND' | 'OR')}>
                                <SelectTrigger className={SELECT_TRIGGER_CLASS} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="AND">AND</SelectItem><SelectItem value="OR">OR</SelectItem></SelectContent>
                              </Select>
                            ) : (
                              <div style={{ width: '100%', height: 36, borderRadius: 9999, border: '1px solid #E5E7EB', background: '#F9FAFB', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#9CA3AF', fontWeight: 600 }}>
                                {audienceLogic}
                              </div>
                            )}
                          </div>
                        );
                      })(audienceRules.findIndex(r => r.id === row.id))}
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
                              onBlur={() => setRenamingAudienceGroupId(null)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') setRenamingAudienceGroupId(null);
                                if (e.key === 'Escape') setRenamingAudienceGroupId(null);
                              }}
                              onChange={(e) => {
                                setIsDirty(true);
                                const name = e.target.value;
                                setAudienceGroups(prev => prev.map(g => g.id === group.id ? { ...g, name } : g));
                              }}
                              style={{ height: 30, width: 120, borderRadius: 8, border: '1px solid #5566E8', background: '#5566E8', color: '#FFFFFF', fontSize: 12, fontWeight: 700, padding: '0 10px', outline: 'none' }}
                            />
                          ) : (
                            <span style={{ height: 30, width: 120, borderRadius: 8, border: '1px solid #5566E8', background: '#5566E8', color: '#FFFFFF', fontSize: 12, fontWeight: 700, padding: '0 10px', display: 'inline-flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {group.name}
                            </span>
                          )}
                          <Select
                            value={group.logic}
                            onValueChange={(logic) => {
                              setIsDirty(true);
                              setAudienceGroups(prev => prev.map(g => g.id === group.id ? { ...g, logic: logic as 'AND' | 'OR' } : g));
                            }}
                          >
                            <SelectTrigger className={SELECT_TRIGGER_CLASS} style={{ ...SELECT_TRIGGER_STYLE, width: 90 }}><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="AND">AND</SelectItem><SelectItem value="OR">OR</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => {
                            setIsDirty(true);
                            setAudienceGroups(prev => prev.map(g => g.id === group.id ? { ...g, rules: [...g.rules, createAudienceRule()] } : g));
                          }} style={{ border: 'none', background: 'transparent', color: '#3B82F6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Add Rule</button>
                          <button onClick={() => {
                            if (group.subgroups.length >= 2) return;
                            setIsDirty(true);
                            const subgroup: AudienceSubgroup = { id: createId('aud_subgroup'), name: getNextGroupName(audienceGroups), logic: group.logic, rules: [createAudienceRule()] };
                            setAudienceGroups(prev => prev.map(g => g.id === group.id ? { ...g, subgroups: [...g.subgroups, subgroup] } : g));
                          }} style={{ border: 'none', background: 'transparent', color: group.subgroups.length >= 2 ? '#9CA3AF' : '#3B82F6', fontSize: 12, fontWeight: 600, cursor: group.subgroups.length >= 2 ? 'not-allowed' : 'pointer' }}>Add Subgroup</button>
                          <div className="relative">
                            <button
                              onClick={() => setOpenAudienceGroupMenuId(prev => prev === group.id ? null : group.id)}
                              className="rounded-md flex items-center justify-center"
                              style={{ width: 20, height: 20, border: 'none', background: 'transparent', cursor: 'pointer' }}
                              aria-label="Group actions"
                            >
                              <MoreHorizontal size={14} color="#6B7280" />
                            </button>
                            {openAudienceGroupMenuId === group.id && (
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
                        {group.rules.map((row, rowIndex) => (
                          <React.Fragment key={row.id}>
                          <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-2 py-2 overflow-hidden">
                            <Select value={row.category} onValueChange={(category) => {
                              setIsDirty(true);
                              setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : { ...g, rules: g.rules.map(r => r.id === row.id ? { ...r, category, field: FILTER_VALUE_OPTIONS[category]?.[0] || '' } : r) }));
                            }}><SelectTrigger className={`${SELECT_TRIGGER_CLASS} min-w-0`} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger><SelectContent>{FILTER_FIELD_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>
                            <Select value={row.field} onValueChange={(field) => {
                              setIsDirty(true);
                              setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : { ...g, rules: g.rules.map(r => r.id === row.id ? { ...r, field } : r) }));
                            }}>
                              <SelectTrigger className={`${SELECT_TRIGGER_CLASS} min-w-0`} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <div style={{ padding: 8 }}>
                                  <input
                                    value={audienceFieldSearch[row.id] || ''}
                                    onChange={(e) => setAudienceFieldSearch(prev => ({ ...prev, [row.id]: e.target.value }))}
                                    placeholder="Search segments"
                                    style={{ width: '100%', height: 32, borderRadius: 8, border: '1px solid #E5E7EB', padding: '0 10px', fontSize: 12, color: '#111827', outline: 'none' }}
                                  />
                                </div>
                                {(FILTER_VALUE_OPTIONS[row.category] || [])
                                  .filter(option => option.toLowerCase().includes((audienceFieldSearch[row.id] || '').toLowerCase()))
                                  .map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Select value={row.operator} onValueChange={(operator) => {
                              setIsDirty(true);
                              setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : { ...g, rules: g.rules.map(r => r.id === row.id ? { ...r, operator } : r) }));
                            }}><SelectTrigger className={`${SELECT_TRIGGER_CLASS} min-w-0`} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger><SelectContent>{FILTER_OPERATOR_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>
                            <input value={row.value} onChange={(e) => {
                              setIsDirty(true);
                              const value = e.target.value;
                              setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : { ...g, rules: g.rules.map(r => r.id === row.id ? { ...r, value } : r) }));
                            }} placeholder="Enter value..." style={{ height: 36, borderRadius: 8, border: '1px solid #E5E7EB', padding: '0 10px', fontSize: 12, color: '#212121', outline: 'none', width: '100%' }} />
                            <button
                              onClick={() => {
                              setIsDirty(true);
                              setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : { ...g, rules: g.rules.filter(r => r.id !== row.id) }));
                            }}
                              className="rounded-lg flex items-center justify-center"
                              style={{ width: 20, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF' }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF'; }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          {rowIndex < group.rules.length - 1 && (
                            <div style={{ paddingLeft: 8, width: 96 }}>
                              <div style={{ width: '100%', height: 36, borderRadius: 9999, border: '1px solid #E5E7EB', background: '#F9FAFB', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#9CA3AF', fontWeight: 600 }}>
                                {group.logic}
                              </div>
                            </div>
                          )}
                          </React.Fragment>
                        ))}

                        {group.subgroups.map((sg) => (
                          <div key={sg.id} className="rounded-lg border p-2" style={{ borderColor: '#D1D5DB', background: '#FFFFFF', marginLeft: 16 }}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="inline-flex items-center gap-2">
                                <strong style={{ fontSize: 12, color: '#374151' }}>{sg.name}</strong>
                                <Select
                                  value={sg.logic}
                                  onValueChange={(logic) => {
                                    setIsDirty(true);
                                    setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : {
                                      ...g,
                                      subgroups: g.subgroups.map(s => s.id === sg.id ? { ...s, logic: logic as 'AND' | 'OR' } : s),
                                    }));
                                  }}
                                >
                                  <SelectTrigger className={SELECT_TRIGGER_CLASS} style={{ ...SELECT_TRIGGER_STYLE, width: 90 }}><SelectValue /></SelectTrigger>
                                  <SelectContent><SelectItem value="AND">AND</SelectItem><SelectItem value="OR">OR</SelectItem></SelectContent>
                                </Select>
                              </div>
                              <div className="inline-flex items-center gap-3">
                                <button
                                  onClick={() => {
                                    setIsDirty(true);
                                    setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : {
                                      ...g,
                                      subgroups: g.subgroups.map(s => s.id !== sg.id ? s : { ...s, rules: [...s.rules, createAudienceRule()] }),
                                    }));
                                  }}
                                  style={{ border: 'none', background: 'transparent', color: '#3B82F6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                >
                                  Add Rule
                                </button>
                                <button
                                  onClick={() => {
                                    if (group.subgroups.length >= 2) return;
                                    setIsDirty(true);
                                    const nested: AudienceSubgroup = { id: createId('aud_subgroup'), name: getNextGroupName(audienceGroups), logic: sg.logic, rules: [createAudienceRule()] };
                                    setAudienceGroups(prev => prev.map(g => g.id === group.id ? { ...g, subgroups: [...g.subgroups, nested] } : g));
                                  }}
                                  style={{ border: 'none', background: 'transparent', color: group.subgroups.length >= 2 ? '#9CA3AF' : '#3B82F6', fontSize: 12, fontWeight: 600, cursor: group.subgroups.length >= 2 ? 'not-allowed' : 'pointer' }}
                                >
                                  Add Subgroup
                                </button>
                                <button
                                  onClick={() => {
                                    setIsDirty(true);
                                    setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : { ...g, subgroups: g.subgroups.filter(s => s.id !== sg.id) }));
                                  }}
                                  className="rounded-lg flex items-center justify-center"
                                  style={{ width: 20, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF' }}
                                  onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF'; }}
                                  aria-label={`Delete ${sg.name}`}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                            {sg.rules.map((r, rIndex) => (
                              <React.Fragment key={r.id}>
                              <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-2 py-2 overflow-hidden" style={{ marginBottom: 6 }}>
                                <Select value={r.category} onValueChange={(category) => {
                                  setIsDirty(true);
                                  setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : { ...g, subgroups: g.subgroups.map(s => s.id !== sg.id ? s : { ...s, rules: s.rules.map(rr => rr.id === r.id ? { ...rr, category, field: FILTER_VALUE_OPTIONS[category]?.[0] || '' } : rr) }) }));
                                }}><SelectTrigger className={`${SELECT_TRIGGER_CLASS} min-w-0`} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger><SelectContent>{FILTER_FIELD_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>
                                <Select value={r.field} onValueChange={(field) => {
                                  setIsDirty(true);
                                  setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : { ...g, subgroups: g.subgroups.map(s => s.id !== sg.id ? s : { ...s, rules: s.rules.map(rr => rr.id === r.id ? { ...rr, field } : rr) }) }));
                                }}>
                                  <SelectTrigger className={`${SELECT_TRIGGER_CLASS} min-w-0`} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <div style={{ padding: 8 }}>
                                      <input
                                        value={audienceFieldSearch[r.id] || ''}
                                        onChange={(e) => setAudienceFieldSearch(prev => ({ ...prev, [r.id]: e.target.value }))}
                                        placeholder="Search segments"
                                        style={{ width: '100%', height: 32, borderRadius: 8, border: '1px solid #E5E7EB', padding: '0 10px', fontSize: 12, color: '#111827', outline: 'none' }}
                                      />
                                    </div>
                                    {(FILTER_VALUE_OPTIONS[r.category] || [])
                                      .filter(option => option.toLowerCase().includes((audienceFieldSearch[r.id] || '').toLowerCase()))
                                      .map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <Select value={r.operator} onValueChange={(operator) => {
                                  setIsDirty(true);
                                  setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : { ...g, subgroups: g.subgroups.map(s => s.id !== sg.id ? s : { ...s, rules: s.rules.map(rr => rr.id === r.id ? { ...rr, operator } : rr) }) }));
                                }}><SelectTrigger className={`${SELECT_TRIGGER_CLASS} min-w-0`} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger><SelectContent>{FILTER_OPERATOR_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>
                                <input value={r.value} onChange={(e) => {
                                  setIsDirty(true);
                                  const value = e.target.value;
                                  setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : { ...g, subgroups: g.subgroups.map(s => s.id !== sg.id ? s : { ...s, rules: s.rules.map(rr => rr.id === r.id ? { ...rr, value } : rr) }) }));
                                }} placeholder="Enter value..." style={{ height: 36, borderRadius: 8, border: '1px solid #E5E7EB', padding: '0 10px', fontSize: 12, color: '#212121', outline: 'none', width: '100%' }} />
                                <button
                                  onClick={() => {
                                  setIsDirty(true);
                                  setAudienceGroups(prev => prev.map(g => g.id !== group.id ? g : { ...g, subgroups: g.subgroups.map(s => s.id !== sg.id ? s : { ...s, rules: s.rules.filter(rr => rr.id !== r.id) }) }));
                                }}
                                  className="rounded-lg flex items-center justify-center"
                                  style={{ width: 20, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF' }}
                                  onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF'; }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                              {rIndex < sg.rules.length - 1 && (
                                <div style={{ paddingLeft: 8, width: 96, marginBottom: 6 }}>
                                  <div style={{ width: '100%', height: 36, borderRadius: 9999, border: '1px solid #E5E7EB', background: '#F9FAFB', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#9CA3AF', fontWeight: 600 }}>
                                    {sg.logic}
                                  </div>
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
                        {(audienceRules.length + groupIndex) === 0 ? (
                          <Select value={audienceLogic} onValueChange={(logic) => setAudienceLogic(logic as 'AND' | 'OR')}>
                            <SelectTrigger className={SELECT_TRIGGER_CLASS} style={{ ...SELECT_TRIGGER_STYLE, width: '100%' }}><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="AND">AND</SelectItem><SelectItem value="OR">OR</SelectItem></SelectContent>
                          </Select>
                        ) : (
                          <div style={{ width: '100%', height: 36, borderRadius: 9999, border: '1px solid #E5E7EB', background: '#F9FAFB', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#9CA3AF', fontWeight: 600 }}>
                            {audienceLogic}
                          </div>
                        )}
                      </div>
                    )}
                    </React.Fragment>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3" style={{ marginTop: 10 }}>
                <button onClick={() => {
                  setIsDirty(true);
                  setAudienceRules(prev => [...prev, createAudienceRule()]);
                }} className="h-8 rounded-md border bg-white px-3 transition-colors" style={{ borderColor: '#E5E7EB', color: '#374151', fontSize: 12, fontWeight: 500 }}>
                  Add Filter Rule
                </button>
                <button onClick={() => {
                  setIsDirty(true);
                  setAudienceGroups(prev => [...prev, createAudienceGroup(getNextGroupName(prev))]);
                }} className="h-8 rounded-md border bg-white px-3 transition-colors" style={{ borderColor: '#E5E7EB', color: '#374151', fontSize: 12, fontWeight: 500 }}>
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
                onChange={e => {
                  setIsDirty(true);
                  const next = Number(e.target.value);
                  const clamped = Math.max(0, Math.min(100, Number.isNaN(next) ? 0 : next));
                  setRolloutTraffic(clamped);
                }}
                style={{ width: 72, height: 32, borderRadius: 8, border: `1px solid ${(showStep2Errors && step2Errors.rollout) ? '#EF4444' : '#E5E7EB'}`, padding: '0 8px', fontSize: 12 }}
              />
              <span style={{ fontSize: 12, color: '#6B7280' }}>%</span>
            </div>
            {rolloutTraffic === 0 && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#F59E0B' }}>Rollout must be greater than 0% to go live.</p>}
            {showStep2Errors && step2Errors.rollout && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#EF4444' }}>{step2Errors.rollout}</p>}

            <div style={{ marginTop: 12, marginLeft: 12, paddingLeft: 12, borderLeft: '2px solid #E5E7EB' }}>
              <h2 style={{ margin: '0 0 4px', fontSize: 14, color: '#111827', fontWeight: 700 }}>A/B Testing Variants</h2>
              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>Override parameter values per variant within rollout traffic.</p>
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
                        onChange={e => {
                          setIsDirty(true);
                          setVariants(prev => prev.map(v => v.id === variant.id ? { ...v, name: e.target.value } : v));
                        }}
                        placeholder={getVariantDefaultName(idx)}
                        style={{
                          height: 32,
                          minWidth: 180,
                          padding: '0 10px',
                          borderRadius: 8,
                          border: `1px solid ${((showStep2Errors && step2Errors.variantNames) || variantNameErrors[variant.id]) ? '#EF4444' : '#E5E7EB'}`,
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#111827',
                          background: '#FFFFFF',
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
                        {variant.role === 'control' ? 'CONTROL GROUP' : 'VARIANT'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>Traffic %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={variant.traffic}
                        onBlur={() => setTrafficTouched(true)}
                        onChange={e => {
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
                          onClick={() => removeVariant(variant.id)}
                          className="rounded-lg flex items-center justify-center"
                          style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF'; }}
                          aria-label={`Delete ${variant.name}`}
                        >
                          <Trash2 size={13} />
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
                          {p.dataType === 'JSON' ? (
                            <VariantJsonOverrideEditor
                              disabled={idx === 0}
                              invalid={showStep2Errors && Boolean(step2Errors[`value_${p.id}` as any])}
                              baseValue={String(p.value ?? '')}
                              overrideValue={variant.overrides[p.id] == null ? null : String(variant.overrides[p.id])}
                              onChange={(nextVal) => {
                                if (idx === 0) return;
                                setIsDirty(true);
                                setVariants(prev => prev.map(v => v.id === variant.id ? { ...v, overrides: { ...v.overrides, [p.id]: nextVal } } : v));
                              }}
                            />
                          ) : (
                            <ValueEditor
                              disabled={idx === 0}
                              param={{ ...p, value: variant.overrides[p.id] ?? p.value }}
                              onChange={(nextVal) => {
                                if (idx === 0) return;
                                setIsDirty(true);
                                setVariants(prev => prev.map(v => v.id === variant.id ? { ...v, overrides: { ...v.overrides, [p.id]: nextVal } } : v));
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ))}
              <button
                onClick={addVariant}
                disabled={variants.length >= MAX_VARIANTS}
                className="inline-flex items-center gap-1.5 px-3 rounded-lg"
                style={{
                  height: 36,
                  fontSize: 12,
                  color: '#2563EB',
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  cursor: variants.length >= MAX_VARIANTS ? 'not-allowed' : 'pointer',
                  opacity: variants.length >= MAX_VARIANTS ? 0.55 : 1,
                }}
              >
                <Plus size={12} />
                {variants.length >= MAX_VARIANTS ? 'Max 8 Variants' : 'Add Variant'}
              </button>
              {(showStep2Errors || trafficTouched) && step2Errors.traffic && (
                <p style={{ margin: '8px 0 0', fontSize: 11, color: '#EF4444' }}>{step2Errors.traffic}</p>
              )}
            </div>

            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #F3F4F6' }}>
              <h2 style={{ margin: '0 0 4px', fontSize: 14, color: '#111827', fontWeight: 700 }}>Conversion Goal</h2>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6B7280' }}>
                Define which user actions count as a conversion.
              </p>
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '260px 220px 28px', gap: 12, fontSize: 11, color: '#6B7280', fontWeight: 700, padding: '0 0 6px' }}>
                  <span>Event *</span>
                  <span>Attribute (optional)</span>
                  <span />
                </div>
                {conversionGoalRows.map((goalRow, goalIndex) => {
                  const availableEventAttributes = EVENT_ATTRIBUTES[goalRow.event] || [];
                  const searchTerm = goalEventSearch[goalRow.id] || '';
                  const filteredEvents = CONVERSION_EVENTS.filter(eventName => eventName.toLowerCase().includes(searchTerm.toLowerCase()));
                  return (
                    <div key={goalRow.id} style={{ borderTop: goalIndex === 0 ? '1px solid #F3F4F6' : 'none', borderBottom: '1px solid #F3F4F6', padding: '8px 0' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '260px 220px 28px', gap: 12, alignItems: 'center' }}>
                        <Select
                          value={goalRow.event}
                          onValueChange={(nextEvent) => {
                            updateConversionGoalRow(goalRow.id, { event: nextEvent, attribute: '' });
                            setGoalEventSearch(prev => ({ ...prev, [goalRow.id]: '' }));
                          }}
                        >
                          <SelectTrigger
                            aria-label={`Conversion goal event selector ${goalIndex + 1}`}
                            className={SELECT_TRIGGER_CLASS}
                            style={{ ...SELECT_TRIGGER_STYLE, width: 260, borderColor: (showStep2Errors && step2Errors.conversionGoal && !goalRow.event.trim()) ? '#EF4444' : '#E5E7EB' }}
                          >
                            <SelectValue placeholder="Select event" />
                          </SelectTrigger>
                          <SelectContent>
                            <div style={{ padding: 8 }}>
                              <input
                                value={searchTerm}
                                onChange={(e) => setGoalEventSearch(prev => ({ ...prev, [goalRow.id]: e.target.value }))}
                                placeholder="Search event"
                                style={{ width: '100%', height: 32, borderRadius: 8, border: '1px solid #E5E7EB', padding: '0 10px', fontSize: 12, color: '#111827', outline: 'none' }}
                              />
                            </div>
                            {filteredEvents.map(eventName => <SelectItem key={`${goalRow.id}_${eventName}`} value={eventName}>{eventName}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select
                          value={goalRow.attribute}
                          onValueChange={(nextAttribute) => {
                            updateConversionGoalRow(goalRow.id, { attribute: nextAttribute });
                          }}
                          disabled={!goalRow.event.trim()}
                        >
                          <SelectTrigger
                            aria-label={`Conversion goal attribute selector ${goalIndex + 1}`}
                            className={SELECT_TRIGGER_CLASS}
                            style={{ ...SELECT_TRIGGER_STYLE, width: 220, background: goalRow.event.trim() ? '#FFFFFF' : '#F9FAFB' }}
                          >
                            <SelectValue placeholder="Attribute" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableEventAttributes.map(attribute => <SelectItem key={`${goalRow.id}_${attribute}`} value={attribute}>{attribute}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {conversionGoalRows.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeConversionGoalRow(goalRow.id)}
                            className="rounded-lg flex items-center justify-center"
                            style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF'; }}
                            aria-label={`Delete conversion goal ${goalIndex + 1}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : (
                          <span />
                        )}
                      </div>
                      {goalIndex === 0 && showStep2Errors && step2Errors.conversionGoal && (
                        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#EF4444' }}>{step2Errors.conversionGoal}</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={addConversionGoalRow}
                className="inline-flex items-center gap-1.5 px-3 rounded-lg"
                style={{ height: 34, fontSize: 12, color: '#2563EB', background: '#EFF6FF', border: '1px solid #BFDBFE', cursor: 'pointer' }}
              >
                <Plus size={12} />
                Add Event Goal
              </button>
              {(showStep2Errors || trafficTouched) && step2Errors.conversionGoalDuplicate && (
                <p style={{ margin: '8px 0 0', fontSize: 11, color: '#EF4444' }}>{step2Errors.conversionGoalDuplicate}</p>
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
                {(v.name || getVariantDefaultName(i)).trim() || getVariantDefaultName(i)} - {v.traffic}% ({Math.round(audienceUsers * (rolloutTraffic / 100) * (v.traffic / 100)).toLocaleString('en-US')} users)
              </div>
            ))}
            <div style={{ fontSize: 12, color: '#111827', fontWeight: 600, marginTop: 10, marginBottom: 4 }}>Conversion Goals:</div>
            {conversionGoalRows.some(goal => goal.event.trim()) ? (
              conversionGoalRows
                .filter(goal => goal.event.trim())
                .map((goal, index) => (
                  <p key={goal.id} style={{ margin: index === conversionGoalRows.length - 1 ? '0' : '0 0 2px', fontSize: 12, color: '#6B7280' }}>
                    {goal.event}
                    {goal.attribute.trim() ? ` (${goal.attribute})` : ''}
                  </p>
                ))
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>Not selected</p>
            )}
          </div>
        </div>
      )}

      <div className="p-3 flex items-center justify-between" style={{ position: 'fixed', left: 350, right: 0, bottom: 0, zIndex: 20, background: '#FFFFFF', borderTop: '1px solid #E5E7EB', borderLeft: '1px solid #E5E7EB', paddingLeft: 24, paddingRight: 24 }}>
        <button
          onClick={() => navigate('/remote_configuration')}
          className="px-4 rounded-lg"
          style={{ height: 40, fontSize: 13, fontWeight: 600, color: '#374151', background: '#FFFFFF', border: '1px solid #E5E7EB', cursor: 'pointer' }}
        >
          Back
        </button>
        <div className="flex items-center gap-2">
          <button onClick={onSaveDraft} className="px-4 rounded-lg" style={{ height: 40, fontSize: 13, fontWeight: 600, color: '#2563EB', background: '#EFF6FF', border: '1px solid #BFDBFE', cursor: 'pointer' }}>
            Save Draft
          </button>
          {step === 1 ? (
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <span>
                  <button
                    onClick={goStep2}
                    className="inline-flex items-center gap-2 px-5 rounded-lg"
                    style={{ height: 40, fontSize: 13, fontWeight: 700, color: '#FFFFFF', background: '#2563EB', border: 'none', cursor: 'pointer' }}
                  >
                    Next <ArrowRight size={14} />
                  </button>
                </span>
              </TooltipTrigger>
              {!isStep1Valid && (
                <TooltipContent side="top" sideOffset={8} style={{ background: '#111827', color: '#FFFFFF', padding: 12, borderRadius: 6 }}>
                  Add at least one valid parameter to continue.
                </TooltipContent>
              )}
            </Tooltip>
          ) : (
            <button
              onClick={startConfiguration}
              className="inline-flex items-center gap-2 px-5 rounded-lg"
              style={{ height: 40, fontSize: 13, fontWeight: 700, color: '#FFFFFF', background: '#2864eb', border: 'none', cursor: 'pointer' }}
            >
              Start Configuration
            </button>
          )}
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
                  completeStartConfiguration();
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

      {conflictModal && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 260, background: 'rgba(17,24,39,0.46)' }}>
          <div
            className="rounded-xl"
            style={{ width: 960, maxWidth: '94vw', background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 20px 48px rgba(17,24,39,0.22)', padding: '22px 28px 18px' }}
          >
            <div className="flex items-start justify-between" style={{ marginBottom: 24 }}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} color="#F59E0B" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Parameter Key Conflict Detected</h3>
              </div>
              <button
                type="button"
                onClick={() => { setConflictModal(null); }}
                aria-label="Close conflict warning"
                style={{ border: 'none', background: 'transparent', color: '#6B7280', cursor: 'pointer', width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.55 }}>
                This parameter key is already used in <strong style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}>{conflictModal.configName}</strong> (currently <strong style={{ color: '#2563EB' }}>LIVE</strong>).
              </p>
              <p style={{ margin: '10px 0 0', fontSize: 13, color: '#374151', lineHeight: 1.55 }}>
                Duplicate keys may cause inconsistent behavior on the client side. Please choose how to proceed:
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  stopConfig(conflictModal.configId);
                  setConflictSuccessToast(`Stopped Live Configuration: ${conflictModal.configName}`);
                  setTimeout(() => setConflictSuccessToast(null), 2600);
                  setConflictModal(null);
                  setShowStep2Errors(false);
                  setStep(2);
                }}
                className="px-4 rounded-lg"
                style={{ height: 40, fontSize: 13, fontWeight: 700, color: '#111827', background: '#F9FAFB', border: '1px solid #E5E7EB', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.7)', cursor: 'pointer' }}
              >
                {`Pause Live Configuration: ${conflictModal.configName}`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowErrors(true);
                  setConflictParamErrors(Object.fromEntries(conflictModal.paramIds.map(id => [id, `Parameter key is already used by LIVE config "${conflictModal.configName}"`])));
                  setConflictModal(null);
                }}
                className="px-6 rounded-lg"
                style={{ height: 40, fontSize: 13, fontWeight: 700, color: '#FFFFFF', background: '#2563EB', border: '1px solid #1D4ED8', cursor: 'pointer' }}
              >
                Use a Different Key
              </button>
            </div>
          </div>
        </div>
      )}

      {conflictSuccessToast && (
        <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 280 }}>
          <div
            className="rounded-lg"
            style={{
              background: '#111827',
              color: '#FFFFFF',
              border: '1px solid #1F2937',
              boxShadow: '0 12px 28px rgba(17,24,39,0.35)',
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {conflictSuccessToast}
          </div>
        </div>
      )}
    </div>
  );
}

function JsonPreviewPanel({
  showDeveloperView,
  setShowDeveloperView,
  copyOk,
  setCopyOk,
  jsonPreview,
  lines,
  jsonFlash,
}: {
  showDeveloperView: boolean;
  setShowDeveloperView: (v: boolean) => void;
  copyOk: boolean;
  setCopyOk: (v: boolean) => void;
  jsonPreview: string;
  lines: string[];
  jsonFlash: boolean;
}) {
  return (
    <div className="sticky self-start" style={{ top: 16 }}>
      {showDeveloperView && (
        <div className="rounded-xl p-3" style={{ background: '#0F172A', border: '1px solid #1F2937', maxHeight: 'calc(100vh - 120px)', overflow: 'auto' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#F9FAFB' }}>JSON Output</h3>
              <span className="px-2 py-0.5 rounded" style={{ fontSize: 10, color: '#CBD5E1', background: '#1E293B', fontWeight: 600 }}>READ-ONLY</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDeveloperView(false)}
                className="inline-flex items-center px-2 rounded"
                style={{ height: 28, fontSize: 11, color: '#CBD5E1', background: '#1E293B', border: '1px solid #334155', cursor: 'pointer' }}
              >
                Hide
              </button>
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
      {!showDeveloperView && (
        <button onClick={() => setShowDeveloperView(true)} className="px-3 rounded-lg" style={{ height: 36, fontSize: 12, fontWeight: 600, color: '#374151', background: '#FFFFFF', border: '1px solid #E5E7EB', cursor: 'pointer' }}>
          Show Developer View
        </button>
      )}
    </div>
  );
}

function ValueEditor({
  param,
  invalid,
  disabled,
  onChange,
}: {
  param: Parameter;
  invalid?: boolean;
  disabled?: boolean;
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
    return (
      <Select value={param.value || 'false'} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          className={SELECT_TRIGGER_CLASS}
          style={{ ...SELECT_TRIGGER_STYLE, height: 48, minHeight: 48, width: '100%' }}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">true</SelectItem>
          <SelectItem value="false">false</SelectItem>
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

function VariantJsonOverrideEditor({
  baseValue,
  overrideValue,
  disabled,
  invalid,
  onChange,
}: {
  baseValue: string;
  overrideValue?: string | null;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (next: string) => void;
}) {
  const baseInput: React.CSSProperties = {
    width: '100%',
    height: 40,
    minHeight: 40,
    padding: '8px 10px',
    fontSize: 13,
    color: '#111827',
    border: `1px solid ${invalid ? '#EF4444' : '#E5E7EB'}`,
    borderRadius: 8,
    outline: 'none',
    boxSizing: 'border-box',
    background: disabled ? '#F9FAFB' : '#FFFFFF',
    fontFamily: 'Inter, sans-serif',
  };

  let baseParsed: any = null;
  try { baseParsed = JSON.parse(baseValue || '{}'); } catch { baseParsed = null; }
  const baseIsPlainObject = baseParsed && typeof baseParsed === 'object' && !Array.isArray(baseParsed);

  let overrideParsed: any = null;
  const overrideRaw = (overrideValue ?? '').trim();
  if (overrideRaw) {
    try { overrideParsed = JSON.parse(overrideRaw); } catch { overrideParsed = null; }
  }
  const overrideIsPlainObject = overrideParsed && typeof overrideParsed === 'object' && !Array.isArray(overrideParsed);

  if (!baseIsPlainObject) {
    return (
      <textarea
        value={overrideRaw || baseValue}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        rows={4}
        style={{ ...baseInput, height: 'auto', minHeight: 48, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', resize: 'vertical' }}
      />
    );
  }

  const keys = Object.keys(baseParsed);
  const currentObj: Record<string, any> = {
    ...baseParsed,
    ...(overrideIsPlainObject ? overrideParsed : {}),
  };
  const updateKey = (k: string, next: any) => {
    const nextObj = { ...currentObj, [k]: next };
    onChange(JSON.stringify(nextObj, null, 2));
  };

  return (
    <div className="rounded-xl" style={{ border: `1px solid ${invalid ? '#EF4444' : '#E5E7EB'}`, background: disabled ? '#F9FAFB' : '#FFFFFF', padding: 10 }}>
      <div className="flex flex-col gap-2">
        {keys.length === 0 && (
          <div style={{ fontSize: 12, color: '#6B7280', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
            {'{ }'}
          </div>
        )}
        {keys.map((k) => {
          const baseV = baseParsed[k];
          const v = Object.prototype.hasOwnProperty.call(currentObj, k) ? currentObj[k] : baseV;
          const t = typeof baseV;
          return (
            <div key={k} className="flex items-center gap-2">
              <div
                className="px-2 py-1 rounded-lg"
                style={{
                  background: '#F3F4F6',
                  border: '1px solid #E5E7EB',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: 12,
                  color: '#111827',
                  minWidth: 140,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={k}
              >
                {k}
              </div>

              {t === 'boolean' ? (
                <Select value={v ? 'true' : 'false'} onValueChange={(val) => updateKey(k, val === 'true')} disabled={disabled}>
                  <SelectTrigger className={SELECT_TRIGGER_CLASS} style={{ ...SELECT_TRIGGER_STYLE, height: 40, minHeight: 40, width: 140 }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">true</SelectItem>
                    <SelectItem value="false">false</SelectItem>
                  </SelectContent>
                </Select>
              ) : t === 'number' ? (
                <input
                  type="number"
                  value={Number.isFinite(v) ? String(v) : ''}
                  disabled={disabled}
                  onChange={(e) => updateKey(k, e.target.value === '' ? 0 : Number(e.target.value))}
                  style={baseInput}
                />
              ) : (
                <input
                  type="text"
                  value={v == null ? '' : String(v)}
                  disabled={disabled}
                  onChange={(e) => updateKey(k, e.target.value)}
                  style={baseInput}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
