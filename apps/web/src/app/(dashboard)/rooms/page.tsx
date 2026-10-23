'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/empty-state';
import { toast } from 'sonner';
import { formatDistanceToNow } from '@/lib/format-date';
import { AlertCircle, Lock, MessageSquare, Plus, Users } from 'lucide-react';

const KIND_LABEL: Record<string, string> = {
  project: 'Proyek',
  department: 'Departemen',
};

const VISIBILITY_LABEL: Record<string, string> = {
  open: 'Terbuka',
  private: 'Privat',
};

const ROLE_LABEL: Record<string, string> = {
  owner: 'Pemilik',
  member: 'Anggota',
  observer: 'Pengamat',
};

interface Invite {
  enabled: boolean;
  role: string;
  scopes: string;
}

const EMPTY_INVITE: Invite = { enabled: false, role: 'member', scopes: '' };

export default function RoomsPage() {
  const router = useRouter();

  const canView = usePermission('rooms', 'view');
  const canCreate = usePermission('rooms', 'create');
  const canViewAgents = usePermission('agents', 'view');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    kind: 'project',
    visibility: 'open',
  });
  const [invites, setInvites] = useState<Record<string, Invite>>({});

  const { data: rooms, isLoading, error } = useAuthQuery(
    api.rooms.list,
    canView ? {} : 'skip'
  );
  const { data: agents } = useAuthQuery(
    api.agents.list,
    canViewAgents ? {} : 'skip'
  );

  const createRoom = useAuthMutation(api.rooms.create);

  const resetForm = () => {
    setForm({ name: '', description: '', kind: 'project', visibility: 'open' });
    setInvites({});
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Nama ruang wajib diisi');
      return;
    }

    const members = Object.entries(invites)
      .filter(([, invite]) => invite.enabled)
      .map(([agentId, invite]) => ({
        agentId,
        role: invite.role as 'owner' | 'member' | 'observer',
        scopes: invite.scopes
          .split(',')
          .map((scope) => scope.trim())
          .filter((scope) => scope.length > 0),
      }));

    try {
      const result = await createRoom.mutateAsync({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        kind: form.kind as 'project' | 'department',
        visibility: form.visibility as 'open' | 'private',
        members: members.length > 0 ? members : undefined,
      });

      toast.success('Ruang dibuat');
      setDialogOpen(false);
      resetForm();
      router.push(`/rooms/${result.id}`);
    } catch (e: any) {
      toast.error(e?.data?.message ?? 'Gagal membuat ruang');
    }
  };

  const updateInvite = (agentId: string, patch: Partial<Invite>) => {
    setInvites((prev) => ({
      ...prev,
      [agentId]: { ...(prev[agentId] ?? EMPTY_INVITE), ...patch },
    }));
  };

  if (!canView) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Ruang</h1>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          Anda tidak memiliki izin untuk melihat ruang.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Ruang</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ruang kerja bersama antara orang dan agen. Setiap ruang punya
            anggotanya sendiri dan riwayat pesannya sendiri.
          </p>
        </div>
        {canCreate ? (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Ruang baru
          </Button>
        ) : null}
      </div>

      {!canCreate ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          Anda tidak memiliki izin untuk membuat ruang, jadi tombol buat tidak
          ditampilkan.
        </p>
      ) : null}

      {error ? (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          Ruang tidak dapat dimuat. Muat ulang halaman untuk mencoba lagi.
        </p>
      ) : null}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : !rooms || rooms.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="size-6" />}
          title="Belum ada ruang"
          description="Buat ruang pertama agar orang dan agen dapat bekerja bersama di satu tempat."
          action={
            canCreate ? (
              <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Ruang baru
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {rooms.map((room) => (
            <Link
              key={room.id}
              href={`/rooms/${room.id}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border px-3 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {room.visibility === 'private' ? (
                  <>
                    <Lock
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="sr-only">Ruang privat</span>
                  </>
                ) : null}
                <span className="truncate text-sm font-medium">{room.name}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Badge variant="outline" className="h-5 text-[11px]">
                  {KIND_LABEL[room.kind] ?? room.kind}
                </Badge>
                <Badge variant="secondary" className="h-5 text-[11px]">
                  {VISIBILITY_LABEL[room.visibility] ?? room.visibility}
                </Badge>
              </span>
              <span className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {room.memberCount} anggota
                </span>
                <span>
                  {room.lastMessageAt
                    ? `Pesan terakhir ${formatDistanceToNow(room.lastMessageAt)}`
                    : 'Belum ada pesan'}
                </span>
              </span>
            </Link>
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
            <DialogTitle>Ruang baru</DialogTitle>
            <DialogDescription>
              Ruang terbuka bisa dibaca dan ditulis semua anggota organisasi.
              Ruang privat hanya untuk anggotanya.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="room-name">Nama</Label>
              <Input
                id="room-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Contoh: Pelosongan Q3"
                maxLength={80}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="room-kind">Jenis</Label>
                <Select
                  value={form.kind}
                  onValueChange={(value) => setForm({ ...form, kind: value })}
                >
                  <SelectTrigger id="room-kind" className="w-full">
                    <SelectValue placeholder="Jenis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="project">Proyek</SelectItem>
                    <SelectItem value="department">Departemen</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="room-visibility">Visibilitas</Label>
                <Select
                  value={form.visibility}
                  onValueChange={(value) => setForm({ ...form, visibility: value })}
                >
                  <SelectTrigger id="room-visibility" className="w-full">
                    <SelectValue placeholder="Visibilitas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Terbuka</SelectItem>
                    <SelectItem value="private">Privat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="room-description">Deskripsi (opsional)</Label>
              <Textarea
                id="room-description"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Apa yang dikerjakan di ruang ini?"
                maxLength={1000}
              />
            </div>

            <div className="space-y-2">
              <Label>Agen yang diundang (opsional)</Label>
              {!canViewAgents ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Anda tidak memiliki izin untuk melihat agen, jadi tidak ada
                  agen yang bisa diundang dari sini.
                </p>
              ) : !agents || agents.length === 0 ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Belum ada agen di organisasi ini.
                  </p>
                  <Link
                    href="/agents"
                    className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    Buat agen pertama di halaman Agen
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {agents.map((agent) => {
                    const invite = invites[agent.agentId] ?? EMPTY_INVITE;
                    return (
                      <div
                        key={agent.id}
                        className="rounded-md border px-3 py-2"
                      >
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            checked={invite.enabled}
                            onChange={(e) =>
                              updateInvite(agent.agentId, { enabled: e.target.checked })
                            }
                          />
                          <span className="font-medium">{agent.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {agent.agentId}
                          </span>
                        </label>
                        {invite.enabled ? (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <Select
                              value={invite.role}
                              onValueChange={(value) =>
                                updateInvite(agent.agentId, { role: value })
                              }
                            >
                              <SelectTrigger className="h-8 w-full text-xs">
                                <SelectValue placeholder="Peran" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="member">Anggota</SelectItem>
                                <SelectItem value="observer">Pengamat</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              className="h-8 text-xs"
                              value={invite.scopes}
                              onChange={(e) =>
                                updateInvite(agent.agentId, { scopes: e.target.value })
                              }
                              placeholder="Scope, pisahkan dengan koma"
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={createRoom.isPending}
            >
              Batal
            </Button>
            <Button onClick={handleCreate} disabled={createRoom.isPending}>
              {createRoom.isPending ? 'Menyimpan...' : 'Buat ruang'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
