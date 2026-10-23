# Fase 2 — Ruang tim dan identitas agen

Status: dikerjakan di branch `feat/rooms-and-agents` pada repo `madearga/ruang`.

## Masalah

Fase 1 memberi kita ledger operasi: setiap efek yang ingin agen dusulkan, ditinjau manusia, lalu
dijalankan. Yang belum ada adalah tempat kerja tempat orang dan agen bertemu, dan identitas
agen yang jelas. Tanpa itu, ledger berdiri sendiri: keputusan dibaca di satu layar, sementara
diskusinya terjadi di chat lain.

## Model

### Ruang

| Field | Arti |
|---|---|
| `name`, `slug` | nama bebas dan alamat unik per organisasi |
| `kind` | `project` atau `department` |
| `visibility` | `open` (semua orang dalam organisasi) atau `private` (hanya anggota) |
| `archivedAt` | ruang yang ditutup tidak menerima pesan lagi |

### Anggota

Anggota bisa orang atau agen. Keduanya punya peran (`owner`, `member`, `observer`) dan daftar
scope. Orang adalah anggota dengan `userId`; agen adalah anggota dengan `agentId` dan nama
yang tampil sendiri.

### Agen

| Field | Arti |
|---|---|
| `agentId` | kunci stabil per organisasi, mis. `nara` |
| `name`, `description`, `model` | identitas dan model yang dikehendaki |
| `status` | `active` atau `disabled` |
| `scopes` | hak bawaan: `read`, `write`, `approve`, atau bentuk terikat sumber daya `inventory:read` |

**Agen bukan akun pengguna.** Ia tidak pernah masuk, tidak punya sesi, dan tidak memiliki
organisasi. Yang ia punya adalah nama, ruang, dan scope.

### Pesan

`kind` membedakan empat hal: `message` (ucapan biasa), `proposal` (usulan operasi), `decision`
(keputusan manusia atas sebuah operasi), dan `system`. Penulisnya bisa orang atau agen, dan
`operationId` menautkan pesan ke entri ledger-nya.

## Aturan yang ditegakkan server

- Organisasi selalu dari konteks sesi, tidak pernah dari argumen.
- Ruang privat hanya terlihat oleh anggotanya. Ruang terbuka terlihat oleh seluruh organisasi.
- `observer` membaca tetapi tidak menulis. Scope yang tidak kosong juga berlaku: anggota dengan
  scope `read` saja tetap pembaca.
- Untuk agen, scope anggota ruang menang; scope agen sendiri adalah cadangan.
- Agen yang dinonaktifkan, yang bukan anggota ruang, atau yang tidak boleh menulis, tidak dapat
  menulis pesan sama sekali.
- `propose` dan `decide` menulis ke ruangnya: proposal sebagai `proposal`, keputusan sebagai
  `decision` dengan orang yang menyetujui sebagai penulis.
- `postFromAgent` hanya menerima jenis `proposal` dan `system` tanpa kunci agen, supaya percakapan
  tidak pernah bisa berasal dari agen yang belum diperiksa keanggotaannya.

## Izin

| Fitur | Aksi | Boleh |
|---|---|---|
| `rooms` | `view` | membaca ruang, anggota, pesan |
| `rooms` | `create` | membuat ruang, menulis pesan |
| `rooms` | `manage` | mengubah ruang, mengelola anggota, mengarsipkan |
| `agents` | `view` | membaca agen |
| `agents` | `create` | membuat agen |
| `agents` | `manage` | mengubah dan menonaktifkan agen |

Member tidak memiliki entri apa pun untuk dua fitur ini, jadi aksesnya tertutup sampai template
memberikan. Owner melewati pemeriksaan.

## Batas yang diketahui

- **Kegagalan menulis ke ruang tidak membatalkan operasi.** Bila ruang menolak pesan proposal,
  operasinya tetap ada dan pesan hilang diam-diam. Yang tersisa adalah `operationId` pada
  operasi dan pada pesan, jadi celah itu bisa diperbaiki dengan penyelarasan ulang. Fungsi
  penyelarasan belum ada dan menjadi pekerjaan Fase 3.
- **Belum ada agen yang berpikir.** `postFromAgent` menerima pesan dari agen, tetapi yang
  memanggilnya runtime durable di Vercel. Sampai runtime itu ada, ruang diisi manusia dan ledger
  diisi operasi.
- **Satu organisasi per ruang.** Ruang dan agen selalu milik satu organisasi; tidak ada ruang
  lintas organisasi.
- **Belum ada reaksi, lampiran, atau thread yang bersarang.** Sebuah pesan boleh membalas satu
  pesan lain, dan itu saja.

## Verifikasi sebelum produksi

- Ruang privat tidak terlihat oleh orang luar.
- Orang yang hanya `observer` tidak dapat menulis.
- Agen yang dinonaktifkan tidak dapat menulis ke ruangnya.
- Agen yang bukan anggota ruang tidak dapat menulis.
- Proposal dan keputusan muncul di ruang yang benar, dengan penulis yang benar.
- Operasi yang diarsipkan tidak lagi menerima pesan.
- Akses lintas organisasi ditolak di setiap fungsi.
