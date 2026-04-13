'use client';

import { FEATURES, FEATURE_ACTIONS } from '@/lib/permission-constants';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface PermissionEntry {
  feature: string;
  action: string;
  allowed: boolean;
}

interface PermissionMatrixProps {
  entries: PermissionEntry[];
  onChange?: (entries: PermissionEntry[]) => void;
  readOnly?: boolean;
}

// Collect unique action columns across all features, in display order
const ALL_ACTIONS = ['view', 'create', 'edit', 'delete', 'manage', 'invite', 'remove', 'manage_roles'] as const;

const ACTION_LABELS: Record<string, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  manage: 'Manage',
  invite: 'Invite',
  remove: 'Remove',
  manage_roles: 'Roles',
};

const FEATURE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  contacts: 'Contacts',
  companies: 'Companies',
  deals: 'Deals',
  products: 'Products',
  sales: 'Sales',
  invoices: 'Invoices',
  subscriptions: 'Subscriptions',
  templates: 'Templates',
  team: 'Team',
  settings: 'Settings',
  activities: 'Activities',
};

export function PermissionMatrix({ entries, onChange, readOnly = false }: PermissionMatrixProps) {
  // Build a lookup map for quick access
  const entryMap = new Map<string, boolean>();
  for (const e of entries) {
    entryMap.set(`${e.feature}::${e.action}`, e.allowed);
  }

  const toggle = (feature: string, action: string) => {
    if (!onChange) return;
    const key = `${feature}::${action}`;
    const current = entryMap.get(key) ?? false;
    const updated = entries.map((e) => ({ ...e }));
    const existing = updated.find((e) => e.feature === feature && e.action === action);
    if (existing) {
      existing.allowed = !current;
    } else {
      updated.push({ feature, action, allowed: true });
    }
    onChange(updated);
  };

  return (
    <div className="overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[120px] sticky left-0 bg-background z-10">
              Feature
            </TableHead>
            {ALL_ACTIONS.map((action) => (
              <TableHead key={action} className="text-center min-w-[60px]">
                {ACTION_LABELS[action] ?? action}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {FEATURES.map((feature) => {
            const validActions = new Set(FEATURE_ACTIONS[feature]);
            return (
              <TableRow key={feature}>
                <TableCell className="font-medium sticky left-0 bg-background z-10">
                  {FEATURE_LABELS[feature] ?? feature}
                </TableCell>
                {ALL_ACTIONS.map((action) => {
                  const isRelevant = validActions.has(action);
                  const checked = entryMap.get(`${feature}::${action}`) ?? false;
                  return (
                    <TableCell key={`${feature}-${action}`} className="text-center">
                      {isRelevant ? (
                        <div className="flex justify-center">
                          <Checkbox
                            checked={checked}
                            disabled={readOnly}
                            onCheckedChange={() => toggle(feature, action)}
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
