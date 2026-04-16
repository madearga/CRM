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
  customDomain?: string;
  settings?: any;
}
