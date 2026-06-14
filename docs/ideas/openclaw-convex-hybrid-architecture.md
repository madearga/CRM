# OpenClaw + Convex Hybrid Architecture

## Problem Statement

> How might we connect a WhatsApp AI Agent to an existing CRM Dashboard so that leads from chat automatically flow into the scheduling, patient tracking, and follow-up systems — without rebuilding what's already working?

## Recommended Direction: "Convex-First Hybrid"

OpenClaw acts as the **WhatsApp gateway and AI brain**. Convex acts as the **single source of truth** for all business logic, data, and scheduling. The existing Next.js Dashboard remains the **admin interface**.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CUSTOMER (WhatsApp)                          │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│  OpenClaw Gateway (VPS)                                             │
│  ───────────────────────                                            │
│  • WhatsApp Baileys plugin                                          │
│  • AI Agent (Kimi K2.6)                                             │
│  • Skills: kuesioner, booking, followup                             │
│  • Tools: exec (curl) → Convex HTTP API                             │
│  • Cron: check follow-ups daily                                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ curl / fetch
┌──────────────────────────────▼──────────────────────────────────────┐
│  Convex Backend (Cloud)                                             │
│  ───────────────────────                                            │
│  • HTTP Actions (public API for Agent)                              │
│  • Cron Jobs (follow-up scheduler)                                  │
│  • Database Tables (leads, bookings, patients, therapists)          │
│  • Internal Actions (dashboard queries, reports)                    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ WebSocket / HTTP
┌──────────────────────────────▼──────────────────────────────────────┐
│  Next.js Dashboard (Vercel)                                         │
│  ─────────────────────────                                          │
│  • CRM (companies, contacts, deals — EXISTS)                        │
│  • Scheduling (appointments, therapists, branches — NEW)            │
│  • Invoice & Payment (EXISTS)                                       │
│  • Analytics (EXISTS + NEW metrics)                                 │
│  • Real-time updates via Convex useQuery                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. Customer sends WhatsApp message
   ↓
2. OpenClaw receives → AI processes with skill prompt
   ↓
3. AI calls Convex HTTP API via exec curl
   ↓
4. Convex stores data, triggers crons, returns result
   ↓
5. AI formats response → sends back to WhatsApp
   ↓
6. Dashboard reflects change instantly (Convex realtime)
```

## Key Assumptions to Validate

- [ ] **Assumption 1:** OpenClaw `exec` tool can reliably call Convex HTTP API (test: 100 calls, <2s latency)
  - *Test:* Create a test Convex HTTP endpoint, call it 100x from OpenClaw skill
- [ ] **Assumption 2:** Convex crons are reliable enough for follow-up scheduling (not missed)
  - *Test:* Schedule 10 test follow-ups, verify all fire within ±5 minutes
- [ ] **Assumption 3:** Baileys won't get banned with 24-branch routing on 1-3 numbers
  - *Test:* Run Trial Express for 2 weeks, monitor ban rate
- [ ] **Assumption 4:** Existing CRM schema can be extended without breaking existing features
  - *Test:* Add new tables (branches, appointments, therapists) alongside existing tables, verify no regression

## MVP Scope

### In Scope (10 weeks)

| Week | Deliverable |
|:-----|:------------|
| 1-2 | Convex HTTP API endpoints (5 endpoints) |
| 2-3 | OpenClaw skills (kuesioner, booking, followup) |
| 3-4 | New Convex tables (branches, therapists, appointments, leads, followups) |
| 4-6 | Dashboard pages (scheduling, lead pipeline, therapist management) |
| 6-8 | Integration testing end-to-end |
| 8-9 | Data import from existing system |
| 9-10 | UAT + bug fixes + training |

### New Tables (Convex)

```typescript
// branches — cabang fisioterapi
branches: { name, address, phone, active, settings }

// therapists — terapis
therapists: { name, specialization, branchId, schedule, active }

// appointments — booking
type: 'booking' | 'confirmed' | 'completed' | 'cancelled' | 'no-show'

// leads — dari WhatsApp
leads: { phone, name, source, status, branchId, assignedTo, score }

// questionnaires — hasil kuesioner
questionnaires: { leadId, area, severity, duration, answers, timestamp }

