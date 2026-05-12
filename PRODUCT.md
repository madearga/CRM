# Product

## Register

product

## Users

Campuran — CRM ini melayani dua spektrum:

- **Personal / small team**: Individu atau tim kecil (2-10 orang) yang mengelola deals, contacts, dan invoices harian. Mereka butuh kecepatan dan kesederhanaan — bukan fitur yang disembunyikan di balik 3 level menu.
- **Multi-org tenant**: Organisasi/perusahaan yang menyewa instance CRM untuk tim sales/operasional mereka. Tiap org punya data, anggota tim, dan konfigurasi terpisah.

Konteks penggunaan: kerja harian di desktop/laptop, sesi panjang (1-8 jam). Primary task: track pipeline deals, kelola kontak, buat invoice, pantau revenue.

## Product Purpose

CRM all-in-one yang menggabungkan sales pipeline, contact management, invoicing, HR, dan AI assistance dalam satu tempat. Tujuannya: mengurangi lompatan antar tools (spreadsheet → invoicing app → email → chat) dengan satu sistem yang terintegrasi.

Success: user bisa menyelesaikan workflow end-to-end (dari lead → deal → invoice → payment) tanpa buka aplikasi lain.

## Brand Personality

**Efisien, Profesional, Bersih** — vibe Linear / Stripe.

- **Efisien**: Setiap interaksi harus terasa cepat. Tidak ada langkah ekstra, tidak ada loading state yang tidak perlu, tidak ada konfirmasi dialog untuk aksi yang jelas.
- **Profesional**: Terpercaya dan serius. Data akurat, tampilan presisi. Bukan playful atau kasual — ini tools bisnis.
- **Bersih**: UI yang tenang dan fokus. Tidak ada dekorasi tanpa fungsi. Whitespace adalah fitur, bukan kekosongan.

## Anti-references

- **Dashboard SaaS generik**: metric cards + sidebar biru-putih + tabel standar — template look yang bisa ditebak.
- **Over-designed / playful**: animasi berlebihan, warna neon, glassmorphism dekoratif, border-radius gede di mana-mana.
- **Enterprise bloat**: UI seperti Salesforce atau Zoho — terlalu rame, fitur numpuk, hierarki menu dalam, form dengan 40 field dalam satu layar.
- **AI slop aesthetic**: gradien ungu-biru generik, ilustrasi robot kartun, "✨ AI-powered ✨" badge tanpa makna.

## Design Principles

1. **Efficiency first** — Setiap klik, scroll, dan ketikan harus menghasilkan value. Hapus langkah yang tidak perlu. Default ke aksi paling umum, jangan paksa user memilih setiap kali.

2. **Professional clarity** — Data ditampilkan dengan presisi. Angka, tanggal, dan status tidak ambigu. Typography yang bersih dan readable. Tidak ada decorative fluff.

3. **Reduce cognitive load** — Layar tidak boleh rame. Informasi di-prioritaskan: yang penting di depan, yang jarang dipakai di belakang. Progressive disclosure, bukan all-at-once.

4. **Consistent but not monotonous** — Komponen yang sama berperilaku sama di seluruh app. Tapi tiap halaman punya karakter sendiri — dashboard beda ritme dengan form detail, list beda dengan editor.

5. **Data-dense, not data-dump** — Tabel dan list boleh padat, tapi harus terstruktur dengan jelas. Gunakan whitespace, alignment, dan subtle separators — bukan grid tebal dan zebra stripes.

## Accessibility & Inclusion

- Target WCAG 2.1 AA untuk contrast dan keyboard navigation.
- Support `prefers-reduced-motion` untuk user yang sensitif terhadap animasi.
- Pastikan semua interactive element bisa dijangkau via keyboard (tab order, focus visible).
- Form error tidak hanya mengandalkan warna (ikon + teks, bukan border merah saja).
