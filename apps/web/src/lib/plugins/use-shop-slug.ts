'use client';

import { useParams } from 'next/navigation';
import { usePublicQuery } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';

/** Hook to get the current shop slug from URL params */
export function useShopSlug() {
  const { slug } = useParams<{ slug: string }>();
  return slug;
}

/** Hook to resolve slug → plugin instance with orgId */
export function useShopPlugin(slug: string) {
  return usePublicQuery(api.plugins.getBySlug, { publicSlug: slug });
}
