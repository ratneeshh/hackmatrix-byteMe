-- =============================================================================
-- MediScribe — 001_init.sql
-- Complete schema: enums, tables, indexes, RLS policies, storage buckets, seed
-- Run: supabase db reset  (drops and re-applies everything)
-- =============================================================================


-- =============================================================================
-- 0. EXTENSIONS
-- =============================================================================

create extension if not exists "uuid-ossp";


-- =============================================================================
-- 1. ENUMS
-- =============================================================================

create type preferred_language_enum as enum ('en', 'hi', 'en-hi');
create type gender_enum              as enum ('MALE', 'FEMALE', 'OTHER');
create type session_status_enum      as enum ('RECORDING', 'PROCESSING', 'REVIEW', 'COMPLETE', 'FAILED');
create type speaker_label_enum       as enum ('DOCTOR', 'PATIENT', 'UNKNOWN');


-- =============================================================================
-- 2. TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- doctors
-- id = auth.uid() so Supabase Auth owns the primary key.
-- The trigger below creates this row automatically on first sign-in.
-- ---------------------------------------------------------------------------
create table doctors (
  id                 uuid primary key references auth.users(id) on delete cascade,
  mobile_number      varchar(15)              not null unique,
  name               varchar(100)             not null default '',
  speciality         varchar(80)              not null default '',
  clinic_name        varchar(120)             not null default '',
  city               varchar(60)              not null default '',
  pin_hash           varchar(60)              not null default '',
  preferred_language preferred_language_enum  not null default 'en-hi',
  created_at         timestamptz              not null default now(),
  last_active_at     timestamptz              not null default now()
);

-- ---------------------------------------------------------------------------
-- patients
-- Anchored to a doctor. A patient created by doctor A is invisible to doctor B.
-- ---------------------------------------------------------------------------
create table patients (
  id         uuid primary key default gen_random_uuid(),
  doctor_id  uuid         not null references doctors(id) on delete cascade,
  name       varchar(100) not null,
  age        integer      not null check (age > 0 and age < 150),
  gender     gender_enum  not null,
  mobile     varchar(15),
  abha_id    varchar(20),
  created_at timestamptz  not null default now()
);

-- ---------------------------------------------------------------------------
-- sessions
-- One row per consultation. Lifecycle: RECORDING → PROCESSING → REVIEW → COMPLETE
-- duration_seconds is computed by a trigger when ended_at is set.
-- ---------------------------------------------------------------------------
create table sessions (
  id                  uuid                primary key default gen_random_uuid(),
  doctor_id           uuid                not null references doctors(id) on delete cascade,
  patient_id          uuid                not null references patients(id) on delete cascade,
  status              session_status_enum not null default 'RECORDING',
  started_at          timestamptz         not null default now(),
  ended_at            timestamptz,
  duration_seconds    integer generated always as (
                        extract(epoch from (ended_at - started_at))::integer
                      ) stored,
  language_detected   varchar(10)         not null default 'en-hi',
  audio_storage_path  text,
  created_at          timestamptz         not null default now()
);

-- ---------------------------------------------------------------------------
-- transcripts
-- One row per 5-second audio chunk. chunk_index is the sequence number.
-- ---------------------------------------------------------------------------
create table transcripts (
  id            uuid               primary key default gen_random_uuid(),
  session_id    uuid               not null references sessions(id) on delete cascade,
  chunk_index   integer            not null,
  text          text               not null,
  speaker_label speaker_label_enum not null default 'UNKNOWN',
  confidence    real               not null default 0 check (confidence >= 0 and confidence <= 1),
  created_at    timestamptz        not null default now(),
  unique (session_id, chunk_index)
);

