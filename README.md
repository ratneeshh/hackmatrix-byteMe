# MediScribe — Ambient AI Clinical Scribe

> "The doctor speaks. The patient is heard. The record writes itself."

React Native mobile app + Supabase backend for real-time doctor-patient consultation capture, clinical NLP (Groq LLaMA 3), and FHIR R4 bundle generation.

---

## Project Structure

```
mediscribe/
├── mobile/                    # Expo React Native app (Ayush)
│   ├── src/
│   │   ├── app/               # Expo Router file-based navigation
│   │   │   ├── (auth)/        # login, verify, pin
│   │   │   └── (app)/         # home, session/*, history/*, analytics, settings
│   │   ├── components/        # UI components
│   │   ├── hooks/             # useWakeWord, useSession, useTranscriptStream, useFHIRBundle
│   │   ├── store/             # Zustand: sessionStore, authStore
│   │   ├── api/               # supabase client + TanStack Query hooks
│   │   └── utils/             # audioUtils, fhirUtils
│   ├── app.config.ts
│   ├── package.json
│   └── tsconfig.json
│
├── supabase/                  # Supabase backend (Ratnesh)
│   ├── migrations/
│   │   └── 001_init.sql       # All tables, RLS, triggers, analytics views, seed data
│   ├── functions/
│   │   ├── auth-otp/          # PIN set + verify (bcrypt)
│   │   ├── sessions/          # Session lifecycle: start, chunk, end, get, patch, finalise
│   │   ├── transcribe/        # Audio → Groq Whisper → transcript row → Realtime
│   │   ├── analyse/           # Transcript → Groq LLaMA 3 → SOAP note → Realtime
│   │   ├── fhir-bundle/       # SOAP → FHIR R4 Bundle → Storage → Realtime
│   │   ├── prescription-pdf/  # SOAP → HTML prescription → Storage → signed URL
│   │   └── analytics/         # Summary + weekly stats
│   └── config.toml
│
└── shared/
    └── types/                 # TypeScript types shared by mobile + edge functions
        ├── db.ts
        ├── api.ts
        └── fhir.ts
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 20 | [nodejs.org](https://nodejs.org) |
| Supabase CLI | ≥ 1.150 | `npm i -g supabase` |
| Expo CLI | ≥ 8 | `npm i -g expo-cli` |
| EAS CLI | ≥ 7 | `npm i -g eas-cli` |
| Expo Go | latest | App Store / Play Store |

---

## Quick Start — Local Dev

### 1. Clone & install

```bash
git clone https://github.com/your-team/mediscribe.git
cd mediscribe

cd mobile && npm install && cd ..
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
# (get these from Supabase Dashboard → Project Settings → API)
```

### 3. Start Supabase locally

```bash
cd supabase
supabase start              # starts local Postgres + Auth + Storage + Realtime + Edge Functions
supabase db reset           # runs 001_init.sql + seeds demo data
supabase functions serve    # hot-reload Edge Functions at http://localhost:54321/functions/v1/
```

After `supabase start`, the CLI will print your local `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Copy these into your `.env`.

### 4. Set Groq API key (Edge Functions)

```bash
# Get your key from https://console.groq.com
supabase secrets set GROQ_API_KEY=gsk_your_key_here
```

### 5. Start the Expo dev server

```bash
cd mobile
npx expo start
```

Scan the QR code with Expo Go on your physical device.

---

## Demo Login

The seed data creates two demo doctors with PIN `123456`:

| Doctor | Mobile | Speciality |
|--------|--------|------------|
| Dr. Priya Sharma | +919876543210 | General Physician, Raipur |
| Dr. Arjun Mehta | +919876543211 | Cardiologist, Nagpur |

For local dev, OTP is bypassed — use the test OTP `123456` for any phone number.

---

## Golden Path — End to End

```
1. Open app → Enter PIN (123456 for demo)
2. Home screen → Tap "New Consultation"
3. Select or create a patient
4. Say "Hey Nesh" → Green ring fires, recording begins
5. Conduct consultation naturally (Hinglish supported)
6. Say "Hey Nesh stop" OR tap "End Session"
7. Wait 8–15 seconds for LLaMA 3 to generate SOAP note
8. Review SOAP note → Edit inline if needed
9. Tap "Finalise & Save" → Prescription PDF + FHIR bundle ready
10. History tab → See all past sessions
```

---

## Architecture

