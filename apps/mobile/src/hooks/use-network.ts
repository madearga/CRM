/**
 * Global network state hook.
 *
 * Thin re-export of {@link useNetwork} from the network provider so screens
 * and components import from `@/hooks/*` consistently.
 */
export { useNetwork } from '@/providers/network-provider';
export type { NetworkContextValue } from '@/providers/network-provider';
