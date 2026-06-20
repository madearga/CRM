## 1. E-Commerce Guest Access

- [x] 1.1 Fix guest payment status access — sudah ada token verification via `verifyOrderAccessToken` di `checkPaymentStatus` (`checkout.ts`)
- [x] 1.2 Fix guest order detail access — sudah ada `verifyOrderOwnership` yang fallback ke `verifyOrderAccessToken` (`orders.ts`)
- [x] 1.3 Fix guest user cancel own order — sudah ada token + state validation di `cancelOrder` (`checkout.ts`)

## 2. Cart Security

- [x] 2.1 Cart mutations authenticated — public mutations dengan `requireGuestMutationSession` + `requireCartAccess` + `guestRateLimitGuard` sudah secure untuk storefront guest flow (`cart.ts`)
- [x] 2.2 Cross-tenant cart scoping — semua query sudah pakai `organizationId` filter via indexed lookups (`cart.ts`, `checkout.ts`)
- [x] 2.3 Rate limiting cart mutations — ditambahkan `guestRateLimitGuard` ke `clearCart` dan `mergeGuestCart` (sebelumnya missing) (`cart.ts`)

## 3. Checkout Hardening

- [x] 3.1 Validate product-organization saat checkout — ditambahkan check `product.organizationId !== orgId` di loop cart items (`checkout.ts`)
- [x] 3.2 Fix webhook order processing — ditambahkan validasi `!orgId` setelah find order by `orderNumber` (`checkout.ts`)
- [x] 3.3 Rate limiting pada `initiateCheckout` — sudah ada sejak awal (`checkout.ts`)
- [x] 3.4 Tambahkan permission check di `updateOrderStatus` — hanya admin/owner yang boleh ubah status (`orders.ts`)
- [x] 3.5 Tambahkan idempotency check di `updateOrderStatus` — repeated cancel/expire jangan inflate stock (`orders.ts`)
- [x] 3.6 Fix cancel order button — sudah benar memanggil `cancelOrder.mutateAsync({ orderId: order.id, orderAccessToken })` (`page.tsx`)
- [x] 3.7 Fix review approve/reject mutation — tidak ada review approve/reject di storefront (admin feature di dashboard terpisah) (`page.tsx`)

## 4. Product Data Protection

- [x] 4.1 Sanitize public product endpoint — hide internal fields (cost, notes, SKU, barcode) dari unauthorized users (`products.ts`)
- [x] 4.2 Fix checkOrg timing leak — sudah pakai `Promise.all` untuk org + products + pluginInstances queries secara paralel; response shape konsisten terlepas org exists atau tidak (`products.ts`)
- [x] 4.3 Fix stored XSS — sudah pakai `sanitizePublicUrl` yang hanya allow `http:` dan `https:` protocol, block `javascript:` (`page.tsx`)

## 5. Infrastructure Secrets & Injection

- [x] 5.1 Add `**/pi-session-*.html` ke `.gitignore` — remove committed session files dari VCS
- [x] 5.2 Fix webhook server key — validasi `SERVER_KEY` tidak empty pada startup (`index.ts`)
- [x] 5.3 Fix command injection di `sync-convex-env.ts` — sanitize .env values sebelum interpolasi ke execSync
