'use client';

import { useState, useEffect } from 'react';
import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Store, Key, ShieldCheck, Globe, Loader2, Save, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function ShopSettingsPage() {
  const { data: config, isLoading } = useAuthQuery(api.commerce.shopSettings.getShopConfig, {});
  const saveConfig = useAuthMutation(api.commerce.shopSettings.saveShopConfig);

  const [isActive, setIsActive] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(true);
  const [clientKey, setClientKey] = useState('');
  const [serverKey, setServerKey] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (config && !hasLoaded) {
      setIsActive(config.isActive);
      setSandboxMode(config.sandboxMode);
      setClientKey(config.clientKey);
      setHasLoaded(true);
    }
  }, [config, hasLoaded]);

  const handleSave = async () => {
    try {
      await saveConfig.mutateAsync({
        isActive,
        sandboxMode,
        clientKey,
        serverKey: serverKey || undefined,
      });
      toast.success('Shop settings saved');
      setServerKey(''); // Clear server key after save (security)
    } catch (error: any) {
      toast.error(error?.message ?? 'Failed to save settings');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Shop Toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Store className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Online Shop</CardTitle>
                <CardDescription>Enable your customer-facing online shop</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isActive && (
                <Badge variant="default" className="bg-green-600">
                  Active
                </Badge>
              )}
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
        </CardHeader>
        {isActive && (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your shop is live at{' '}
              <Link
                href="/shop"
                target="_blank"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                {typeof window !== 'undefined' ? window.location.origin : ''}/shop
                <ExternalLink className="size-3" />
              </Link>
            </p>
          </CardContent>
        )}
      </Card>

      {/* Payment Provider - Midtrans */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <Key className="size-5 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-base">Payment Gateway — Midtrans</CardTitle>
              <CardDescription>Configure Midtrans integration for online payments</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sandbox Mode Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Sandbox Mode</p>
                <p className="text-xs text-muted-foreground">
                  Use Midtrans sandbox environment for testing
                </p>
              </div>
            </div>
            <Switch checked={sandboxMode} onCheckedChange={setSandboxMode} />
          </div>

          <Separator />

          {/* API Keys */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clientKey" className="text-sm font-medium">
                Client Key
              </Label>
              <Input
                id="clientKey"
                type="text"
                placeholder="SB-Mid-client-xxx"
                value={clientKey}
                onChange={(e) => setClientKey(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Found in Midtrans Dashboard → Settings → Access Keys
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serverKey" className="text-sm font-medium">
                Server Key
              </Label>
              <Input
                id="serverKey"
                type="password"
                placeholder={config?.serverKeyConfigured ? '•••••••• (configured)' : 'SB-Mid-server-xxx'}
                value={serverKey}
                onChange={(e) => setServerKey(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {config?.serverKeyConfigured
                  ? 'Leave empty to keep the current server key'
                  : 'Required for payment processing'}
              </p>
            </div>
          </div>

          {/* Webhook URL */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Webhook URL</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono">
                {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/midtrans
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const url = `${window.location.origin}/api/webhooks/midtrans`;
                  navigator.clipboard.writeText(url);
                  toast.success('Webhook URL copied');
                }}
              >
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Add this URL to your Midtrans Dashboard → Settings → Payment Notification URL
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveConfig.isPending} className="min-w-[120px]">
          {saveConfig.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 size-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
