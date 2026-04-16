import { redirect } from 'next/navigation';

export default function ShopRootPage() {
  // No slug provided — redirect to plugins settings
  // Users should access shops via /shop/{slug} or custom domains
  redirect('/settings/plugins');
}
