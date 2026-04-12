'use client';

import { useState } from 'react';
import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FolderTree, Plus, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CategoryNode {
  id: string;
  name: string;
  description?: string;
  active?: boolean;
  parentId?: string;
  children: CategoryNode[];
}

export default function CategoriesPage() {
  const { data: tree, isLoading } = useAuthQuery(api.productCategories.tree, {});
  const { data: flatList } = useAuthQuery(api.productCategories.list, {});

  const treeData = tree ?? [];
  const flatData = flatList ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryNode | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    parentId: '' as string | undefined,
  });

  const createCategory = useAuthMutation(api.productCategories.create);
  const updateCategory = useAuthMutation(api.productCategories.update);
  const deleteCategory = useAuthMutation(api.productCategories.remove);

  const resetForm = () => {
    setForm({ name: '', description: '', parentId: undefined });
    setEditingCategory(null);
  };

  const openNewDialog = (parentId?: string) => {
    resetForm();
    setForm((prev) => ({ ...prev, parentId }));
    setDialogOpen(true);
  };

  const openEditDialog = (cat: CategoryNode) => {
    setEditingCategory(cat);
    setForm({
      name: cat.name,
      description: cat.description ?? '',
      parentId: cat.parentId,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    try {
      if (editingCategory) {
        await updateCategory.mutateAsync({
          id: editingCategory.id as any,
          name: form.name.trim(),
          description: form.description || undefined,
          parentId: (form.parentId || undefined) as any,
        });
        toast.success('Category updated');
      } else {
        await createCategory.mutateAsync({
          name: form.name.trim(),
          description: form.description || undefined,
          parentId: (form.parentId || undefined) as any,
        });
        toast.success('Category created');
      }
      setDialogOpen(false);
      resetForm();
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to save category');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory.mutateAsync({ id: id as any });
      toast.success('Category deleted');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to delete');
    }
  };

  const isPending = createCategory.isPending || updateCategory.isPending;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 w-full animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderTree className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Product Categories</h2>
        </div>
        <Button size="sm" onClick={() => openNewDialog()}>
          <Plus className="mr-1 h-4 w-4" />Add Category
        </Button>
      </div>

      {/* Tree */}
      {(!tree || tree.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FolderTree className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-3 text-sm">No categories yet. Create your first product category.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => openNewDialog()}>
            <Plus className="mr-1 h-4 w-4" />Add Category
          </Button>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {treeData.map((node) => (
              <CategoryTreeItem
                key={node.id}
                node={node}
                depth={0}
                onEdit={openEditDialog}
                onDelete={handleDelete}
                onAddChild={openNewDialog}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'New Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name *</label>
              <Input
                placeholder="e.g. Electronics"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                placeholder="Optional description"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Parent Category</label>
              <Select
                value={form.parentId ?? '__root__'}
                onValueChange={(v) => setForm((prev) => ({ ...prev, parentId: v === '__root__' ? undefined : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Root level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__root__">Root level (no parent)</SelectItem>
                  {(flatList ?? [])
                    .filter((c: any) => c.id !== editingCategory?.id)
                    .map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.parentId ? `  ↳ ${c.name}` : c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? 'Saving...' : editingCategory ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryTreeItem({
  node,
  depth,
  onEdit,
  onDelete,
  onAddChild,
}: {
  node: CategoryNode;
  depth: number;
  onEdit: (node: CategoryNode) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 border-b px-4 py-3 hover:bg-muted/50',
          depth > 0 && 'bg-muted/20',
        )}
        style={{ paddingLeft: `${depth * 24 + 16}px` }}
      >
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="flex-shrink-0">
            <ChevronRight className={cn('h-4 w-4 transition-transform', expanded && 'rotate-90')} />
          </button>
        ) : (
          <div className="w-4 flex-shrink-0" />
        )}

        <span className="flex-1 font-medium text-sm">{node.name}</span>
        {node.description && (
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{node.description}</span>
        )}
        {depth < 2 && (
          <Button variant="ghost" size="sm" className="h-7" onClick={() => onAddChild(node.id)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-7" onClick={() => onEdit(node)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => onDelete(node.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {expanded && hasChildren && (node.children ?? []).map((child) => (
        <CategoryTreeItem
          key={child.id}
          node={child}
          depth={depth + 1}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddChild={onAddChild}
        />
      ))}
    </div>
  );
}