// followups — jadwal follow-up
followups: { leadId, appointmentId, type, scheduledAt, sentAt, status }
```

### Convex HTTP API Endpoints

| Endpoint | Method | Description |
|:---------|:------:|:------------|
| `/api/questionnaire/save` | POST | Simpan hasil kuesioner |
| `/api/lead/create-or-update` | POST | Create/update lead dari WhatsApp |
| `/api/availability` | GET | Cek slot therapist tersedia |
| `/api/booking/create` | POST | Buat appointment |
| `/api/booking/confirm` | POST | Konfirmasi appointment |
| `/api/booking/reschedule` | POST | Reschedule appointment |
| `/api/followup/schedule` | POST | Jadwalkan follow-up |
| `/api/followup/pending` | GET | Ambil follow-up yang harus dikirim hari ini |
| `/api/lead/score` | POST | Update lead score |

### OpenClaw Skills (3 files)

```
~/.openclaw/workspace/skills/
├── kuesioner/SKILL.md      # Tanya area, severity, duration → save to Convex
├── booking/SKILL.md         # Tanya cabang → cek availability → confirm booking
└── followup/SKILL.md        # Schedule follow-up H+1, H+3, H+7 → Convex cron
```

## Clinical Handoff: AI Summary untuk Terapis

Setelah kuesioner selesai, AI generate ringkasan klinis yang terapis baca sebelum treatment.

### Flow

```
Percakapan WhatsApp (AI)
    │
    ├──► Questionnaire answers (structured)
    ├──► Conversation transcript
    └──► AI-generated clinical summary
              │
              ▼
    Convex: appointments.aiSummary
              │
              ▼
    Dashboard — Appointment Detail
    ┌────────────────────────────────────┐
    │  🧑 John Doe · +62812xxxx          │
    │  📍 Kelapa Gading · 25 Apr 10:00   │
    │                                     │
    │  ┌─ AI Summary ─────────────────┐  │
    │  │ Keluhan: Lutut kiri, sev 7/10│  │
    │  │ Durasi: 2 minggu             │  │
    │  │ Pernah treatment: Ya         │  │
    │  │ Alergi: Tidak ada            │  │
    │  │                              │  │
    │  │ 📝 Rekomendasi AI:           │  │
    │  │ Focus meniscus assessment    │  │
    │  │ dan knee stability test.     │  │
    │  └──────────────────────────────┘  │
    │  [Lihat Full Transcript]           │
    │  [Catatan Terapis]                 │
    └────────────────────────────────────┘
```

### Convex Schema (5 field baru)

```typescript
appointments: defineEnt({
  // ...existing fields...
  aiSummary: v.optional(v.string()),           // ringkasan AI
  questionnaireData: v.optional(v.object({      // structured data
    area: v.string(),
    severity: v.number(),
    duration: v.string(),
    previousTreatment: v.boolean(),
    previousTreatmentWhere: v.optional(v.string()),
    allergies: v.optional(v.string()),
    medications: v.optional(v.string()),
    notes: v.optional(v.string()),
  })),
  transcript: v.optional(v.string()),            // full chat log
  therapistReadStatus: v.optional(v.boolean()),  // false = belum dibaca
  therapistNotes: v.optional(v.string()),        // catatan pasca-treatment
})
```

### OpenClaw Skill — Generate Summary

```markdown
## Generate Clinical Summary
Setelah kuesioner selesai, buat ringkasan untuk terapis:

Format:
```
KELUHAN: [area] — [severity]/10 — [duration]
RIWAYAT: [pernah treatment? di mana?]
ALERGI/KONTRAINDIKASI: [jika ada]
CATATAN TAMBAHAN: [apa yang pasien tanyakan]
REKOMENDASI: [suggestion untuk terapis]
```

