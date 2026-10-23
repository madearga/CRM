'use client';

// The icon entry point for the Ruang surfaces. Icons resolve through
// Iconify: `lucide:*` today (the same vectors the app used before, so the
// swap is invisible), and any other Iconify collection later by changing
// the name — that is the reason this indirection exists.
//
// Iconify loads icon data on demand and caches it; a production build of
// the app should pin the used collection offline before shipping.

import { Icon, type IconProps } from '@iconify/react';

export type RuangIconName =
  | 'lucide:circle-alert'
  | 'lucide:archive'
  | 'lucide:arrow-left'
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
