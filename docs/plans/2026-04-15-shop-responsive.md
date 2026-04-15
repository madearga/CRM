# Responsive Toko Online — Design Spec

## Scope
Semua halaman `/shop/*` agar responsive di mobile (375px+), tablet (768px+), dan desktop (1024px+).

## Sudah OK (tidak diubah)
- Navbar: hamburger menu mobile, search collapsible
- Product grid: 2/3/4 kolom responsive
- Product filters: bottom sheet mobile
- Footer: stack mobile, row desktop
- Homepage kategori: grid 2 kolom

## Perubahan

### 1. Detail Produk `/shop/products/[id]`
- Mobile: gambar full-width, info stack di bawah
- Sticky bottom CTA: tombol "Add to Cart" + harga selalu terlihat
- Desktop: 2 kolom (gambar | info) tetap

### 2. Cart `/shop/cart`
- Sticky bottom: total harga + tombol "Checkout" selalu terlihat
- Item list scroll di atas tanpa terhalang summary

### 3. Checkout `/shop/checkout`
- Mobile: form single column, ringkasan + tombol "Bayar" sticky bottom
- Desktop: 2 kolom (form | ringkasan)

### 4. Homepage `/shop`
- Hero text size kecil di mobile (`text-2xl` → `text-3xl` di mobile, `text-5xl` desktop)
- Product card padding sedikit longgar di mobile

## Files to modify
- `apps/web/src/app/shop/products/[id]/page.tsx`
- `apps/web/src/app/shop/cart/page.tsx`
- `apps/web/src/app/shop/checkout/page.tsx`
- `apps/web/src/app/shop/page.tsx`
- `apps/web/src/components/shop/product-card.tsx`
