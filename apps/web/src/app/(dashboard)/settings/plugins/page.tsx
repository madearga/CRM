'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Link as LinkIcon,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { PLUGINS } from '@/lib/plugins/registry';
import type { PluginInstance } from '@/lib/plugins/types';

export default function PluginsSettingsPage() {
  const { data: instances, isLoading } = useAuthQuery(api.plugins.list, {});
  const upsertPlugin = useAuthMutation(api.plugins.upsert);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const instanceMap = new Map<string, PluginInstance>();
  for (const inst of instances ?? []) {
    instanceMap.set(inst.pluginId, inst as PluginInstance);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Plugins</h2>
        <p className="text-muted-foreground">
          Kelola plugin dan integrasi untuk organisasi Anda.
        </p>
      </div>

      <div className="grid gap-6">
        {PLUGINS.map((plugin) => {
          const instance = instanceMap.get(plugin.id);
          return (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              instance={instance}
              upsertPlugin={upsertPlugin}
            />
          );
        })}
      </div>
    </div>
  );
}

function PluginCard({
  plugin,
  instance,
  upsertPlugin,
}: {
  plugin: (typeof PLUGINS)[number];
  instance: PluginInstance | undefined;
  upsertPlugin: ReturnType<typeof useAuthMutation<typeof api.plugins.upsert>>;
}) {
  const isActive = instance?.isActive ?? false;
  const [slug, setSlug] = useState(instance?.publicSlug ?? '');
  const [saving, setSaving] = useState(false);
  const Icon = plugin.icon;

  async function handleToggle(active: boolean) {
    setSaving(true);
    try {
      await upsertPlugin.mutateAsync({
        pluginId: plugin.id,
        isActive: active,
        publicSlug: slug || undefined,
      });
      toast.success(active ? `${plugin.name} diaktifkan` : `${plugin.name} dinonaktifkan`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal mengubah status plugin');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (slug && !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
      toast.error('Slug hanya boleh huruf kecil, angka, dan tanda hubung');
      return;
    }
    setSaving(true);
    try {
      await upsertPlugin.mutateAsync({
        pluginId: plugin.id,
        isActive,
        publicSlug: slug || undefined,
      });
      toast.success('Pengaturan disimpan');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                {plugin.name}
                <Badge variant={isActive ? 'default' : 'secondary'}>
                  {isActive ? 'Aktif' : 'Nonaktif'}
                </Badge>
              </CardTitle>
              <CardDescription>{plugin.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={isActive}
              onCheckedChange={handleToggle}
              disabled={saving}
            />
          </div>
        </div>
      </CardHeader>
      {isActive && (
        <CardContent className="space-y-4">
          <Separator />
          <div className="space-y-2 max-w-md">
            <Label className="flex items-center gap-2">
              <LinkIcon className="size-3.5" />
              Public Slug
            </Label>
            <Input
              placeholder="tokobudi"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            />
            <p className="text-xs text-muted-foreground">
              URL toko: <code>/{slug || '{slug}'}</code>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Simpan
            </Button>
            {slug && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/${slug}`} target="_blank" rel="noreferrer">
                  Lihat Toko
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
