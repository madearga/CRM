'use client';

// The icon entry point for the Ruang surfaces.
//
// Icons resolve through Iconify. The `lucide:*` set is bundled with the app
// (see icon-data.ts), so a page renders its icons with no network call and
// keeps working offline; any other Iconify collection can be added by name.
//
// Iconify loads a collection on demand and caches it. A bundled collection
// is registered once, on the client, before any icon renders.

import { Icon, addCollection, type IconProps } from '@iconify/react';

import { RUANG_ICONS } from './icon-data';

// Register once, at module scope: the bundle is part of the app, so no icon
// ever waits for a network request. addCollection is a no-op on the server.
if (typeof window !== 'undefined') {
  addCollection(RUANG_ICONS);
}

export type RuangIconName =
  | 'lucide:circle-alert'
  | 'lucide:archive'
  | 'lucide:arrow-left'
  | 'lucide:arrow-right'
  | 'lucide:bot'
  | 'lucide:info'
  | 'lucide:lock'
  | 'lucide:plus'
  | 'lucide:send'
  | 'lucide:user-plus'
  | 'lucide:users'
  | 'lucide:loader-circle'
  | 'lucide:trash-2'
  | 'lucide:clock'
  | 'lucide:circle-check-big'
  | 'lucide:circle-dot'
  | 'lucide:circle-help'
  | 'lucide:circle-x';

export function RuangIcon({
  name,
  className,
}: {
  name: RuangIconName;
  className?: string;
}) {
  return <Icon icon={name} className={className} aria-hidden="true" />;
}

export { Icon as IconifyIcon };
export type { IconProps };
