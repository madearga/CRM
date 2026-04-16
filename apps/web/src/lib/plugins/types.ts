import { type LucideIcon } from 'lucide-react';

export interface PluginSetting {
  key: string;
  label: string;
  type: 'text' | 'boolean' | 'select' | 'secret';
  default?: any;
  options?: { label: string; value: string }[];
}

export interface CRMPlugin {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  version: string;
  routePrefix: string;
  navItems: PluginNavItem[];
  settings: PluginSetting[];
}

export interface PluginNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface PluginInstance {
  id: string;
  pluginId: string;
  isActive: boolean;
  publicSlug?: string;
  settings?: any;
}

export interface ExternalPlugin {
  id: string;
  name: string;
  url: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSyncAt?: number;
  lastError?: string;
  pluginInstanceId: string;
  manifest?: {
    id?: string;
    name?: string;
    version?: string;
    tables?: string[];
    capabilities?: string[];
  };
}

export interface SyncLogEntry {
  id: string;
  direction: 'pull' | 'push';
  table: string;
  status: 'success' | 'partial' | 'failed';
  recordCount: number;
  errorMessage?: string;
  durationMs?: number;
  createdAt: number;
}
