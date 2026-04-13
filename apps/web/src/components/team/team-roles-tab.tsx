'use client';

import { useState, useMemo } from 'react';
import { api } from '@convex/_generated/api';
import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Shield } from 'lucide-react';
import { toast } from 'sonner';

import {
  PermissionMatrix,
  type PermissionEntry,
} from './permission-matrix';
import {
  FEATURES,
  FEATURE_ACTIONS,
  buildDefaultEntries,
} from '@/lib/permission-constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TemplateEntry {
  _id: string;
  feature: string;
  action: string;
  allowed: boolean;
}

interface Template {
  _id: string;
  _creationTime: number;
  name: string;
  description: string | null;
  color: string | null;
  isDefault: boolean;
  ownerId: string;
  entries: TemplateEntry[];
}

interface TeamRolesTabProps {
  canManage: boolean;
}

// ---------------------------------------------------------------------------
// Preset colors
// ---------------------------------------------------------------------------

const PRESET_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#78716c', // stone
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TeamRolesTab({ canManage }: TeamRolesTabProps) {
  const { data: templatesData, isLoading } = useAuthQuery(
    api.permissionTemplates.list,
    {},
  );
  const templates = templatesData as Template[] | undefined;

  const createTemplate = useAuthMutation(api.permissionTemplates.create);
  const updateTemplate = useAuthMutation(api.permissionTemplates.update);
  const deleteTemplate = useAuthMutation(api.permissionTemplates.deleteTemplate);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const selected = useMemo(
    () => templates?.find((t) => t._id === selectedId) ?? null,
    [templates, selectedId],
  );

  // Auto-select first template
  if (templates && templates.length > 0 && !selectedId) {
    setSelectedId(templates[0]._id);
  }

  const templatesList = templates ?? [];

  // ----- Create dialog state -----
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [cloneFromId, setCloneFromId] = useState<string>('');
  const [newEntries, setNewEntries] = useState<PermissionEntry[]>([]);

  const handleCreateOpen = (open: boolean) => {
    if (open) {
      setNewName('');
      setNewDesc('');
      setNewColor(PRESET_COLORS[0]);
      setCloneFromId('');
      setNewEntries(buildDefaultEntries(false));
    }
    setCreateOpen(open);
  };

  const handleCloneSelect = (id: string) => {
    setCloneFromId(id);
    if (id === '__blank__') {
      setNewEntries(buildDefaultEntries(false));
    } else {
      const source = templatesList?.find((t) => t._id === id);
      if (source) {
        setNewEntries(
          source.entries.map((e) => ({
            feature: e.feature,
            action: e.action,
            allowed: e.allowed,
          })),
        );
      }
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error('Role name is required');
      return;
    }
    try {
      await createTemplate.mutateAsync({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        color: newColor,
        entries: newEntries.map((e) => ({
          feature: e.feature,
          action: e.action,
          allowed: e.allowed,
        })),
      });
      toast.success('Role created');
      setCreateOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to create role');
    }
  };

  // ----- Edit dialog state -----
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editEntries, setEditEntries] = useState<PermissionEntry[]>([]);

  const handleEditOpen = (open: boolean) => {
    if (open && selected) {
      setEditName(selected.name);
      setEditDesc(selected.description ?? '');
      setEditColor(selected.color ?? PRESET_COLORS[0]);
      setEditEntries(
        selected.entries.map((e) => ({
          feature: e.feature,
          action: e.action,
          allowed: e.allowed,
        })),
      );
    }
    setEditOpen(open);
  };

  const handleEdit = async () => {
    if (!selected) return;
    if (!editName.trim()) {
      toast.error('Role name is required');
      return;
    }
    try {
      await updateTemplate.mutateAsync({
        templateId: selected._id as any,
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        color: editColor,
        entries: editEntries.map((e) => ({
          feature: e.feature,
          action: e.action,
          allowed: e.allowed,
        })),
      });
      toast.success('Role updated');
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update role');
    }
  };

  // ----- Delete -----
  const handleDelete = async () => {
    if (!selected) return;
    try {
      await deleteTemplate.mutateAsync({ templateId: selected._id as any });
      toast.success('Role deleted');
      setDeleteOpen(false);
      setSelectedId(null);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to delete role');
    }
  };

  // ----- Loading -----
  if (isLoading || !templates) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Template badge rail */}
      <div className="flex flex-wrap items-center gap-2">
        {templatesList.map((t) => {
          const isSelected = selectedId === t._id;
          return (
            <button
              key={t._id}
              onClick={() => setSelectedId(t._id)}
              className={`
                inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors
                ${isSelected
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border hover:border-primary/50 text-foreground'
                }
              `}
            >
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: t.color ?? '#6366f1' }}
              />
              {t.name}
              {t.isDefault && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">
                  Default
                </Badge>
              )}
            </button>
          );
        })}

        {canManage && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => handleCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Role
          </Button>
        )}
      </div>

      {/* Selected template detail */}
      {selected ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: selected.color ?? '#6366f1' }}
                />
                <CardTitle className="text-lg">{selected.name}</CardTitle>
                {selected.isDefault && (
                  <Badge variant="secondary" className="text-[10px]">
                    System Role
                  </Badge>
                )}
              </div>
              {canManage && !selected.isDefault && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditOpen(true)}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
            {selected.description && (
              <p className="text-sm text-muted-foreground">
                {selected.description}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <PermissionMatrix
              entries={selected.entries.map((e) => ({
                feature: e.feature,
                action: e.action,
                allowed: e.allowed,
              }))}
              readOnly
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Shield className="h-10 w-10 mb-2" />
            <p className="text-sm">Select a role to view its permissions</p>
          </CardContent>
        </Card>
      )}

      {/* ===== Create Role Dialog ===== */}
      <Dialog open={createOpen} onOpenChange={handleCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>
              Define a custom permission template for team members.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="role-name">Name *</Label>
              <Input
                id="role-name"
                placeholder="e.g. Sales Manager"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="role-desc">Description</Label>
              <Textarea
                id="role-desc"
                placeholder="What this role can do..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={2}
              />
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${
                      newColor === c
                        ? 'border-foreground scale-110'
                        : 'border-transparent hover:border-muted-foreground/40'
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewColor(c)}
                  />
                ))}
              </div>
            </div>

            {/* Clone from */}
            {templatesList.length > 0 && (
              <div className="space-y-1.5">
                <Label>Clone permissions from</Label>
                <Select value={cloneFromId} onValueChange={handleCloneSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Blank (no permissions)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__blank__">Blank (no permissions)</SelectItem>
                    {templatesList.map((t) => (
                      <SelectItem key={t._id} value={t._id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Permission matrix */}
            <div className="space-y-1.5">
              <Label>Permissions</Label>
              <PermissionMatrix
                entries={newEntries}
                onChange={setNewEntries}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Edit Role Dialog ===== */}
      <Dialog open={editOpen} onOpenChange={handleEditOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Update role name, description, color, and permissions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea
                id="edit-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${
                      editColor === c
                        ? 'border-foreground scale-110'
                        : 'border-transparent hover:border-muted-foreground/40'
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setEditColor(c)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Permissions</Label>
              <PermissionMatrix
                entries={editEntries}
                onChange={setEditEntries}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Delete Confirm Dialog ===== */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              Members using this role will be reassigned to the default{' '}
              <strong>Member</strong> role. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
