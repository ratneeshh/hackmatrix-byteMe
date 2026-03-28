export type Doctor = {
  id: string;
  mobile_number: string;
  name: string;
  speciality: string;
  clinic_name: string;
  city: string;
  pin_hash: string;
  preferred_language: 'en' | 'hi' | 'en-hi';
  created_at: string;
  last_active_at: string;
};

export type Patient = {
  id: string;
  doctor_id: string;
  name: string;
  age: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  mobile?: string;
  abha_id?: string;
  created_at: string;
};

export type SessionStatus = 'RECORDING' | 'PROCESSING' | 'REVIEW' | 'COMPLETE' | 'FAILED';

export type Session = {
  id: string;
  doctor_id: string;
  patient_id: string;
  status: SessionStatus;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  language_detected: string;
  audio_storage_path?: string;
  created_at: string;
};

export type SpeakerLabel = 'DOCTOR' | 'PATIENT' | 'UNKNOWN';

export type TranscriptChunk = {
  id: string;
  session_id: string;
  chunk_index: number;
  text: string;
  speaker_label: SpeakerLabel;
  confidence: number;
  created_at: string;
};

export type ICD10Code = {
  code: string;
  description: string;
};

export type Medication = {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
};

export type Vitals = {
  bp?: string;
  pulse?: number;
  temp?: number;
  spo2?: number;
  weight?: number;
  height?: number;
};

export type SOAPNote = {
  id: string;
  session_id: string;
  chief_complaint: string;
  history: string;
  examination: string;
  assessment: string;
  icd10_codes: ICD10Code[];
  plan: string;
  medications: Medication[];
  vitals: Vitals;
  follow_up_days?: number;
  doctor_edits?: Record<string, any>;
  finalised_at?: string;
};

export type FHIRBundle = {
  id: string;
  session_id: string;
  bundle: Record<string, any>;
  resource_types: string[];
  storage_path: string;
  generated_at: string;
};