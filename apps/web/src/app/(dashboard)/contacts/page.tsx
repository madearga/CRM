'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthPaginatedQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Users, Plus, Search } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { NoResults } from '@/components/no-results';
import { DataTable, DataTableSkeleton } from '@/components/data-table';
import { FloatingSelectionBar } from '@/components/floating-selection-bar';
import { getColumns, type ContactRow } from './columns';
import { useContactsParams } from '@/hooks/use-contacts-params';
import { useTableStore } from '@/store/table-store';
import { toast } from 'sonner';

export default function ContactsPage() {
  const router = useRouter();
  const { q: search, setSearch } = useContactsParams();
  const { selections, toggleOne, toggleAll, clearSelection } = useTableStore();
  const selectedIds = selections.contacts ?? new Set();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newContact, setNewContact] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    jobTitle: '', companyId: undefined as string | undefined,
    lifecycleStage: undefined as string | undefined,
  });

  const { data: contacts, isLoading } = useAuthPaginatedQuery(api.contacts.list, {
    search: search || undefined,
  }, { initialNumItems: 50 });

  const createContact = useAuthMutation(api.contacts.create);
  const archiveContact = useAuthMutation(api.contacts.archive);

  const rows: ContactRow[] = useMemo(() =>
    (contacts ?? []).map((c: any) => ({
      id: c.id, fullName: c.fullName, email: c.email, phone: c.phone,
      jobTitle: c.jobTitle, image: c.image, lifecycleStage: c.lifecycleStage,
      lastTouchedDays: c.lastTouchedDays, lastTouchStatus: c.lastTouchStatus,
    })),
    [contacts],
  );

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const toggleOneContact = useCallback((id: string) => toggleOne("contacts", id), [toggleOne]);
  const toggleAllContacts = useCallback(() => toggleAll("contacts", allIds), [toggleAll, allIds]);

  const columns = useMemo(
    () => getColumns({
      selectedIds,
      toggleOne: toggleOneContact,
      allIds,
      toggleAll: toggleAllContacts,
    }),
    [selectedIds, toggleOneContact, allIds, toggleAllContacts],
  );

  const handleCreate = async () => {
    if (!newContact.email.trim()) { toast.error('Email is required'); return; }
    try {
      await createContact.mutateAsync({
        firstName: newContact.firstName || undefined, lastName: newContact.lastName || undefined,
        email: newContact.email.trim(), phone: newContact.phone || undefined,
        jobTitle: newContact.jobTitle || undefined, lifecycleStage: newContact.lifecycleStage as any,
      });
      toast.success('Contact created');
      setNewContact((p) => ({ ...p, firstName: '', lastName: '', email: '', phone: '', jobTitle: '', companyId: undefined, lifecycleStage: undefined }));
      setDialogOpen(false);
    } catch (e: any) { toast.error(e.data?.message ?? 'Failed to create contact'); }
  };

  const handleBulkArchive = async () => {
    const ids = [...selectedIds];
    const results = await Promise.allSettled(ids.map((id) => archiveContact.mutateAsync({ id: id as any })));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed === 0) toast.success(`${ids.length} ${ids.length === 1 ? 'contact' : 'contacts'} archived`);
    else toast.error(`Archived ${ids.length - failed}/${ids.length}. ${failed} failed.`);
    clearSelection("contacts");
  };

  return (
    <div className="space-y-4">
      {/* Add */}
      <div className="flex items-center justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" />Add Contact</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="First name" value={newContact.firstName} onChange={(e) => setNewContact((p) => ({ ...p, firstName: e.target.value }))} />
                <Input placeholder="Last name" value={newContact.lastName} onChange={(e) => setNewContact((p) => ({ ...p, lastName: e.target.value }))} />
              </div>
              <Input placeholder="Email *" type="email" value={newContact.email} onChange={(e) => setNewContact((p) => ({ ...p, email: e.target.value }))} />
              <Input placeholder="Phone" value={newContact.phone} onChange={(e) => setNewContact((p) => ({ ...p, phone: e.target.value }))} />
              <Input placeholder="Job title" value={newContact.jobTitle} onChange={(e) => setNewContact((p) => ({ ...p, jobTitle: e.target.value }))} />
              <Select value={newContact.lifecycleStage} onValueChange={(v) => setNewContact((p) => ({ ...p, lifecycleStage: v }))}>
                <SelectTrigger><SelectValue placeholder="Lifecycle stage" /></SelectTrigger>
                <SelectContent>
                  {['lead', 'prospect', 'customer', 'churned'].map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleCreate} className="w-full" disabled={createContact.isPending}>Create Contact</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search contacts..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      {isLoading ? (
        <DataTableSkeleton columns={[
          { type: "checkbox" }, { type: "avatar-text", width: "w-28" },
          { type: "text", width: "w-28" }, { type: "text", width: "w-20" },
          { type: "badge" }, { type: "text", width: "w-16" }, { type: "icon" },
        ]} />
      ) : search && !rows.length ? (
        <NoResults searchQuery={search} onClear={() => setSearch('')} />
      ) : !rows.length ? (
        <EmptyState
          icon={<Users className="size-7" />} title="No contacts yet"
          description="Start building your network by adding contacts."
          action={<Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}><Plus className="mr-1 h-4 w-4" />Add your first contact</Button>}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          onRowClick={(row) => router.push(`/contacts/${row.id}`)}
          rowClassName={(row) => selectedIds.has(row.id) ? 'bg-muted/30' : undefined}
        />
      )}

      {/* Floating Selection Bar */}
      <FloatingSelectionBar
        count={selectedIds.size}
        onClear={() => clearSelection("contacts")}
        onArchive={handleBulkArchive}
      />
    </div>
  );
}