Kirim ke Convex:
```bash
curl -X POST https://APP.convex.site/api/appointment/summary \
  -d '{"appointmentId":"xxx","aiSummary":"...","questionnaireData":{...},"transcript":"..."}'
```
```

### Notifikasi ke Terapis

| Event | Cara | Kapan |
|:------|:-----|:------|
| Summary baru tersedia | Push notif / WhatsApp ke terapis | Setelah booking confirmed |
| Reminder lihat summary | Email / WhatsApp | H-1 atau H-2 jam sebelum treatment |
| Pasien arrived | WhatsApp ke terapis | Saat pasien check-in |

### Disclaimer

> AI summary = clinical notes helper, bukan diagnosis medis. Terapis tetap melakukan assessment sendiri. Summary membantu persiapan, tidak menggantikan clinical judgment.

## Not Doing (and Why)

| Item | Reason |
|:-----|:-------|
| **Voice/video calls** | Out of scope MVP — WhatsApp text cukup untuk conversion |
| **Mobile app (native)** | Dashboard sudah responsive, WhatsApp = no install needed |
| **Integration Cloud X** | Fase 2 — MVP pakai data import manual dulu |
| **Multi-language AI** | Indonesian only untuk MVP — English bisa ditambah nanti |
| **Self-hosted Convex** | Convex Cloud gratis tier cukup untuk 3 cabang pilot |
| **Custom AI model** | Kimi K2.6 via API cukup — training custom model mahal dan lama |
| **Real-time therapist tracking (GPS)** | Overkill — jadwal di dashboard cukup |
| **Payment gateway integration** | Manual tracking dulu — Xendit/Midtrans fase 2 |

## Open Questions

1. **Apakah Convex HTTP API bisa di-call dari VPS (Hetzner) tanpa CORS issue?**
   - Convex HTTP actions support CORS — but check if we need custom headers

2. **Bagaimana handle WhatsApp number banned?**
   - Backup plan: Meta Business API (paid) atau nomor cadangan

3. **Siapa yang maintain OpenClaw gateway?**
   - Perlu SOP restart, monitoring, update — dokumentasikan

4. **Bagaimana therapist update availability real-time?**
   - Therapist update via Dashboard → Convex realtime → AI lihat slot terbaru

5. **Apakah Better Auth di existing CRM cukup untuk multi-role (therapist, admin, owner)?**
   - Yes — organization + member + permissionTemplates sudah ada

## Technology Stack

| Layer | Tech | Status |
|:------|:-----|:-------|
| WhatsApp Gateway | OpenClaw + Baileys | New |
| AI Model | Kimi K2.6 via Moonshot/OpenRouter | New |
| Backend | Convex (Cloud) | Exists |
| Dashboard | Next.js 15 + shadcn/ui | Exists |
| Auth | Better Auth | Exists |
| Database | Convex | Exists |
| Cron | Convex Crons | Exists |
| Hosting Dashboard | Vercel | Exists |
| Hosting Gateway | Hetzner VPS | New |

## Existing Assets to Reuse

From `~/Desktop/crm`:
- ✅ `companies` table → reuse for `branches`
- ✅ `contacts` table → reuse for `patients`
- ✅ `deals` table → reuse for `leads` pipeline
- ✅ `activities` table → reuse for `appointments`
- ✅ `invoices` + `payments` → reuse as-is
- ✅ `customers` + `products` → reuse for service catalog
- ✅ `sequences` + `reminderRules` → reuse for follow-up automation
- ✅ Dashboard auth + RBAC → reuse as-is
- ✅ Audit logs → reuse as-is

## Estimated Effort

| Component | Estimate |
|:----------|:--------:|
| Convex HTTP API (9 endpoints) | 2 hari |
| New tables + relations | 2 hari |
| 3 OpenClaw skills | 1 hari |
| Dashboard pages (scheduling, leads, therapists) | 5 hari |
| Convex crons (follow-up scheduler) | 1 hari |
| AI clinical summary + therapist handoff | 2 hari |
| Integration + testing | 3 hari |
| **Total** | **~16 hari (3 minggu aktual)** |

*Sisa waktu (7.5 minggu) untuk polish, UAT, training, data import.*

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|:-----|:-----------:|:------:|:-----------|
| Baileys banned | 30% | High | Backup Meta Business API, multi-number strategy |
| OpenClaw breaking update | 20% | Medium | Pin version, test before upgrade |
| Convex rate limits | 15% | Medium | Cache frequent queries, batch writes |
| Therapist resistance to dashboard | 40% | Medium | Training + simpel UI + mobile-friendly |
| Data import from Cloud X fails | 25% | Medium | Manual export CSV + script import |
