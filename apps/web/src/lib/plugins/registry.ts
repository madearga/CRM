import {
  ShoppingBag,
  Package,
  CreditCard,
  Settings,
} from 'lucide-react';
import type { CRMPlugin } from './types';

export const PLUGINS: CRMPlugin[] = [
  {
    id: 'ecommerce',
    name: 'Toko Online',
    description: 'Jual produk online, terima pembayaran, kelola pesanan',
    icon: ShoppingBag,
    version: '1.0.0',
    routePrefix: 'shop',
    navItems: [
      { label: 'Produk', href: '/products/manage', icon: Package },
      { label: 'Pesanan', href: '/shop-orders', icon: ShoppingBag },
      { label: 'Pembayaran', href: '/payments', icon: CreditCard },
      { label: 'Pengaturan Toko', href: '/settings/shop', icon: Settings },
    ],
    settings: [
      {
        key: 'isActive',
        label: 'Toko Aktif',
        type: 'boolean',
        default: false,
      },
      {
        key: 'currency',
        label: 'Mata Uang',
        type: 'select',
        default: 'IDR',
        options: [
          { label: 'IDR (Rupiah)', value: 'IDR' },
          { label: 'USD (Dollar)', value: 'USD' },
        ],
      },
      {
        key: 'midtransClientKey',
        label: 'Midtrans Client Key',
        type: 'secret',
      },
      {
        key: 'midtransServerKey',
        label: 'Midtrans Server Key',
        type: 'secret',
      },
    ],
  },
];

export function getPlugin(id: string): CRMPlugin | undefined {
  return PLUGINS.find((p) => p.id === id);
}
