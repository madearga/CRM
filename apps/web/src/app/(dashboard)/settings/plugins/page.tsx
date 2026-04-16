'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  ShoppingBag,
  ToggleLeft,
  ToggleRight,
  Globe,
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
import { PLUGINS, getPlugin } from '@/lib/plugins/registry';
import type { PluginInstance } from '@/lib/plugins/types';

export default function PluginsSettingsPage() {
  const { data: instances, isLoading } = useAuthQuery(api.plugins.list, {});
  const upsertPlugin = useAuthMutation(api.plugins.upsert);
  const removePlugin = useAuthMutation(api.plugins.remove);

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
              removePlugin={removePlugin}
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
  removePlugin,
}: {
  plugin: (typeof PLUGINS)[number];
  instance: PluginInstance | undefined;
  upsertPlugin: ReturnType<typeof useAuthMutation<typeof api.plugins.upsert>>;
  removePlugin: ReturnType<typeof useAuthMutation<typeof api.plugins.remove>>;
}) {
  const isActive = instance?.isActive ?? false;
  const [slug, setSlug] = useState(instance?.publicSlug ?? '');
  const [domain, setDomain] = useState(instance?.customDomain ?? '');
  const [saving, setSaving] = useState(false);
  const Icon = plugin.icon;

  async function handleToggle(active: boolean) {
    setSaving(true);
    try {
      await upsertPlugin.mutateAsync({
        pluginId: plugin.id,
        isActive: active,
        publicSlug: slug || undefined,
        customDomain: domain || undefined,
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
        customDomain: domain || undefined,
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
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
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
                URL toko: <code>/shop/{slug || '{slug}'}</code>
              </p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="size-3.5" />
                Custom Domain
              </Label>
              <Input
                placeholder="www.tokobudi.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Domain kustom yang mengarah ke toko ini
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Simpan
            </Button>
            {slug && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/shop/${slug}`} target="_blank" rel="noreferrer">
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
