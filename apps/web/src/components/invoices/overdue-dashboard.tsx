'use client';

import { useAuthQuery } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, DollarSign, FileText, TrendingUp } from 'lucide-react';
import { formatMoney } from '@/lib/format-money';
import Link from 'next/link';

export function OverdueDashboard() {
  const { data: summary, isLoading: loadingSummary } = useAuthQuery(
    api.invoiceReminders.overdueSummary,
    {}
  );
  const { data: overdueInvoices, isLoading: loadingInvoices } = useAuthQuery(
    api.invoiceReminders.checkOverdue,
    {}
  );

  if (loadingSummary || loadingInvoices) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const cards = [
    { label: 'Total Overdue', value: summary?.totalOverdue ?? 0, count: summary?.totalInvoices ?? 0, icon: DollarSign, color: 'text-red-600 dark:text-red-400' },
    { label: '0–30 days', value: summary?.bucket030 ?? 0, icon: Clock, color: 'text-amber-600 dark:text-amber-400' },
    { label: '31–60 days', value: summary?.bucket3160 ?? 0, icon: Clock, color: 'text-orange-600 dark:text-orange-400' },
    { label: '61–90 days', value: summary?.bucket6190 ?? 0, icon: AlertTriangle, color: 'text-red-600 dark:text-red-400' },
    { label: '90+ days', value: summary?.bucket90plus ?? 0, icon: TrendingUp, color: 'text-red-800 dark:text-red-300' },
  ];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <card.icon className="size-3.5" />
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-lg font-bold ${card.color}`}>
                {formatMoney(card.value)}
              </p>
              {card.count != null && (
                <p className="text-xs text-muted-foreground">{card.count} invoices</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Overdue Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider">Overdue Invoices</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!overdueInvoices?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No overdue invoices</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Days Overdue</TableHead>
                  <TableHead className="text-right">Amount Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueInvoices.map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link href={`/invoices/${inv.id}`} className="font-medium text-blue-600 hover:underline">
                        {inv.number}
                      </Link>
                    </TableCell>
                    <TableCell>{inv.companyName ?? '—'}</TableCell>
                    <TableCell>{new Date(inv.dueDate).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={inv.daysOverdue > 60 ? 'destructive' : inv.daysOverdue > 30 ? 'secondary' : 'outline'}>
                        {inv.daysOverdue}d
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-red-600 dark:text-red-400">
                      {formatMoney(inv.amountDue, inv.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