-- ---------------------------------------------------------------------------
-- soap_notes
-- One SOAP note per session (unique constraint enforced).
-- icd10_codes, medications, vitals, doctor_edits are JSONB.
-- ---------------------------------------------------------------------------
create table soap_notes (
  id               uuid        primary key default gen_random_uuid(),
  session_id       uuid        not null unique references sessions(id) on delete cascade,
  chief_complaint  text        not null default '',
  history          text        not null default '',
  examination      text        not null default '',
  assessment       text        not null default '',
  icd10_codes      jsonb       not null default '[]'::jsonb,
  plan             text        not null default '',
  medications      jsonb       not null default '[]'::jsonb,
  vitals           jsonb       not null default '{}'::jsonb,
  follow_up_days   integer     check (follow_up_days > 0),
  doctor_edits     jsonb,
  finalised_at     timestamptz,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- fhir_bundles
-- One FHIR R4 Bundle per session (unique constraint enforced).
-- bundle is the full JSON; storage_path points to Supabase Storage.
-- ---------------------------------------------------------------------------
create table fhir_bundles (
  id             uuid        primary key default gen_random_uuid(),
  session_id     uuid        not null unique references sessions(id) on delete cascade,
  bundle         jsonb       not null,
  resource_types text[]      not null default '{}',
  storage_path   text        not null default '',
  generated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- prescriptions
-- Stores the signed URL and storage path for each generated PDF.
-- ---------------------------------------------------------------------------
create table prescriptions (
  id           uuid        primary key default gen_random_uuid(),
  session_id   uuid        not null unique references sessions(id) on delete cascade,
  storage_path text        not null,
  signed_url   text,
  generated_at timestamptz not null default now()
);


-- =============================================================================
-- 3. INDEXES
-- All foreign keys get indexes. Additional indexes on high-cardinality filters.
-- =============================================================================

-- doctors
create index idx_doctors_mobile      on doctors(mobile_number);
create index idx_doctors_last_active on doctors(last_active_at desc);

-- patients
create index idx_patients_doctor_id on patients(doctor_id);
create index idx_patients_name      on patients(doctor_id, name);   -- name search is always scoped to a doctor

-- sessions
create index idx_sessions_doctor_id   on sessions(doctor_id);
create index idx_sessions_patient_id  on sessions(patient_id);
create index idx_sessions_status      on sessions(doctor_id, status);
create index idx_sessions_started_at  on sessions(doctor_id, started_at desc);

-- transcripts
create index idx_transcripts_session_id   on transcripts(session_id);
create index idx_transcripts_chunk_index  on transcripts(session_id, chunk_index);
create index idx_transcripts_created_at   on transcripts(session_id, created_at);

-- soap_notes
create index idx_soap_notes_session_id on soap_notes(session_id);

-- fhir_bundles
create index idx_fhir_bundles_session_id on fhir_bundles(session_id);

-- prescriptions
create index idx_prescriptions_session_id on prescriptions(session_id);


-- =============================================================================
-- 4. TRIGGER — auto-create doctor row on auth.users insert
-- When Supabase Auth creates a new user (via OTP), this trigger inserts a
-- matching row in public.doctors using the phone number from auth.users.
-- The mobile_number column is seeded here; name/speciality set via API later.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.doctors (id, mobile_number)
  values (
    new.id,
    coalesce(new.phone, new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- =============================================================================
-- 5. TRIGGER — update last_active_at on new session start
-- =============================================================================

create or replace function public.handle_session_start()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.doctors
  set last_active_at = now()
  where id = new.doctor_id;
  return new;
end;
$$;

create trigger on_session_created
  after insert on public.sessions
  for each row execute procedure public.handle_session_start();


-- =============================================================================
-- 6. ROW LEVEL SECURITY
-- Every table is locked down to auth.uid(). Edge Functions that need to bypass
-- RLS (e.g. fhir-bundle writing on behalf of a doctor) use the service role key
-- and are trusted to enforce ownership themselves.
-- =============================================================================

alter table doctors       enable row level security;
alter table patients      enable row level security;
alter table sessions      enable row level security;
alter table transcripts   enable row level security;
alter table soap_notes    enable row level security;
alter table fhir_bundles  enable row level security;
alter table prescriptions enable row level security;

-- ---------------------------------------------------------------------------
-- doctors: a doctor can only read and update their own row.
-- INSERT is handled by the trigger (service definer) — no direct insert policy needed.
-- ---------------------------------------------------------------------------
create policy "doctors: read own row"
  on doctors for select
  using (id = auth.uid());

create policy "doctors: update own row"
  on doctors for update
  using (id = auth.uid());

-- ---------------------------------------------------------------------------
-- patients: scoped to the owning doctor.
-- ---------------------------------------------------------------------------
create policy "patients: doctor owns"
  on patients for all
  using (doctor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- sessions: scoped to the owning doctor.
-- ---------------------------------------------------------------------------
create policy "sessions: doctor owns"
  on sessions for all
  using (doctor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- transcripts: accessible if the parent session belongs to the doctor.
-- ---------------------------------------------------------------------------
create policy "transcripts: via session"
  on transcripts for all
  using (
    exists (
      select 1 from sessions s
      where s.id = transcripts.session_id
        and s.doctor_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- soap_notes: accessible if the parent session belongs to the doctor.
-- ---------------------------------------------------------------------------
create policy "soap_notes: via session"
  on soap_notes for all
  using (
    exists (
      select 1 from sessions s
      where s.id = soap_notes.session_id
        and s.doctor_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- fhir_bundles: accessible if the parent session belongs to the doctor.
-- ---------------------------------------------------------------------------
create policy "fhir_bundles: via session"
  on fhir_bundles for all
  using (
    exists (
      select 1 from sessions s
      where s.id = fhir_bundles.session_id
        and s.doctor_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- prescriptions: accessible if the parent session belongs to the doctor.
-- ---------------------------------------------------------------------------
create policy "prescriptions: via session"
  on prescriptions for all
  using (
    exists (
      select 1 from sessions s
      where s.id = prescriptions.session_id
        and s.doctor_id = auth.uid()
    )
  );


-- =============================================================================
-- 7. STORAGE BUCKETS
-- Run AFTER supabase storage is initialised (it usually already exists).
-- Creates three private buckets. Access is via signed URLs only.
-- =============================================================================

insert into storage.buckets (id, name, public)
values
  ('audio', 'audio', false),
  ('fhir',  'fhir',  false),
  ('pdfs',  'pdfs',  false)
on conflict (id) do nothing;

-- audio bucket: doctor can only read/write inside their own folder (doctor_id/*)
create policy "audio: doctor folder"
  on storage.objects for all
  using (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- fhir bucket: same pattern
create policy "fhir: doctor folder"
  on storage.objects for all
  using (
    bucket_id = 'fhir'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- pdfs bucket: same pattern
create policy "pdfs: doctor folder"
  on storage.objects for all
  using (
    bucket_id = 'pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- =============================================================================
-- 8. ANALYTICS VIEWS
-- Materialised as regular views (fast enough on free tier with indexed tables).
-- Used by the analytics Edge Function.
-- =============================================================================

-- Per-doctor summary stats
create or replace view doctor_analytics_summary as
select
  s.doctor_id,
  count(*)                                              as total_sessions,
  avg(s.duration_seconds)                               as avg_duration_seconds,
  count(*) filter (where s.started_at::date = current_date) as sessions_today
from sessions s
where s.status = 'COMPLETE'
group by s.doctor_id;

-- Top ICD-10 codes per doctor (unnests the jsonb array in soap_notes)
create or replace view doctor_top_diagnoses as
select
  s.doctor_id,
  code_entry->>'code'        as icd10_code,
  code_entry->>'description' as description,
  count(*)                   as occurrence_count
from sessions s
join soap_notes sn on sn.session_id = s.id,
     jsonb_array_elements(sn.icd10_codes) as code_entry
where s.status = 'COMPLETE'
group by s.doctor_id, icd10_code, description
order by occurrence_count desc;

-- Daily session counts for the weekly chart (last 7 days)
create or replace view doctor_weekly_counts as
select
  s.doctor_id,
  s.started_at::date  as session_date,
  count(*)            as session_count
from sessions s
where s.started_at >= current_date - interval '7 days'
group by s.doctor_id, session_date
order by session_date;


-- =============================================================================
-- 9. DEMO SEED DATA
-- Two doctors, five patients, three complete sessions with SOAP notes + FHIR.
-- Doctor UUIDs are fixed so the mobile app can log in with the demo PIN (123456).
-- PIN hash below is bcrypt of "123456" with cost=10.
-- =============================================================================

-- Demo doctor 1
insert into doctors (id, mobile_number, name, speciality, clinic_name, city, pin_hash, preferred_language)
values (
  '00000000-0000-0000-0000-000000000001',
  '+919876543210',
  'Dr. Priya Sharma',
  'General Physician',
  'Sharma Clinic',
  'Raipur',
  '$2b$10$K8gMGMl/xBmB3EI1NWLmE.F1aAFGF.x8p7Ycf6K3Kk1qMm5q3vBa6', -- "123456"
  'en-hi'
)
on conflict (id) do nothing;

-- Demo doctor 2
insert into doctors (id, mobile_number, name, speciality, clinic_name, city, pin_hash, preferred_language)
values (
  '00000000-0000-0000-0000-000000000002',
  '+919876543211',
  'Dr. Arjun Mehta',
  'Cardiologist',
  'Mehta Heart Centre',
  'Nagpur',
  '$2b$10$K8gMGMl/xBmB3EI1NWLmE.F1aAFGF.x8p7Ycf6K3Kk1qMm5q3vBa6', -- "123456"
  'en'
)
on conflict (id) do nothing;

-- Five demo patients (all owned by doctor 1)
insert into patients (id, doctor_id, name, age, gender, mobile, abha_id)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Ramesh Kumar',   45, 'MALE',   '+917890123456', '1234-5678-9012'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Sunita Devi',    32, 'FEMALE', '+917890123457', null),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Mohan Singh',    60, 'MALE',   '+917890123458', '9876-5432-1098'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Anita Verma',    28, 'FEMALE', null,            null),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 'Ravi Patel',     55, 'MALE',   '+917890123460', '1122-3344-5566')
on conflict (id) do nothing;

-- Three complete sessions
insert into sessions (id, doctor_id, patient_id, status, started_at, ended_at, language_detected)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'COMPLETE',
    now() - interval '2 days',
    now() - interval '2 days' + interval '4 minutes 32 seconds',
    'en-hi'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'COMPLETE',
    now() - interval '1 day',
    now() - interval '1 day' + interval '3 minutes 15 seconds',
    'en-hi'
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000005',
    'COMPLETE',
    now() - interval '3 hours',
    now() - interval '3 hours' + interval '6 minutes 10 seconds',
    'en'
  )
on conflict (id) do nothing;

-- Transcript chunks for session 1
insert into transcripts (session_id, chunk_index, text, speaker_label, confidence)
values
  ('20000000-0000-0000-0000-000000000001', 0, 'Namaste doctor, mujhe do din se bukhar hai.', 'PATIENT', 0.94),
  ('20000000-0000-0000-0000-000000000001', 1, 'Kitna temperature hai? Thermometer se check kiya?', 'DOCTOR', 0.96),
  ('20000000-0000-0000-0000-000000000001', 2, 'Haan, 101.5 tha kal raat. Sar mein bhi dard hai.', 'PATIENT', 0.92),
  ('20000000-0000-0000-0000-000000000001', 3, 'Koi allergy nahi hai na? Diabetes ya BP?', 'DOCTOR', 0.97),
  ('20000000-0000-0000-0000-000000000001', 4, 'Nahi doctor. Pehle koi badi bimari nahi thi.', 'PATIENT', 0.91),
  ('20000000-0000-0000-0000-000000000001', 5, 'Okay, viral fever lag raha hai. Paracetamol 500mg likhta hoon, din mein teen baar.', 'DOCTOR', 0.98)
on conflict (session_id, chunk_index) do nothing;

-- Transcript chunks for session 2
insert into transcripts (session_id, chunk_index, text, speaker_label, confidence)
values
  ('20000000-0000-0000-0000-000000000002', 0, 'Doctor, pet mein dard ho raha hai subah se.', 'PATIENT', 0.93),
  ('20000000-0000-0000-0000-000000000002', 1, 'Kahan dard hai, neeche ya upar? Khana khaya?', 'DOCTOR', 0.95),
  ('20000000-0000-0000-0000-000000000002', 2, 'Neeche ki taraf, right side. Kal se kuch nahi khaya.', 'PATIENT', 0.90),
  ('20000000-0000-0000-0000-000000000002', 3, 'Okay let me examine. Press karta hoon, batao kahan zyada dard hai.', 'DOCTOR', 0.96)
on conflict (session_id, chunk_index) do nothing;

-- SOAP notes for sessions 1 and 2
insert into soap_notes (
  session_id, chief_complaint, history, examination, assessment,
  icd10_codes, plan, medications, vitals, follow_up_days, finalised_at
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    'Fever for 2 days with headache',
    'Patient presents with fever since 2 days, temperature 101.5°F. Associated headache. No cough or cold. No known allergies. No significant past medical history.',
    'Patient conscious and oriented. Temp: 101.5°F, Pulse: 88/min, BP: 118/76 mmHg. No pharyngeal congestion. No lymphadenopathy.',
    'Viral fever with headache',
    '[{"code":"J06.9","description":"Acute upper respiratory infection, unspecified"},{"code":"R51","description":"Headache"}]',
    'Rest and adequate hydration. Paracetamol for fever and headache. Review in 3 days if symptoms persist or worsen.',
    '[{"name":"Paracetamol","dosage":"500mg","frequency":"TDS (three times daily)","duration":"3 days","notes":"After food"}]',
    '{"bp":"118/76","pulse":88,"temp":101.5,"spo2":98}',
    3,
    now() - interval '2 days' + interval '5 minutes'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'Abdominal pain since morning, right lower quadrant',
    'Female patient, 32 years. Complains of right lower abdominal pain since morning. Nausea present, no vomiting. Missed last meal due to pain.',
    'Abdomen soft, tenderness in right iliac fossa. Rebound tenderness mild. Bowel sounds normal.',
    'Possible appendicitis — refer for USG abdomen',
    '[{"code":"K37","description":"Unspecified appendicitis"}]',
    'Urgent USG abdomen. Keep NPO. Refer to surgical OPD if USG confirms appendicitis. Return immediately if pain worsens.',
    '[{"name":"Pantoprazole","dosage":"40mg","frequency":"OD (once daily)","duration":"3 days","notes":"Before breakfast"},{"name":"Ondansetron","dosage":"4mg","frequency":"SOS (as needed for nausea)","duration":"2 days","notes":""}]',
    '{"bp":"110/70","pulse":94,"temp":99.2,"spo2":99}',
    1,
    now() - interval '1 day' + interval '4 minutes'
  )
on conflict (session_id) do nothing;

-- Minimal FHIR bundle for session 1 (truncated for seed readability)
insert into fhir_bundles (session_id, bundle, resource_types, storage_path, generated_at)
values (
  '20000000-0000-0000-0000-000000000001',
  '{
    "resourceType": "Bundle",
    "type": "transaction",
    "entry": [
      {
        "resource": {
          "resourceType": "Patient",
          "id": "10000000-0000-0000-0000-000000000001",
          "name": [{"text": "Ramesh Kumar"}],
          "gender": "male",
          "birthDate": "1979-01-01",
          "identifier": [{"system": "https://abdm.gov.in/abha", "value": "1234-5678-9012"}]
        }
      },
      {
        "resource": {
          "resourceType": "Condition",
          "code": {"coding": [{"system": "http://hl7.org/fhir/sid/icd-10", "code": "J06.9", "display": "Acute upper respiratory infection"}]},
          "clinicalStatus": {"coding": [{"code": "active"}]},
          "verificationStatus": {"coding": [{"code": "confirmed"}]}
        }
      }
    ]
  }',
  ARRAY['Patient', 'Encounter', 'Condition', 'MedicationRequest'],
  'fhir/00000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001.json',
  now() - interval '2 days' + interval '6 minutes'
)
on conflict (session_id) do nothing;