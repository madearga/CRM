# Fase 1 — Persetujuan dan ledger operasi agen

Status: dikerjakan di repo `madearga/ruang` (versi baru dari `madearga/CRM`).

## Masalah

AI chat sekarang (`convex/aiChat.ts`) berjalan sebagai `httpAction` di dalam Convex. Ia memanggil
tool yang langsung mengubah data, tanpa perantara manusia dan tanpa jejak yang bisa diaudit
sebagai "operasi". Bila aksi mati di tengah jalan, tidak ada yang tahu efeknya sudah terjadi
atau belum.

## Sasaran fase ini

1. Setiap-effect yang Linking an agent proposes tercatat sebagai **operation** dengan identitas
   idempoten, payload kanonis, dan status.
2. Effect yang sensitif harus **disetujui manusia** sebelum dijalankan.
3. Approval terikat pada **payload dan revisi**: kalau payload berubah, approval lama tidak
   berlaku.
4. **Idempoten**: menjalankan ulang operasi yang sama tidak menghasilkan efek ganda.
5. Status **`unknown`** tersedia untuk kasus "tidak tahu apakah efeknya terjadi", supaya ada
   yang bisa diperiksa manusia, bukan diulang buta.

## Model data

Dua tabel baru, keduanya per organisasi.

`agentOperations`
| Field | Arti |
|---|---|
| `organizationId` | pemilik data, selalu scoping |
| `kind` | jenis operasi, mis. `create_activity` |
| `status` | `pending`, `awaiting_approval`, `executing`, `succeeded`, `failed`, `unknown`, `rejected` |
| `requiresApproval` | apakah humans harus menyetujui |
| `idempotencyKey` | kunci unik per organisasi untuk operasi yang sama |
| `payloadHash` | sidik jari cepat payload (bukan primitif keamanan) |
| `payloadJson` | payload kanonis; ini yang dibandingkan saat eksekusi |
| `revision` | naik setiap payload berubah |
| `requestedByUserId` | manusia yang meminta |
| `agentId`, `agentLabel` | agen yang mengusulkan |
| `approvalId` | approval yang terkait |
| `resultJson`, `errorMessage` | hasil atau alasan gagal |
| `attempts`, `startedAt`, `finishedAt`, `expiresAt` | jejak eksekusi |

`approvals`
| Field | Arti |
|---|---|
| `organizationId`, `operationId` | scoping dan relasi |
| `status` | `pending`, `approved`, `rejected`, `expired` |
| `payloadHash`, `payloadJson`, `revision` | snapshot yang disetujui |
| `requestedByUserId`, `approverUserId` | siapa meminta, siapa memutuskan |
| `decidedAt`, `expiresAt`, `comment` | waktu dan alasan |

`agentOperationEffects`
| Field | Arti |
|---|---|
| `organizationId`, `operationKey` | kunci idempoten operasi dan organizasinya |
| `operationId` | operasi yang menyebabkan efek itu |
| `kind` | jenis efek, mis. `create_activity` |
| `effectId` | id dokumen yang dibuat |
| `createdAt` | waktu efek |

Tabel efek ini yang membuat efeknya sendiri idempoten: pencaru efek melihat kunci operasi lebih dulu, jadi eksekusi berulang, atau operasi kedua dengan kunci sama, memakai efek yang sudah ada dan tidak menghasilkan efek kedua. Pencarian dan penulisan efek berada dalam satu transaksi, jadi dua eksekusi bersamaan tidak bisa sama-sama menulis.

## Alur

```
propose  → status awaiting_approval (butuh approval) atau pending
decide   → approved: status pending | rejected: status rejected
execute  → claim (executing) → jalankan handler → succeeded | failed | unknown
```

Aturan yang ditegakkan server:

- `propose` dengan `idempotencyKey` yang sudah ada dan payload berbeda → ditolak (`CONFLICT`).
  Payload sama → operasi lama dikembalikan, tanpa efek baru.
- `execute` hanya jalan saat status `pending` dan, bila ada, approval masih berlaku:
  `approved`, hash cocok, payload kanonis cocok, belum kedaluwarsa.
- `execute` pada operasi yang sudah `succeeded` mengembalikan hasil yang tersimpan.
- Perubahan status mengikuti tabel transisi di `packages/domain/src/agentOperations.ts`.
- `create_activity` menulis lewat `createActivityOnce`, yang menulis aktivitas dan catatan efek
  dalam satu transaksi. Efek yang sama tidak pernah terjadi dua kali.
- `update_deal_stage` idempoten secara alami: menetapkan tahap yang sama dua kali
  meninggalkan transaksi yang sama.

Batas yang diketahui: dua `propose` dengan kunci yang sama bisa tiba bersamaan dan membuat
dua operasi, karena Convex tidak punya batasan unik. Dampaknya dibatasi: kedua operasi
memakai kunci efek yang sama, jadi hanya satu efek yang terjadi. Lapisan runtime (Fase 3)
juga harus mengirim satu permintaan per kunci, bukan beberapa.

## Izin

Feature baru `agents` dengan aksi `view`, `create`, `manage`:

| Aksi | Izin |
|---|---|
| melihat operasi dan approval | `agents:view` |
| mengusulkan operasi | `agents:create` |
| menyetujui, menolak, menjalankan | `agents:manage` |

Member tidak punya entri, jadi aksesnya ditolak sampai template权限 diberikan. Owner
melewati pemeriksaan. Penambahan feature ini butuh label UI di halaman permission matrix
(fase lanjutan).

## Batas fase ini

- Tidak ada runtime agent durable. `convex/aiChat.ts` masih berjalan seperti sekarang.
- Tidak ada ruang tim.，里面 belum ada konsep agent sebagai anggota.
- `unknown` diisi manual, belum ada reconciliation worker.
- Audit trail memakai `auditLogs` yang sudah ada; penulisan entri audit untuk operasi
  ditambahkan pada fase berikutnya.
- Kode yang dibuat agen belum boleh mengubah produksi. Modul dinamis belum termasuk fase ini.

## Verifikasi sebelum produksi

- Akses lintas organisasi ditolak.
- Approval kedaluwarsa tidak berlaku.
- Payload yang berubah setelah approval tidak dapat dieksekusi.
- `propose` dua kali dengan kunci sama menghasilkan satu operasi.
- `execute` dua kali tidak menghasilkan dua efek.
- Dua operasi dengan kunci efek yang sama hanya menghasilkan satu efek.
- Pembatalan dan efek eksternal yang tidak diketahui ditangani sebagai `unknown`, bukan
  diulang.
