import { Badge } from '@/components/ui/badge';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  pending_payment: { label: 'Pending Payment', variant: 'outline', className: 'border-yellow-500 text-yellow-700 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950' },
  paid: { label: 'Paid', variant: 'outline', className: 'border-blue-500 text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-950' },
  processing: { label: 'Processing', variant: 'outline', className: 'border-purple-500 text-purple-700 bg-purple-50 dark:text-purple-400 dark:bg-purple-950' },
  shipped: { label: 'Shipped', variant: 'outline', className: 'border-cyan-500 text-cyan-700 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-950' },
  delivered: { label: 'Delivered', variant: 'outline', className: 'border-green-500 text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950' },
  cancelled: { label: 'Cancelled', variant: 'destructive', className: '' },
  expired: { label: 'Expired', variant: 'secondary', className: 'text-gray-500' },
};

export function OrderStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? {
    label: status,
    variant: 'outline' as const,
    className: '',
  };

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
