import { redirect } from 'next/navigation';

export default function ShopRootPage() {
  // No slug provided — redirect to dashboard settings
  redirect('/settings/plugins');
}
