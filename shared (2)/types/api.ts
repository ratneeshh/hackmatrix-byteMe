import { SOAPNote, TranscriptChunk, Session, FHIRBundle } from './db';

// Auth
export type SetPinRequest = { pin: string };
export type SetPinResponse = { success: boolean };
export type VerifyPinRequest = { pin: string };
export type VerifyPinResponse = { valid: boolean };

// Sessions
export type StartSessionRequest = { patient_id: string; language: string };
export type StartSessionResponse = { session_id: string; realtime_channel: string };

export type ChunkRequest = { audio_b64: string; chunk_index: number };
export type ChunkResponse = { transcript_chunk: string; confidence: number };

export type EndSessionResponse = { status: string; estimated_seconds: number };

export type GetSessionResponse = {
  session: Session;
  transcripts: TranscriptChunk[];
  soap_note: SOAPNote | null;
  fhir_bundle: FHIRBundle | null;
};

export type PatchSOAPRequest = { doctor_edits: Record<string, any> };

export type FinaliseResponse = { pdf_url: string; fhir_path: string };

export type SessionSummary = {
  id: string;
  patient_name: string;
  started_at: string;
  duration_seconds: number;
  status: string;
  top_diagnosis?: string;
};

export type PagedSessions = {
  data: SessionSummary[];
  total: number;
  page: number;
};

// Analytics
export type AnalyticsSummary = {
  total_sessions: number;
  avg_duration_seconds: number;
  sessions_today: number;
  top_diagnoses: { icd10: string; name: string; count: number }[];
};

export type AnalyticsWeekly = {
  daily_counts: { date: string; count: number }[];
  weekly_avg_duration: number;
};

// Realtime Events
export type RealtimeTranscriptChunk = {
  text: string;
  speaker_label: 'DOCTOR' | 'PATIENT' | 'UNKNOWN';
  chunk_index: number;
  confidence: number;
};

export type RealtimeAnalysisComplete = { soap_note_id: string };
export type RealtimeFHIRReady = { bundle_id: string; storage_path: string };
export type RealtimePDFReady = { pdf_url: string };
export type RealtimeError = { code: string; message: string };