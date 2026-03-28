import { create } from 'zustand';
import { TranscriptChunk, SOAPNote, FHIRBundle, SessionStatus } from '../../shared/types/db';

type SessionState = {
  // Active session
  sessionId: string | null;
  patientId: string | null;
  status: SessionStatus | 'IDLE';

  // Recording
  isWakeWordActive: boolean;
  isRecording: boolean;
  chunkIndex: number;

  // Transcript
  transcriptChunks: TranscriptChunk[];

  // Results
  soapNote: SOAPNote | null;
  fhirBundle: FHIRBundle | null;
  pdfUrl: string | null;

  // Actions
  setSessionId: (id: string) => void;
  setPatientId: (id: string) => void;
  setStatus: (status: SessionStatus | 'IDLE') => void;
  setWakeWordActive: (val: boolean) => void;
  setRecording: (val: boolean) => void;
  incrementChunk: () => void;
  appendTranscript: (chunk: TranscriptChunk) => void;
  setSoapNote: (note: SOAPNote) => void;
  setFhirBundle: (bundle: FHIRBundle) => void;
  setPdfUrl: (url: string) => void;
  resetSession: () => void;
};

const initialState = {
  sessionId: null,
  patientId: null,
  status: 'IDLE' as const,
  isWakeWordActive: false,
  isRecording: false,
  chunkIndex: 0,
  transcriptChunks: [],
  soapNote: null,
  fhirBundle: null,
  pdfUrl: null,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,

  setSessionId: (id) => set({ sessionId: id }),
  setPatientId: (id) => set({ patientId: id }),
  setStatus: (status) => set({ status }),
  setWakeWordActive: (val) => set({ isWakeWordActive: val }),
  setRecording: (val) => set({ isRecording: val }),
  incrementChunk: () => set((s) => ({ chunkIndex: s.chunkIndex + 1 })),
  appendTranscript: (chunk) =>
    set((s) => ({ transcriptChunks: [...s.transcriptChunks, chunk] })),
  setSoapNote: (note) => set({ soapNote: note }),
  setFhirBundle: (bundle) => set({ fhirBundle: bundle }),
  setPdfUrl: (url) => set({ pdfUrl: url }),
  resetSession: () => set(initialState),
}));