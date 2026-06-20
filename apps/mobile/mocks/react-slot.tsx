/**
 * Stub for `@radix-ui/react-slot`.
 *
 * `@radix-ui/react-slot` is a web-only package that `expo-router@5.1.11` happens
 * to `require()` in its `build/ui/Slot.js` (a vestigial web shim). On React
 * Native the actual `Slot` runtime we care about is Expo Router's own RN
 * implementation; this file is never called at runtime by a mobile build.
 *
 * Still, Metro's resolver insists on finding the module because
 * `expo-router/build/ui/Slot.js` references it directly. The Metro
 * `resolveRequest` hook in `metro.config.js` rewrites `@radix-ui/react-slot`
 * to THIS file so the build succeeds. On web the real package would be used
 * (apps/web imports the real `@radix-ui/react-slot`), so this stub is mobile-
 * only and harmless.
 *
 * Shape: `<Slot/>` in `@radix-ui/react-slot` forwards children and slots props
 * onto the immediate child. The simplest correct behaviour for a hello-world
 * is to render nothing extra — a no-op component.
 */
import * as React from "react";

const Slot = ({ children }: { children?: React.ReactNode }) => children as React.ReactElement | null;

export const Root = Slot;
export default Slot;
