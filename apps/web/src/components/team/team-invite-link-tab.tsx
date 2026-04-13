'use client';

import { useState } from 'react';
import { api } from '@convex/_generated/api';
import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link2, Copy, Check, X, Plus, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { env } from '@/env';

const EXPIRY_OPTIONS = [
  { label: '1 day', value: 1 * 24 * 60 * 60 * 1000 },
  { label: '7 days', value: 7 * 24 * 60 * 60 * 1000 },
  { label: '30 days', value: 30 * 24 * 60 * 60 * 1000 },
] as const;

function getDaysRemaining(expiresAt: number): number {
  const diff = expiresAt - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? (
        <Check className="mr-1 size-3.5 text-green-500" />
      ) : (
        <Copy className="mr-1 size-3.5" />
      )}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

export function TeamInviteLinkTab() {
  const { data: links, isLoading } = useAuthQuery(
    api.inviteLinks.list,
    {},
  );

  const { data: templates } = useAuthQuery(
    api.permissionTemplates.list,
    {},
  );

  const createLink = useAuthMutation(api.inviteLinks.create);
  const revokeLink = useAuthMutation(api.inviteLinks.revoke);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedExpiry, setSelectedExpiry] = useState<string>(
    String(EXPIRY_OPTIONS[1].value),
  );
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const activeLinks = links ?? [];
  const templatesList = templates ?? [];

  const handleGenerate = async () => {
    if (!selectedTemplateId) {
      toast.error('Please select a role');
      return;
    }

    setIsCreating(true);
    try {
      const result = await createLink.mutateAsync({
        roleTemplateId: selectedTemplateId as any,
        expiresInMs: Number(selectedExpiry),
      });
      const baseUrl = env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const url = `${baseUrl}/invite/${result.token}`;
      setGeneratedUrl(url);
      toast.success('Invite link generated');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to generate link');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (linkId: string) => {
    try {
      await revokeLink.mutateAsync({ linkId: linkId as any });
      toast.success('Invite link revoked');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to revoke link');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Generator Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="size-4" />
            Generate Invite Link
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Role for new members</label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role..." />
                </SelectTrigger>
                <SelectContent>
                  {templatesList.map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Expires in</label>
              <Select value={selectedExpiry} onValueChange={setSelectedExpiry}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate} disabled={isCreating || !selectedTemplateId}>
              {isCreating ? 'Generating...' : 'Generate Link'}
            </Button>
          </div>

          {generatedUrl && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
              <Link2 className="size-4 shrink-0 text-muted-foreground" />
              <code className="flex-1 truncate text-sm">{generatedUrl}</code>
              <CopyButton text={generatedUrl} />
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Active Links */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Link2 className="size-4" />
          Active Links ({activeLinks.length})
        </div>

        {activeLinks.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No active invite links
          </div>
        ) : (
          <div className="space-y-1">
            {activeLinks.map((link) => {
              const daysLeft = getDaysRemaining(link.expiresAt);
              const template = templatesList.find(
                (t) => t._id === link.roleTemplateId,
              );
              const baseUrl = env.NEXT_PUBLIC_SITE_URL || '';
              const fullUrl = `${baseUrl}/invite/${link.token}`;

              return (
                <div
                  key={link._id}
                  className="flex items-center gap-3 rounded-md p-3 hover:bg-muted/50 transition-colors"
                >
                  <Link2 className="size-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <code className="text-sm truncate block max-w-[200px]">
                      {link.token.slice(0, 12)}...
                    </code>
                  </div>
                  <Badge variant="outline">
                    {template?.name ?? 'Unknown role'}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {daysLeft > 0 ? `${daysLeft}d left` : 'Expired'}
                  </div>
                  <CopyButton text={fullUrl} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRevoke(link._id)}
                    disabled={revokeLink.isPending}
                  >
                    <X className="mr-1 size-3" />
                    Revoke
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
