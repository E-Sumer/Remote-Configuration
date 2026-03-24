export type Status = 'DRAFT' | 'LIVE' | 'STOPPED' | 'COMPLETED';
export type ConfigType = 'Boolean' | 'String' | 'Integer' | 'JSON';
export type ParameterType = 'BOOLEAN' | 'STRING' | 'INTEGER' | 'JSON';
export type Environment = 'Prod' | 'Test';

export interface Variant {
  id: string;
  name: string;
  role?: 'control' | 'variant';
  value: string;
  traffic: number;
  isControl: boolean;
}

export interface ConfigKey {
  id: string;
  name: string;
  dataType: ConfigType;
  defaultValue: string;
  variants: Variant[];
}

export interface Parameter {
  id: string;
  key: string;
  type: ParameterType;
  description?: string;
  value: boolean | string | number | Record<string, unknown>;
}

export interface ConversionGoal {
  event: string;
  attribute?: string;
}

export interface VersionEntry {
  version: string;
  status: Status;
  date: string;
  author: string;
  notes: string;
}

export interface RemoteConfig {
  id: string;
  name: string;
  key?: string;
  configKey?: string;
  description: string;
  status: Status;
  type: ConfigType;
  version: string;
  versionMajor: number;
  versionMinor: number;
  versionHistory: VersionEntry[];
  variantsCount: number;
  rolloutPercentage: number;
  hasGradualRollout: boolean;
  targetSegment: string;
  environment: Environment;
  lastEdited: string;
  createdBy: string;
  createdAt: string;
  keys?: ConfigKey[];
  parameters?: Parameter[];
  conversionGoal?: ConversionGoal;
  conversionGoals?: ConversionGoal[];
  usedInCampaign?: boolean;
  parentId?: string;
}
