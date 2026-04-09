'use client';

import { useState } from 'react';
import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Plus, Search, Archive, RotateCcw, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

const LIFECYCLE_COLORS: Record<string, string> = {
  lead: 'bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300',
  prospect: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  customer: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  churned: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newContact, setNewContact] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    jobTitle: '',
    companyId: undefined as string | undefined,
    lifecycleStage: undefined as string | undefined,
  });

  const { data: contacts, isLoading } = useAuthQuery(api.contacts.list, {
    search: search || undefined,
  });

  const createContact = useAuthMutation(api.contacts.create);
  const archiveContact = useAuthMutation(api.contacts.archive);
  const restoreContact = useAuthMutation(api.contacts.restore);

  const handleCreate = async () => {
    if (!newContact.email.trim()) {
      toast.error('Email is required');
      return;
    }
    try {
      await createContact.mutateAsync({
        firstName: newContact.firstName || undefined,
        lastName: newContact.lastName || undefined,
        email: newContact.email.trim(),
        phone: newContact.phone || undefined,
        jobTitle: newContact.jobTitle || undefined,
        lifecycleStage: newContact.lifecycleStage as any,
      });
      toast.success(`Contact created`);
      setNewContact({ firstName: '', lastName: '', email: '', phone: '', jobTitle: '', companyId: undefined, lifecycleStage: undefined });
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to create contact');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await archiveContact.mutateAsync({ id: id as any });
      toast.success('Contact archived');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to archive');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await restoreContact.mutateAsync({ id: id as any });
      toast.success('Contact restored');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to restore');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Contacts</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="First name"
                  value={newContact.firstName}
                  onChange={(e) => setNewContact({ ...newContact, firstName: e.target.value })}
                />
                <Input
                  placeholder="Last name"
                  value={newContact.lastName}
                  onChange={(e) => setNewContact({ ...newContact, lastName: e.target.value })}
                />
              </div>
              <Input
                placeholder="Email *"
                type="email"
                value={newContact.email}
                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
              />
              <Input
                placeholder="Phone"
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
              />
              <Input
                placeholder="Job title"
                value={newContact.jobTitle}
                onChange={(e) => setNewContact({ ...newContact, jobTitle: e.target.value })}
              />
              <Select
                value={newContact.lifecycleStage}
                onValueChange={(v) => setNewContact({ ...newContact, lifecycleStage: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Lifecycle stage" />
                </SelectTrigger>
                <SelectContent>
                  {['lead', 'prospect', 'customer', 'churned'].map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleCreate} className="w-full" disabled={createContact.isPending}>
                Create Contact
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search contacts..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !contacts?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">No contacts yet</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Add your first contact
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Last Touch</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact: any) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <Link href={`/contacts/${contact.id}`} className="font-medium hover:underline">
                      {contact.fullName}
                    </Link>
                    {contact.jobTitle && (
                      <p className="text-xs text-muted-foreground">{contact.jobTitle}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {contact.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    {contact.phone ? (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {contact.phone}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {contact.lifecycleStage ? (
                      <Badge variant="secondary" className={LIFECYCLE_COLORS[contact.lifecycleStage]}>
                        {contact.lifecycleStage}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {contact.lastTouchedDays !== null ? (
                      <Badge variant={contact.lastTouchStatus === 'green' ? 'secondary' : 'destructive'} className="text-xs">
                        {contact.lastTouchedDays}d ago
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">never</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleArchive(contact.id)}>
                      <Archive className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
