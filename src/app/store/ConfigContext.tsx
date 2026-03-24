import React, { createContext, useContext, useState, useCallback } from 'react';
import { RemoteConfig, Status, ConfigType, Parameter, ParameterType } from '../types';
import { initialConfigs } from '../mockData';

interface ConfigContextType {
  configs: RemoteConfig[];
  addConfig: (config: Omit<RemoteConfig, 'id' | 'versionHistory' | 'version' | 'versionMajor' | 'versionMinor' | 'lastEdited' | 'createdAt'>) => RemoteConfig;
  updateConfig: (id: string, updates: Partial<RemoteConfig>) => void;
  deleteConfig: (id: string) => void;
  duplicateConfig: (id: string) => RemoteConfig;
  startConfig: (id: string) => void;
  stopConfig: (id: string) => void;
  completeConfig: (id: string) => void;
  stopAndCreateNewVersion: (id: string) => RemoteConfig;
  getConfigById: (id: string) => RemoteConfig | undefined;
}

const ConfigContext = createContext<ConfigContextType | null>(null);

function toParameterType(type: ConfigType): ParameterType {
  if (type === 'Boolean') return 'BOOLEAN';
  if (type === 'String') return 'STRING';
  if (type === 'Integer') return 'INTEGER';
  return 'JSON';
}

function toConfigType(type: ParameterType): ConfigType {
  if (type === 'BOOLEAN') return 'Boolean';
  if (type === 'STRING') return 'String';
  if (type === 'INTEGER') return 'Integer';
  return 'JSON';
}

function normalizeParameterValue(type: ParameterType, value: unknown): Parameter['value'] {
  if (type === 'BOOLEAN') {
    if (typeof value === 'boolean') return value;
    return value === 'true';
  }
  if (type === 'INTEGER') {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(n) ? 0 : n;
  }
  if (type === 'JSON') {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      } catch {
        return {};
      }
    }
    return {};
  }
  return typeof value === 'string' ? value : `${value ?? ''}`;
}

