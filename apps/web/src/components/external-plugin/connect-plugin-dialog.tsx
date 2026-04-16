'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Link2, Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuthMutation, useAuthQuery } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';

interface ConnectPluginDialogProps {
  pluginInstanceId: string;
  pluginName: string;
  children: React.ReactNode;
  onConnected?: () => void;
}

type Step = 'input' | 'verifying' | 'verified' | 'connected';

export function ConnectPluginDialog({
  pluginInstanceId,
  pluginName,
  children,
  onConnected,
}: ConnectPluginDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('input');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [generatedApiKey, setGeneratedApiKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [externalId, setExternalId] = useState('');
  const [manifest, setManifest] = useState<any>(null);

  const registerMutation = useAuthMutation(api.externalPlugins.register);
  const verifyMutation = useAuthMutation(api.externalPlugins.verify);

  function reset() {
    setStep('input');
    setName('');
    setUrl('');
    setGeneratedApiKey('');
    setCopied(false);
    setExternalId('');
    setManifest(null);
  }

  async function handleRegister() {
    if (!url.trim()) {
      toast.error('URL plugin wajib diisi');
      return;
    }

    try {
      setStep('verifying');
      const result = await registerMutation.mutateAsync({
        name: name.trim() || pluginName,
        url: url.trim(),
        pluginInstanceId,
      });

      setExternalId(result.id);
      setGeneratedApiKey(result.apiKey);

      // Auto-verify
      const verifyResult = await verifyMutation.mutateAsync({ id: result.id });

      if (verifyResult.success) {
        setManifest(verifyResult.manifest);
        setStep('connected');
        toast.success('Plugin berhasil terhubung!');
      } else {
        setStep('verified');
        toast.warning('Plugin terdaftar tapi belum terverifikasi', {
          description: verifyResult.error,
        });
      }
    } catch (err: any) {
      setStep('input');
      toast.error(err.message ?? 'Gagal mendaftarkan plugin');
    }
  }

  async function handleReverify() {
    if (!externalId) return;
    try {
      setStep('verifying');
      const result = await verifyMutation.mutateAsync({ id: externalId });
      if (result.success) {
        setManifest(result.manifest);
        setStep('connected');
        toast.success('Plugin terverifikasi!');
      } else {
        setStep('verified');
        toast.error(result.error ?? 'Verifikasi gagal');
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Gagal verifikasi');
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(generatedApiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDone() {
    setOpen(false);
    reset();
    onConnected?.();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-5" />
            Hubungkan Toko Online
          </DialogTitle>
          <DialogDescription>
            {step === 'input' && 'Masukkan URL toko online Anda yang sudah di-deploy.'}
            {step === 'verifying' && 'Memverifikasi koneksi...'}
            {step === 'verified' && 'Koneksi belum berhasil. Coba lagi.'}
            {step === 'connected' && 'Toko online berhasil terhubung!'}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Input URL */}
        {step === 'input' && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ep-name">Nama Toko (opsional)</Label>
              <Input
                id="ep-name"
                placeholder={pluginName}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ep-url">URL Toko Online *</Label>
              <Input
                id="ep-url"
                placeholder="https://myshop.vercel.app"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                type="url"
              />
              <p className="text-xs text-muted-foreground">
                URL toko yang sudah di-deploy dan implementasi Plugin API.
              </p>
            </div>
          </div>
        )}

        {/* Step: Verifying */}
        {step === 'verifying' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="size-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Menghubungi {url}...
            </p>
          </div>
        )}

        {/* Step: Verified (needs retry) */}
        {step === 'verified' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <XCircle className="size-12 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Tidak dapat terhubung ke plugin. Pastikan URL benar dan plugin API aktif.
            </p>
            <Button variant="outline" onClick={handleReverify}>
              <RefreshCw className="mr-2 size-4" />
              Coba Lagi
            </Button>
          </div>
        )}

        {/* Step: Connected */}
        {step === 'connected' && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
              <CheckCircle2 className="size-6 text-green-600" />
              <div>
                <p className="font-medium text-green-800">Terhubung!</p>
                <p className="text-sm text-green-700">
                  {(manifest?.name ?? name) || pluginName} v{manifest?.version ?? '?'}
                </p>
              </div>
            </div>

            {manifest?.capabilities && (
              <div className="flex flex-wrap gap-2">
                {manifest.capabilities.map((cap: string) => (
                  <Badge key={cap} variant="secondary">
                    {cap}
                  </Badge>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-xs break-all">
                  {generatedApiKey}
                </code>
                <Button size="sm" variant="outline" onClick={handleCopy}>
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Simpan API key ini di file <code>.env</code> toko Anda dengan nama{' '}
                <code>CRM_API_KEY</code>.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'input' && (
            <Button onClick={handleRegister} disabled={!url.trim()}>
              Hubungkan
            </Button>
          )}
          {step === 'connected' && (
            <Button onClick={handleDone}>Selesai</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
