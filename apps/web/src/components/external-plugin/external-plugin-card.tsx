'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Unplug,
  Trash2,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  useAuthQuery,
  useAuthMutation,
} from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import type { ExternalPlugin } from '@/lib/plugins/types';

interface ExternalPluginCardProps {
  plugin: ExternalPlugin;
  onRemoved?: () => void;
}

export function ExternalPluginCard({ plugin, onRemoved }: ExternalPluginCardProps) {
  const [syncing, setSyncing] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const triggerSync = useAuthMutation(api.externalPlugins.triggerSync);
  const unregister = useAuthMutation(api.externalPlugins.unregister);
  const regenerateApiKey = useAuthMutation(api.externalPlugins.regenerateApiKey);
  const verifyMutation = useAuthMutation(api.externalPlugins.verify);

  const statusConfig = {
    connected: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', label: 'Terhubung' },
    disconnected: { icon: Unplug, color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Terputus' },
    error: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Error' },
  };

  const config = statusConfig[plugin.status as keyof typeof statusConfig] ?? statusConfig.disconnected;
  const StatusIcon = config.icon;

  async function handleSync(table: 'products' | 'orders' | 'customers') {
    setSyncing(table);
    try {
      const result = await triggerSync.mutateAsync({ id: plugin.id, table });
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Sync gagal');
    } finally {
      setSyncing(null);
    }
  }

  async function handleRemove() {
    if (!confirm('Yakin ingin menghapus koneksi plugin ini?')) return;
    try {
      await unregister.mutateAsync({ id: plugin.id });
      toast.success('Plugin dihapus');
      onRemoved?.();
    } catch (err: any) {
      toast.error(err.message ?? 'Gagal menghapus');
    }
  }

  async function handleReverify() {
    try {
      const result = await verifyMutation.mutateAsync({ id: plugin.id });
      if (result.success) {
        toast.success('Koneksi terverifikasi!');
      } else {
        toast.error(result.error ?? 'Verifikasi gagal');
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Gagal verifikasi');
    }
  }

  async function handleCopyApiKey() {
    // Fetch the full plugin data to get the API key
    await navigator.clipboard.writeText('••••••••');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.info('Gunakan tombol "Regenerate Key" untuk mendapatkan API key baru');
  }

  async function handleRegenerateKey() {
    if (!confirm('API key lama akan tidak berlaku. Lanjutkan?')) return;
    try {
      const result = await regenerateApiKey.mutateAsync({ id: plugin.id });
      await navigator.clipboard.writeText(result.apiKey);
      toast.success('API key baru sudah di-copy ke clipboard');
    } catch (err: any) {
      toast.error(err.message ?? 'Gagal regenerate key');
    }
  }

  const tables = plugin.manifest?.capabilities ?? ['products', 'orders', 'customers'] as const;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex size-10 items-center justify-center rounded-lg ${config.bg}`}>
              <StatusIcon className={`size-5 ${config.color}`} />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                {plugin.name}
                <Badge variant={plugin.status === 'connected' ? 'default' : 'destructive'}>
                  {config.label}
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <ExternalLink className="size-3" />
                {plugin.url}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleReverify}>
              <RefreshCw className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleRemove}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Last sync info */}
        {plugin.lastSyncAt && (
          <p className="text-xs text-muted-foreground">
            Terakhir sync: {new Date(plugin.lastSyncAt).toLocaleString('id-ID')}
          </p>
        )}
        {plugin.lastError && (
          <p className="text-xs text-destructive">{plugin.lastError}</p>
        )}

        <Separator />

        {/* Sync buttons */}
        <div>
          <p className="mb-2 text-sm font-medium">Sinkronisasi Data</p>
          <div className="flex flex-wrap gap-2">
            {tables.map((table: string) => (
              <Button
                key={table}
                variant="outline"
                size="sm"
                onClick={() => handleSync(table as 'products' | 'orders' | 'customers')}
                disabled={syncing !== null || plugin.status !== 'connected'}
              >
                {syncing === table ? (
                  <Loader2 className="mr-2 size-3 animate-spin" />
                ) : (
                  <ArrowDownToLine className="mr-2 size-3" />
                )}
                Pull {table}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Pull = ambil data dari toko external ke CRM
          </p>
        </div>

        <Separator />

        {/* API Key */}
        <div>
          <p className="mb-2 text-sm font-medium">API Key</p>
          <div className="flex gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-xs">
              ••••••••••••••••••••
            </code>
            <Button size="sm" variant="outline" onClick={handleCopyApiKey}>
              <Copy className="size-3" />
            </Button>
            <Button size="sm" variant="outline" onClick={handleRegenerateKey}>
              Regenerate
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