```
Mobile App (Expo RN)
  │
  ├── Audio capture (Expo AV, 16kHz mono, 5s chunks)
  ├── Wake word detection (RMS energy + Levenshtein)
  ├── Supabase Realtime subscription (transcript_chunk, analysis_complete, fhir_ready, pdf_ready)
  │
  └── Supabase Edge Functions (Deno)
        │
        ├── /sessions/start      → creates session row
        ├── /sessions/{id}/chunk → calls /transcribe
        ├── /transcribe          → Groq Whisper → transcript row → Realtime broadcast
        ├── /sessions/{id}/end   → fires /analyse (async)
        ├── /analyse             → Groq LLaMA 3 → SOAP note → fires /fhir-bundle (async)
        ├── /fhir-bundle         → FHIR R4 assembly → Storage → fires /prescription-pdf (async)
        ├── /prescription-pdf    → HTML prescription → Storage → signed URL
        ├── /sessions/{id}/finalise → marks COMPLETE
        └── /analytics/summary|weekly → stats from DB views
```

---

## Edge Function Secrets

```bash
supabase secrets set GROQ_API_KEY=gsk_xxx
supabase secrets list   # verify
```

The following are auto-injected by Supabase runtime (do not set manually):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## Production Build (EAS)

```bash
cd mobile

# Configure EAS project (first time only)
eas init

# Build APK for Android (demo distribution)
eas build --platform android --profile preview

# Build IPA for iOS
eas build --platform ios --profile preview
```

---

## Realtime Channel Events

All events fire on channel `session:{session_id}`:

| Event | Payload | Consumer |
|-------|---------|----------|
| `transcript_chunk` | `{ text, speaker_label, chunk_index, confidence }` | `LiveTranscript` |
| `analysis_complete` | `{ soap_note_id }` | `useTranscriptStream` → navigates to review |
| `fhir_ready` | `{ bundle_id, storage_path }` | `useFHIRBundle` |
| `pdf_ready` | `{ pdf_url }` | `PrescriptionPDF` |
| `error` | `{ code, message }` | Global handler |

---

## Troubleshooting

**Wake word not triggering**
- Check microphone permission on device (Settings → MediScribe → Microphone)
- Tune `EXPO_PUBLIC_WAKE_WORD_THRESHOLD` (lower = more sensitive, try `0.55`)
- Say "Hey Nesh" clearly and close to the device in a quiet room

**Transcription empty / poor quality**
- Verify `GROQ_API_KEY` is set: `supabase secrets list`
- Check Edge Function logs: `supabase functions logs transcribe`
- Groq free tier: 28,800 Whisper seconds/day — check usage at console.groq.com

**SOAP note not appearing**
- Check `supabase functions logs analyse`
- If LLM returns invalid JSON, analyse retries once with a stricter prompt
- Fallback: `supabase functions logs analyse --tail` while running a test session

**FHIR bundle missing**
- Check `supabase functions logs fhir-bundle`
- The fhir bucket must exist: `supabase db reset` recreates all buckets

**PDF not loading**
- Signed URLs expire in 7 days; re-finalise to regenerate
- Check `supabase functions logs prescription-pdf`

---

## Team Ownership

| Area | Owner | Files |
|------|-------|-------|
| All backend + infra | Ratnesh | `supabase/` |
| All frontend | Ayush | `mobile/src/` |
| Shared types | Ratnesh (creates) / Ayush (imports) | `shared/types/` |

**Rule:** Never edit files outside your ownership boundary. Cross-module communication happens ONLY via Supabase Edge Function REST endpoints + Realtime channel events.

---

## PS-1 Alignment

| Requirement | MediScribe Implementation |
|------------|--------------------------|
| Capture doctor-patient conversations (Hindi + English) | "Hey Nesh" wake word → Expo AV 16kHz recording → Groq Whisper (multilingual, Hinglish supported) |
| Convert speech to structured clinical notes | Full transcript → Groq LLaMA 3 (llama3-70b-8192) → SOAP note with ICD-10, medications, vitals |
| Map to FHIR-compliant resources | Custom Edge Function → Patient, Encounter, Observation (LOINC), Condition (ICD-10), MedicationRequest, CarePlan (FHIR R4) |
| Mobile prototype (Android + iOS) | Expo SDK 51, testable via Expo Go, APK via EAS Build |
| Multilingual capability | Groq Whisper auto-detects Hindi/English/Hinglish |
| Documentation speed improvement | 85% reduction: 8 min manual → ~45s MediScribe (live timer on demo screen) |