function normalizeConfig(config: RemoteConfig): RemoteConfig {
  const normalizeGoal = (goal: RemoteConfig['conversionGoal'] | any) => {
    const event = `${goal?.event || goal?.eventName || ''}`.trim();
    if (!event) return null;
    const attribute = `${goal?.attribute || ''}`.trim();
    return { event, attribute: attribute || undefined };
  };
  const configKey = config.configKey || config.key || '';
  const sourceKeys = config.keys && config.keys.length > 0 ? config.keys : undefined;
  const parameters: Parameter[] = (config.parameters && config.parameters.length > 0)
    ? config.parameters.map(p => ({ ...p, value: normalizeParameterValue(p.type, p.value) }))
    : (sourceKeys || []).map(k => {
      const type = toParameterType(k.dataType);
      return {
        id: k.id,
        key: k.name,
        type,
        value: normalizeParameterValue(type, k.defaultValue),
        description: '',
      };
    });

  const derivedType = parameters[0] ? toConfigType(parameters[0].type) : config.type;
  const conversionGoals = (config.conversionGoals || [])
    .map(normalizeGoal)
    .filter((goal): goal is NonNullable<typeof goal> => Boolean(goal));
  const fallbackGoal = normalizeGoal(config.conversionGoal);
  const mergedConversionGoals = conversionGoals.length > 0
    ? conversionGoals
    : (fallbackGoal ? [fallbackGoal] : []);
  const keys = (sourceKeys || parameters.map(p => {
    const mappedType = toConfigType(p.type);
    const defaultValue = p.type === 'JSON'
      ? JSON.stringify(p.value)
      : `${p.value}`;
    return {
      id: p.id,
      name: p.key,
      dataType: mappedType,
      defaultValue,
      variants: [{ id: `${p.id}_v1`, name: 'Control', role: 'control', value: defaultValue, traffic: 100, isControl: true }],
    };
  })).map(key => ({
    ...key,
    variants: (key.variants || []).map((variant, index) => ({
      ...variant,
      role: variant.role || ((variant.isControl || index === 0) ? 'control' : 'variant'),
    })),
  }));

  return {
    ...config,
    key: configKey,
    configKey,
    parameters,
    keys,
    type: derivedType,
    conversionGoals: mergedConversionGoals,
    conversionGoal: mergedConversionGoals[0],
  };
}

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [configs, setConfigs] = useState<RemoteConfig[]>(() => initialConfigs.map(normalizeConfig));

  const getConfigById = useCallback((id: string) => {
    return configs.find(c => c.id === id);
  }, [configs]);

  const addConfig = useCallback((configData: Omit<RemoteConfig, 'id' | 'versionHistory' | 'version' | 'versionMajor' | 'versionMinor' | 'lastEdited' | 'createdAt'>): RemoteConfig => {
    const now = new Date().toISOString().split('T')[0];
    const configKey = configData.configKey || configData.key || '';
    const parameters = (configData.parameters || []).map(p => ({ ...p, value: normalizeParameterValue(p.type, p.value) }));
    const generatedKeys = parameters.map(p => {
      const mappedType = toConfigType(p.type);
      const defaultValue = p.type === 'JSON' ? JSON.stringify(p.value) : `${p.value}`;
      return {
        id: p.id,
        name: p.key,
        dataType: mappedType,
        defaultValue,
        variants: [{ id: `${p.id}_v1`, name: 'Control', role: 'control', value: defaultValue, traffic: 100, isControl: true }],
      };
    });
    if (configs.some(c => c.environment === configData.environment && c.configKey === configKey)) {
      // TODO: Replace with API-backed uniqueness enforcement per workspace/environment.
      console.warn(`Duplicate configKey detected in ${configData.environment}: ${configKey}`);
    }
    const newConfig: RemoteConfig = {
      ...configData,
      key: configKey,
      configKey,
      parameters,
      keys: (configData.keys && configData.keys.length > 0) ? configData.keys : generatedKeys,
      type: parameters[0] ? toConfigType(parameters[0].type) : configData.type,
      id: `config_${Date.now()}`,
      version: 'v1.0',
      versionMajor: 1,
      versionMinor: 0,
      versionHistory: [
        { version: 'v1.0', status: 'DRAFT', date: now, author: configData.createdBy, notes: 'Initial draft created.' },
      ],
      lastEdited: 'Just now',
      createdAt: now,
    };
    setConfigs(prev => [newConfig, ...prev]);
    return newConfig;
  }, [configs]);

  const updateConfig = useCallback((id: string, updates: Partial<RemoteConfig>) => {
    setConfigs(prev => prev.map(c => {
      if (c.id !== id) return c;
      const nextConfigKey = updates.configKey || updates.key || c.configKey || c.key || '';
      const explicitKeys = updates.keys && updates.keys.length > 0 ? updates.keys : undefined;
      const nextParameters = updates.parameters
        ? updates.parameters.map(p => ({ ...p, value: normalizeParameterValue(p.type, p.value) }))
        : explicitKeys
          ? explicitKeys.map(k => {
            const type = toParameterType(k.dataType);
            return {
              id: k.id,
              key: k.name,
              type,
              description: '',
              value: normalizeParameterValue(type, k.defaultValue),
            };
          })
          : (c.parameters || []);
      const generatedKeys = nextParameters.map(p => {
        const mappedType = toConfigType(p.type);
        const defaultValue = p.type === 'JSON' ? JSON.stringify(p.value) : `${p.value}`;
        return {
          id: p.id,
          name: p.key,
          dataType: mappedType,
          defaultValue,
          variants: [{ id: `${p.id}_v1`, name: 'Control', role: 'control', value: defaultValue, traffic: 100, isControl: true }],
        };
      });
      const merged: RemoteConfig = {
        ...c,
        ...updates,
        key: nextConfigKey,
        configKey: nextConfigKey,
        parameters: nextParameters,
        keys: explicitKeys || generatedKeys,
        type: nextParameters[0] ? toConfigType(nextParameters[0].type) : c.type,
        lastEdited: 'Just now',
      };
      return normalizeConfig(merged);
    }));
  }, []);

  const deleteConfig = useCallback((id: string) => {
    setConfigs(prev => prev.filter(c => c.id !== id));
  }, []);

  const duplicateConfig = useCallback((id: string): RemoteConfig => {
    const original = configs.find(c => c.id === id);
    if (!original) throw new Error('Config not found');
    const now = new Date().toISOString().split('T')[0];
    const newConfig: RemoteConfig = {
      ...original,
      id: `config_${Date.now()}`,
      name: `Copy - ${original.name}`,
      key: `copy_${original.configKey || original.key || ''}`,
      configKey: `copy_${original.configKey || original.key || ''}`,
      status: 'DRAFT',
      version: 'v1.0',
      versionMajor: 1,
      versionMinor: 0,
      rolloutPercentage: 0,
      versionHistory: [
        { version: 'v1.0', status: 'DRAFT', date: now, author: original.createdBy, notes: `Duplicated from ${original.name} ${original.version}` },
      ],
      lastEdited: 'Just now',
      createdAt: now,
      parentId: original.id,
    };
    const normalized = normalizeConfig(newConfig);
    setConfigs(prev => [normalized, ...prev]);
    return normalized;
  }, [configs]);

  const startConfig = useCallback((id: string) => {
    setConfigs(prev => prev.map(c => {
      if (c.id === id) {
        const updatedHistory = [...c.versionHistory];
        const lastEntry = updatedHistory[updatedHistory.length - 1];
        if (lastEntry && lastEntry.version === c.version) {
          updatedHistory[updatedHistory.length - 1] = { ...lastEntry, status: 'LIVE' };
        }
        return { ...c, status: 'LIVE', versionHistory: updatedHistory, lastEdited: 'Just now' };
      }
      return c;
    }));
  }, []);

  const stopConfig = useCallback((id: string) => {
    setConfigs(prev => prev.map(c => {
      if (c.id === id) {
        const updatedHistory = [...c.versionHistory];
        const lastEntry = updatedHistory[updatedHistory.length - 1];
        if (lastEntry && lastEntry.version === c.version) {
          updatedHistory[updatedHistory.length - 1] = { ...lastEntry, status: 'STOPPED' };
        }
        return { ...c, status: 'STOPPED', versionHistory: updatedHistory, lastEdited: 'Just now' };
      }
      return c;
    }));
  }, []);

  const completeConfig = useCallback((id: string) => {
    setConfigs(prev => prev.map(c => {
      if (c.id === id) {
        const updatedHistory = [...c.versionHistory];
        const lastEntry = updatedHistory[updatedHistory.length - 1];
        if (lastEntry && lastEntry.version === c.version) {
          updatedHistory[updatedHistory.length - 1] = { ...lastEntry, status: 'COMPLETED' };
        }
        return { ...c, status: 'COMPLETED', versionHistory: updatedHistory, lastEdited: 'Just now' };
      }
      return c;
    }));
  }, []);

  const stopAndCreateNewVersion = useCallback((id: string): RemoteConfig => {
    const original = configs.find(c => c.id === id);
    if (!original) throw new Error('Config not found');
    const now = new Date().toISOString().split('T')[0];

    // Stop current version
    const newMinor = original.versionMinor + 1;
    const newVersion = `v${original.versionMajor}.${newMinor}`;

    const newConfig: RemoteConfig = {
      ...original,
      id: `config_${Date.now()}`,
      status: 'DRAFT',
      version: newVersion,
      versionMajor: original.versionMajor,
      versionMinor: newMinor,
      rolloutPercentage: 0,
      versionHistory: [
        ...original.versionHistory.map(v => v.version === original.version ? { ...v, status: 'STOPPED' as Status } : v),
        { version: newVersion, status: 'DRAFT' as Status, date: now, author: original.createdBy, notes: `New version created from ${original.version} (was LIVE).` },
      ],
      lastEdited: 'Just now',
      createdAt: now,
      parentId: original.id,
    };

    setConfigs(prev => prev.map(c => c.id === id ? { ...c, status: 'STOPPED', lastEdited: 'Just now' } : c));
    const normalized = normalizeConfig(newConfig);
    setConfigs(prev => [normalized, ...prev]);
    return normalized;
  }, [configs]);

  return (
    <ConfigContext.Provider value={{
      configs,
      addConfig,
      updateConfig,
      deleteConfig,
      duplicateConfig,
      startConfig,
      stopConfig,
      completeConfig,
      stopAndCreateNewVersion,
      getConfigById,
    }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfigs() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfigs must be used within ConfigProvider');
  return ctx;
}
