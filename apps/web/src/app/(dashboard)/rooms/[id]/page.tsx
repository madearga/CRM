'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useConvex } from 'convex/react';
import type { Id } from '@convex/_generated/dataModel';
import { api } from '@convex/_generated/api';
import {
  useAuthQuery,
  useAuthMutation,
  useCurrentUser,
} from '@/lib/convex/hooks';
import { useAuthStore } from '@/lib/convex/components/convex-provider';
import { usePermission } from '@/lib/permissions/use-permission';
import { scopesGrantRoomWrite } from '@crm/domain';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { RoomComposer } from '@/components/rooms/room-composer';
import { RoomMessageList } from '@/components/rooms/room-message-list';
import { requestRoomAgent } from '@/components/rooms/room-agent-client';
import type { RoomListMessage, RoomProposal } from '@/components/rooms/types';
import '../../../../components/rooms/rooms.css';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Bot,
  Info,
  Lock,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';

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

export default function RoomPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const roomId = (params?.id as Id<'rooms'>) ?? null;

  const canView = usePermission('rooms', 'view');
  const canCreate = usePermission('rooms', 'create');
  const canManage = usePermission('rooms', 'manage');
  const canViewAgents = usePermission('agents', 'view');

  const user = useCurrentUser();
  const orgSlug = user?.activeOrganization?.slug;

  const [addOpen, setAddOpen] = useState(false);
  const [memberForm, setMemberForm] = useState({
    memberType: 'agent' as 'agent' | 'user',
    agentId: '',
    userId: '',
    role: 'member',
    scopes: '',
  });
  const [memberError, setMemberError] = useState<string | null>(null);

  // Pesan dan balasan yang belum tersimpan di server.
  const [pendingUser, setPendingUser] = useState<{
    text: string;
    at: number;
  } | null>(null);
  const [pendingReply, setPendingReply] = useState<{
    text: string;
    at: number;
  } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [proposalUpdates, setProposalUpdates] = useState<
    Record<string, RoomProposal>
  >({});
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, string>
  >({});
  const [decidingOperationId, setDecidingOperationId] = useState<string | null>(
    null
  );

  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const { data: room, isLoading, error } = useAuthQuery(
    api.rooms.get,
    roomId ? { roomId } : ('skip' as const)
  );
  const { data: members } = useAuthQuery(
    api.rooms.listMembers,
    roomId ? { roomId } : ('skip' as const)
  );
  const { data: messages } = useAuthQuery(
    api.rooms.listMessages,
    roomId ? { roomId, limit: 100 } : ('skip' as const)
  );
  const { data: operations } = useAuthQuery(
    api.agentOperations.list,
    canViewAgents ? { limit: 100 } : ('skip' as const)
  );
  const { data: agents } = useAuthQuery(
    api.agents.list,
    canViewAgents ? {} : ('skip' as const)
  );
  const { data: orgMembers } = useAuthQuery(
    api.organization.listMembers,
    orgSlug ? { slug: orgSlug } : ('skip' as const)
  );

  const archiveRoom = useAuthMutation(api.rooms.archive);
  const addMember = useAuthMutation(api.rooms.addMember);
  const removeMember = useAuthMutation(api.rooms.removeMember);
  const decide = useAuthMutation(api.agentOperations.decide);

  const convex = useConvex();
  const { state: authState } = useAuthStore();

  const threadRef = useRef<HTMLDivElement>(null);
  const forceScrollRef = useRef(false);

  // The thread opens at the newest message, but it never jumps while the
  // person is writing.
  useEffect(() => {
    const root = threadRef.current;
    if (!root) return;
    const viewport = root.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLElement | null;
    if (!viewport) return;

    const writing = document.activeElement?.id === 'room-message-input';
    if (writing && !forceScrollRef.current) return;

    forceScrollRef.current = false;
    viewport.scrollTop = viewport.scrollHeight;
  }, [messages, pendingUser, pendingReply]);

  const membership = room?.membership ?? null;

  const writeBlock = (): { allowed: boolean; reason: string } => {
    if (!room) return { allowed: false, reason: 'Ruang belum siap.' };
    if (room.archivedAt !== undefined) {
      return { allowed: false, reason: 'Ruang ini sudah ditutup.' };
    }
    if (!canCreate) {
      return {
        allowed: false,
        reason: 'Anda tidak memiliki izin untuk menulis di ruang.',
      };
    }
    if (membership) {
      if (membership.role === 'observer') {
        return {
          allowed: false,
          reason: 'Peran Anda di ruang ini hanya pengamat, jadi Anda tidak dapat menulis.',
        };
      }
      if (
        membership.scopes.length > 0 &&
        !scopesGrantRoomWrite(membership.scopes)
      ) {
        return {
          allowed: false,
          reason: 'Scope Anda di ruang ini tidak memberi hak menulis.',
        };
      }
      return { allowed: true, reason: '' };
    }
    if (room.visibility === 'open') return { allowed: true, reason: '' };
    return {
      allowed: false,
      reason: 'Ruang ini privat dan Anda bukan anggotanya.',
    };
  };

  const write = writeBlock();

  // Orang lebih dulu, agen setelahnya, jadi daftar mudah dibaca.
  const sortedMembers = [...(members ?? [])].sort((a, b) => {
    if (a.memberType === b.memberType) return 0;
    return a.memberType === 'user' ? -1 : 1;
  });

  // Nama agen yang menjawab di ruang ini.
  const agentName = useMemo(() => {
    const agent = (members ?? []).find(
      (member) => member.memberType === 'agent'
    );
    return agent?.displayName ?? 'Agen';
  }, [members]);

  const currentUserName = user?.name || 'Anda';

  // Daftar ulang dari server setelah balasan agen masuk.
  const refetchMessages = useCallback(async () => {
    if (!roomId) return;
    try {
      const fresh = await convex.query(api.rooms.listMessages, {
        roomId,
        limit: 100,
      });
      setPendingUser((previous) =>
        previous &&
        fresh.some(
          (message) =>
            message.authorType === 'user' &&
            message.text === previous.text &&
            message.createdAt >= previous.at
        )
          ? null
          : previous
      );
      setPendingReply((previous) =>
        previous &&
        fresh.some(
          (message) =>
            message.authorType === 'agent' && message.createdAt >= previous.at
        )
          ? null
          : previous
      );
    } catch {
      // Daftar langsung tetap berlaku bila server tidak menjawab.
    }
  }, [convex, roomId]);

  // Pesan yang sudah tersimpan berubah lagi bila pesan optimistic sudah ada
  // di server.
  useEffect(() => {
    if (!pendingUser) return;
    const stored = (messages ?? []).some(
      (message) =>
        message.authorType === 'user' &&
        message.text === pendingUser.text &&
        message.createdAt >= pendingUser.at
    );
    if (stored) setPendingUser(null);
  }, [messages, pendingUser]);

  useEffect(() => {
    if (!pendingReply) return;
    const stored = (messages ?? []).some(
      (message) =>
        message.authorType === 'agent' && message.createdAt >= pendingReply.at
    );
    if (stored) setPendingReply(null);
  }, [messages, pendingReply]);

  // Proposal yang sudah terlihat di thread ini.
  const proposals = useMemo(() => {
    const map: Record<string, RoomProposal> = {};

    for (const operation of operations ?? []) {
      map[operation.id] = {
        operationId: operation.id,
        kind: operation.kind,
        summary: operation.summary ?? '',
        status: operation.status,
        duplicate: false,
      };
    }

    for (const proposal of Object.values(proposalUpdates)) {
      map[proposal.operationId] = {
        ...(map[proposal.operationId] ?? proposal),
        ...proposal,
      };
    }

    for (const [operationId, status] of Object.entries(statusOverrides)) {
      const proposal = map[operationId];
      if (proposal) map[operationId] = { ...proposal, status };
    }

    return map;
  }, [operations, proposalUpdates, statusOverrides]);

  const listMessages = useMemo<RoomListMessage[]>(() => {
    const items: RoomListMessage[] = (messages ?? []).map((message) => ({
      id: message.id,
      authorType: message.authorType,
      authorName: message.authorName,
      kind: message.kind,
      text: message.text,
      createdAt: message.createdAt,
      operationId: message.operationId,
    }));

    if (
      pendingUser &&
      !items.some(
        (message) =>
          message.authorType === 'user' &&
          message.text === pendingUser.text &&
          message.createdAt >= pendingUser.at
      )
    ) {
      items.push({
        id: 'pending-user',
        authorType: 'user',
        authorName: currentUserName,
        kind: 'message',
        text: pendingUser.text,
        createdAt: pendingUser.at,
        pending: true,
      });
    }

    if (
      pendingReply &&
      !items.some(
        (message) =>
          message.authorType === 'agent' && message.createdAt >= pendingReply.at
      )
    ) {
      items.push({
        id: 'pending-reply',
        authorType: 'agent',
        authorName: agentName,
        kind: 'message',
        text: pendingReply.text,
        createdAt: pendingReply.at,
        pending: true,
      });
    }

    return items;
  }, [messages, pendingUser, pendingReply, currentUserName, agentName]);

  // Proposal yang belum punya pesan di thread.
  const trailingProposals = useMemo(() => {
    const linked = new Set(
      listMessages
        .map((message) => message.operationId)
        .filter((operationId): operationId is string => Boolean(operationId))
    );
    return Object.values(proposalUpdates).filter(
      (proposal) => !linked.has(proposal.operationId)
    );
  }, [listMessages, proposalUpdates]);

  const handleSend = async (value: string) => {
    if (!roomId) throw new Error('Ruang tidak tersedia');

    const sentAt = Date.now();
    setIsSending(true);

    try {
      const response = await requestRoomAgent(
        roomId,
        value,
        authState.token ?? null
      );

      if (response.proposals.length > 0) {
        setProposalUpdates((previous) => {
          const next = { ...previous };
          for (const proposal of response.proposals) {
            next[proposal.operationId] = proposal;
          }
          return next;
        });
      }

      if (response.agentReply) {
        setPendingReply({ text: response.agentReply, at: sentAt });
      }

      await refetchMessages();
    } catch (error) {
      setPendingUser(null);
      throw error;
    } finally {
      setIsSending(false);
    }
  };

  const handleOptimistic = (value: string) => {
    setPendingUser({ text: value, at: Date.now() });
    forceScrollRef.current = true;
  };

  const handleDecide = async (
    operationId: string,
    decision: 'approve' | 'reject'
  ) => {
    setDecidingOperationId(operationId);
    setStatusOverrides((previous) => ({
      ...previous,
      [operationId]: decision === 'approve' ? 'pending' : 'rejected',
    }));

    try {
      await decide.mutateAsync({
        operationId: operationId as Id<'agentOperations'>,
        decision,
      });
      toast.success(
        decision === 'approve' ? 'Proposal disetujui' : 'Proposal ditolak'
      );
    } catch (e: any) {
      setStatusOverrides((previous) => {
        const next = { ...previous };
        delete next[operationId];
        return next;
      });
      toast.error(e?.data?.message ?? 'Gagal menyimpan keputusan');
    } finally {
      setDecidingOperationId(null);
    }
  };

  const handleArchive = async () => {
    if (!roomId) return;
    const ok = await confirm({
      title: 'Tutup ruang ini?',
      description:
        'Ruang ini ditutup dan tidak lagi muncul di daftar ruang. Riwayat pesannya tidak dihapus.',
      confirmLabel: 'Tutup ruang',
      cancelLabel: 'Batal',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await archiveRoom.mutateAsync({ roomId });
      toast.success('Ruang ditutup');
      router.push('/rooms');
    } catch (e: any) {
      toast.error(e?.data?.message ?? 'Gagal menutup ruang');
    }
  };

  const handleAddMember = async () => {
    if (!roomId) return;
    const scopes = memberForm.scopes
      .split(',')
      .map((scope) => scope.trim())
      .filter((scope) => scope.length > 0);

    if (memberForm.memberType === 'agent' && !memberForm.agentId) {
      setMemberError('Pilih agen yang mau ditambahkan.');
      return;
    }
    if (memberForm.memberType === 'user' && !memberForm.userId) {
      setMemberError('Pilih orang yang mau ditambahkan.');
      return;
    }

    try {
      await addMember.mutateAsync({
        roomId,
        memberType: memberForm.memberType,
        agentId: memberForm.memberType === 'agent' ? memberForm.agentId : undefined,
        userId: memberForm.memberType === 'user' ? memberForm.userId : undefined,
        role: memberForm.role as 'member' | 'observer',
        scopes: scopes.length > 0 ? scopes : undefined,
      });
      toast.success('Anggota ditambahkan');
      setAddOpen(false);
      setMemberError(null);
      setMemberForm({
        memberType: 'agent',
        agentId: '',
        userId: '',
        role: 'member',
        scopes: '',
      });
    } catch (e: any) {
      setMemberError(e?.data?.message ?? 'Gagal menambahkan anggota');
    }
  };

  const handleRemoveMember = async (memberId: string, name: string) => {
    if (!roomId) return;
    const ok = await confirm({
      title: `Keluarkan ${name} dari ruang?`,
      description:
        'Anggota ini dikeluarkan dari ruang ini dan tidak lagi bisa menulis di dalamnya.',
      confirmLabel: 'Keluarkan',
      cancelLabel: 'Batal',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await removeMember.mutateAsync({ roomId, memberId });
      toast.success('Anggota dikeluarkan');
    } catch (e: any) {
      toast.error(e?.data?.message ?? 'Gagal mengeluarkan anggota');
    }
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

  if (error) {
    return (
      <div className="space-y-4">
        <Link
          href="/rooms"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ArrowLeft className="h-4 w-4" />
          Daftar ruang
        </Link>
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          Ruang tidak dapat dibuka. Ruang ini mungkin sudah ditutup atau Anda
          bukan anggotanya.
        </p>
      </div>
    );
  }

  if (isLoading || !room) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 space-y-4">
        <div className="space-y-3">
          <Link
            href="/rooms"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ArrowLeft className="h-4 w-4" />
            Daftar ruang
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-xl font-semibold">
                {room.visibility === 'private' ? (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                ) : null}
                <span className="truncate">{room.name}</span>
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="h-5 text-[11px]">
                  {KIND_LABEL[room.kind] ?? room.kind}
                </Badge>
                <Badge variant="secondary" className="h-5 text-[11px]">
                  {VISIBILITY_LABEL[room.visibility] ?? room.visibility}
                </Badge>
                {room.archivedAt !== undefined ? (
                  <Badge variant="outline" className="h-5 text-[11px]">
                    Ditutup
                  </Badge>
                ) : null}
              </div>
              {room.description ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {room.description}
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {canManage ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAddOpen(true)}
                >
                  <UserPlus className="h-4 w-4" />
                  Kelola anggota
                </Button>
              ) : null}
              {canManage ? (
                <Button size="sm" variant="outline" onClick={handleArchive}>
                  <Archive className="h-4 w-4" />
                  Tutup ruang
                </Button>
              ) : null}
            </div>
          </div>

          {!canManage ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4" />
              Anda tidak memiliki izin untuk mengelola anggota ruang ini.
            </p>
          ) : null}
        </div>

        <Card className="gap-0 py-0">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <h2 className="text-sm font-medium">Percakapan</h2>
            <span className="text-xs text-muted-foreground">
              {listMessages.length} pesan
            </span>
          </div>

          <ScrollArea ref={threadRef} className="h-[55vh]">
            <RoomMessageList
              messages={listMessages}
              agentName={agentName}
              isThinking={isSending}
              canDecide={write.allowed}
              decidingOperationId={decidingOperationId}
              proposals={proposals}
              trailingProposals={trailingProposals}
              onDecide={handleDecide}
            />
          </ScrollArea>
        </Card>

        <Card className="gap-3 py-4">
          <RoomComposer
            canWrite={write.allowed}
            writeReason={write.reason}
            isSending={isSending}
            onSend={handleSend}
            onOptimistic={handleOptimistic}
          />
        </Card>
      </div>

      <aside className="w-full shrink-0 lg:w-72">
        <Card className="gap-0 py-0">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <h2 className="flex items-center gap-1.5 text-sm font-medium">
              <Users className="h-4 w-4" />
              Anggota
            </h2>
            <span className="text-xs text-muted-foreground">
              {members?.length ?? 0}
            </span>
          </div>

          <ScrollArea className="max-h-[45vh]">
            <div className="flex flex-col divide-y">
              {!members || members.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">
                  Belum ada anggota.
                </p>
              ) : (
                sortedMembers.map((member) => (
                  <div key={member.id} className="flex items-start gap-2 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-medium">
                          {member.displayName}
                        </span>
                        {member.memberType === 'agent' ? (
                          <Badge
                            variant="outline"
                            className="h-5 gap-1 text-[11px]"
                          >
                            <Bot className="h-3 w-3" />
                            Agen
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {ROLE_LABEL[member.role] ?? member.role}
                      </p>
                      {member.memberType === 'agent' && member.scopes.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {member.scopes.map((scope) => (
                            <Badge
                              key={scope}
                              variant="secondary"
                              className="h-5 font-mono text-[11px]"
                            >
                              {scope}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {canManage && member.role !== 'owner' ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          handleRemoveMember(member.id, member.displayName)
                        }
                        disabled={removeMember.isPending}
                        aria-label={`Keluarkan ${member.displayName}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {canManage ? (
            <>
              <Separator />
              <div className="px-4 py-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Tambah anggota
                </Button>
              </div>
            </>
          ) : null}
        </Card>
      </aside>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah anggota</DialogTitle>
            <DialogDescription>
              Orang dan agen dapat menjadi anggota ruang yang sama. Peran
              pengamat hanya bisa membaca.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="member-type">Jenis anggota</Label>
              <Select
                value={memberForm.memberType}
                onValueChange={(value) =>
                  setMemberForm({
                    ...memberForm,
                    memberType: value as 'agent' | 'user',
                    agentId: '',
                    userId: '',
                  })
                }
              >
                <SelectTrigger id="member-type" className="w-full">
                  <SelectValue placeholder="Jenis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agen</SelectItem>
                  <SelectItem value="user">Orang</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {memberForm.memberType === 'agent' ? (
              <div className="space-y-1.5">
                <Label htmlFor="member-agent">Agen</Label>
                <Select
                  value={memberForm.agentId}
                  onValueChange={(value) => {
                    setMemberForm({ ...memberForm, agentId: value });
                    setMemberError(null);
                  }}
                >
                  <SelectTrigger id="member-agent" className="w-full">
                    <SelectValue placeholder="Pilih agen" />
                  </SelectTrigger>
                  <SelectContent>
                    {!agents || agents.length === 0 ? (
                      <SelectItem value="-" disabled>
                        Belum ada agen
                      </SelectItem>
                    ) : (
                      agents.map((agent) => (
                        <SelectItem
                          key={agent.id}
                          value={agent.agentId}
                          disabled={agent.status !== 'active'}
                        >
                          {agent.name}
                          {agent.status !== 'active' ? ' (nonaktif)' : ''}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {!canViewAgents ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5" />
                    Anda tidak memiliki izin untuk melihat agen.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="member-user">Orang</Label>
                <Select
                  value={memberForm.userId}
                  onValueChange={(value) => {
                    setMemberForm({ ...memberForm, userId: value });
                    setMemberError(null);
                  }}
                >
                  <SelectTrigger id="member-user" className="w-full">
                    <SelectValue placeholder="Pilih orang" />
                  </SelectTrigger>
                  <SelectContent>
                    {!orgMembers || orgMembers.members.length === 0 ? (
                      <SelectItem value="-" disabled>
                        Belum ada anggota organisasi
                      </SelectItem>
                    ) : (
                      orgMembers.members.map((member) => (
                        <SelectItem key={member.userId} value={member.userId}>
                          {member.user.name ?? member.user.email}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="member-role">Peran</Label>
              <Select
                value={memberForm.role}
                onValueChange={(value) => setMemberForm({ ...memberForm, role: value })}
              >
                <SelectTrigger id="member-role" className="w-full">
                  <SelectValue placeholder="Peran" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Anggota</SelectItem>
                  <SelectItem value="observer">Pengamat</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {memberForm.memberType === 'agent' ? (
              <div className="space-y-1.5">
                <Label htmlFor="member-scopes">Scope (opsional)</Label>
                <Input
                  id="member-scopes"
                  value={memberForm.scopes}
                  onChange={(e) =>
                    setMemberForm({ ...memberForm, scopes: e.target.value })
                  }
                  placeholder="Pisahkan dengan koma, contoh: read, write"
                />
              </div>
            ) : null}

            {memberError ? (
              <p className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {memberError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={addMember.isPending}
            >
              Batal
            </Button>
            <Button onClick={handleAddMember} disabled={addMember.isPending}>
              {addMember.isPending ? 'Menyimpan...' : 'Tambah anggota'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}
