'use client';

import { useAuthQuery } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, FileText } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/lib/format-money';

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: template, isLoading } = useAuthQuery(api.quotationTemplates.getById, { id: id as any });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!template) {
    return <div className="text-muted-foreground">Template not found.</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/templates')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
            <FileText className="size-4" />
          </div>
          <h2 className="text-lg font-semibold">{template.name}</h2>
          {template.isDefault && (
            <Badge variant="secondary" className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">Default</Badge>
          )}
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/templates/${id}/edit`}>
              <Edit className="mr-1 h-4 w-4" />Edit
            </Link>
          </Button>
        </div>
      </div>

      {template.description && (
        <p className="text-muted-foreground">{template.description}</p>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Line Items</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left">Product</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Unit Price</th>
                  <th className="px-3 py-2 text-right">Discount</th>
                  <th className="px-3 py-2 text-right">Tax</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {template.lines.map((line) => (
                  <tr key={line.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{line.productName}</td>
                    <td className="px-3 py-2 text-right">{line.quantity}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(line.unitPrice)}</td>
                    <td className="px-3 py-2 text-right">{line.discount ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{line.taxAmount ? formatMoney(line.taxAmount) : '—'}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatMoney(line.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {(template.internalNotes || template.customerNotes || template.terms) && (
        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Notes & Terms</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {template.customerNotes && (
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-1">Customer Notes</p>
                <p className="text-sm">{template.customerNotes}</p>
              </div>
            )}
            {template.internalNotes && (
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-1">Internal Notes</p>
                <p className="text-sm">{template.internalNotes}</p>
              </div>
            )}
            {template.terms && (
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-1">Terms</p>
                <p className="text-sm">{template.terms}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
