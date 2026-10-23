'use client';

import { useState } from 'react';
import { api } from '@convex/_generated/api';
import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { usePermission } from '@/lib/permissions/use-permission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/empty-state';
import { toast } from 'sonner';
import { formatDistanceToNow } from '@/lib/format-date';
import { AlertCircle, Bot, Plus, X } from 'lucide-react';

const KEY_PATTERN = /^[a-z0-9-]+$/;

export default function AgentsPage() {
  const canView = usePermission('agents', 'view');
  const canCreate = usePermission('agents', 'create');
  const canManage = usePermission('agents', 'manage');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    agentId: '',
    name: '',
    description: '',
    model: 'glm-5.3-flash',
  });
  const [scopes, setScopes] = useState<string[]>([]);
  const [scopeDraft, setScopeDraft] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data: agents, isLoading, error } = useAuthQuery(
    api.agents.list,
    canView ? {} : 'skip'
  );

  const createAgent = useAuthMutation(api.agents.create);
  const setStatus = useAuthMutation(api.agents.setStatus);

  const resetForm = () => {
    setForm({ agentId: '', name: '', description: '', model: '' });
    setScopes([]);
    setScopeDraft('');
    setFormError(null);
  };

  const addScope = () => {
    const value = scopeDraft.trim();
    if (!value) return;
    if (scopes.includes(value)) {
      setFormError(`Scope "${value}" sudah ada.`);
      return;
    }
    setScopes([...scopes, value]);
    setScopeDraft('');
    setFormError(null);
  };

  const handleCreate = async () => {
    const key = form.agentId.trim();
    const name = form.name.trim();

    if (!KEY_PATTERN.test(key)) {
      setFormError(
        'Kunci agen hanya boleh berisi huruf kecil, angka, dan tanda hubung.'
      );
      return;
    }
    if (!name) {
      setFormError('Nama agen wajib diisi.');
      return;
    }

    try {
      await createAgent.mutateAsync({
        agentId: key,
        name,
        description: form.description.trim() || undefined,
        model: form.model.trim() || 'glm-5.3-flash',
        scopes: scopes.length > 0 ? scopes : undefined,
      });

      toast.success('Agen dibuat');
      setDialogOpen(false);
      resetForm();
    } catch (e: any) {
      setFormError(e?.data?.message ?? 'Gagal membuat agen');
    }
  };

  const handleStatus = async (agentId: string, status: 'active' | 'disabled') => {
    try {
      await setStatus.mutateAsync({ agentId, status });
      toast.success(status === 'active' ? 'Agen diaktifkan' : 'Agen dimatikan');
    } catch (e: any) {
      toast.error(e?.data?.message ?? 'Gagal mengubah status agen');
    }
  };

  if (!canView) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Agen</h1>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          Anda tidak memiliki izin untuk melihat agen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Agen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Agen adalah anggota dengan nama sendiri dan scope sendiri. Agen
            tidak pernah masuk, jadi kuncinya harus jelas bagi tim.
          </p>
        </div>
        {canCreate ? (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Agen baru
          </Button>
        ) : null}
      </div>

      {!canCreate ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          Anda tidak memiliki izin untuk membuat agen, jadi tombol buat tidak
          ditampilkan.
        </p>
      ) : null}

      {error ? (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          Agen tidak dapat dimuat. Muat ulang halaman untuk mencoba lagi.
        </p>
      ) : null}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : !agents || agents.length === 0 ? (
        <EmptyState
          icon={<Bot className="size-6" />}
          title="Belum ada agen"
          description="Buat agen pertama agar ia dapat menjadi anggota ruang dan menjalankan pekerjaannya."
          action={
            canCreate ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Agen baru
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="rounded-md border px-3 py-2.5 transition-colors hover:bg-muted/50"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="flex min-w-0 items-center gap-2">
                  <Bot className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">{agent.name}</span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {agent.agentId}
                </span>
                <Badge
                  variant="outline"
                  className={
                    agent.status === 'active'
                      ? 'h-5 border-green-500/40 text-[11px] text-green-600 dark:text-green-400'
                      : 'h-5 text-[11px] text-muted-foreground'
                  }
                >
                  {agent.status === 'active' ? 'Aktif' : 'Nonaktif'}
                </Badge>
                <span className="ml-auto flex items-center gap-3">
                  {agent.model ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {agent.model}
                    </span>
                  ) : null}
                  {canManage ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() =>
                        handleStatus(
                          agent.agentId,
                          agent.status === 'active' ? 'disabled' : 'active'
                        )
                      }
                      disabled={setStatus.isPending}
                    >
                      {agent.status === 'active' ? 'Matikan' : 'Aktifkan'}
                    </Button>
                  ) : null}
                </span>
              </div>
              {agent.description ? (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {agent.description}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {agent.scopes.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    Tanpa scope, jadi agen tidak boleh melakukan apa pun.
                  </span>
                ) : (
                  agent.scopes.map((scope) => (
                    <Badge
                      key={scope}
                      variant="secondary"
                      className="h-5 font-mono text-[11px]"
                    >
                      {scope}
                    </Badge>
                  ))
                )}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Dibuat {formatDistanceToNow(agent.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Agen baru</DialogTitle>
            <DialogDescription>
              Kunci agen dipakai saat ia menjadi anggota ruang. Gunakan huruf
              kecil, angka, dan tanda hubung, misalnya nara.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="agent-key">Kunci</Label>
              <Input
                id="agent-key"
                value={form.agentId}
                onChange={(e) => {
                  setForm({ ...form, agentId: e.target.value });
                  setFormError(null);
                }}
                placeholder="nara"
                maxLength={60}
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agent-name">Nama</Label>
              <Input
                id="agent-name"
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  setFormError(null);
                }}
                placeholder="Nara"
                maxLength={80}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agent-description">Deskripsi (opsional)</Label>
              <Textarea
                id="agent-description"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Apa yang dikerjakan agen ini?"
                maxLength={1000}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agent-model">Model</Label>
              <p className="text-xs text-muted-foreground">
                Runtime menjalankan agen dengan glm-5.3-flash via Z.AI.
              </p>
              <Input
                id="agent-model"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                readOnly
                maxLength={100}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agent-scope">Scope</Label>
              <div className="flex gap-2">
                <Input
                  id="agent-scope"
                  value={scopeDraft}
                  onChange={(e) => {
                    setScopeDraft(e.target.value);
                    setFormError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addScope();
                    }
                  }}
                  placeholder="Contoh: read"
                  maxLength={100}
                />
                <Button type="button" variant="outline" onClick={addScope}>
                  Tambah
                </Button>
              </div>
              {scopes.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {scopes.map((scope) => (
                    <Badge
                      key={scope}
                      variant="secondary"
                      className="h-6 gap-1 font-mono text-[11px]"
                    >
                      {scope}
                      <button
                        type="button"
                        onClick={() =>
                          setScopes(scopes.filter((item) => item !== scope))
                        }
                        className="rounded-sm focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-ring/60"
                        aria-label={`Hapus scope ${scope}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Belum ada scope. Agen tanpa scope tidak boleh melakukan apa
                  pun.
                </p>
              )}
            </div>

            {formError ? (
              <p className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {formError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={createAgent.isPending}
            >
              Batal
            </Button>
            <Button onClick={handleCreate} disabled={createAgent.isPending}>
              {createAgent.isPending ? 'Menyimpan...' : 'Buat agen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
