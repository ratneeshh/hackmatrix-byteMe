import { create } from 'zustand';
import type { TranscriptChunk, SOAPNote, SessionStatus } from '../../shared/types/db';

interface SessionState {
  // Active session
  sessionId:        string | null;
  patientId:        string | null;
  status:           SessionStatus | null;
  isRecording:      boolean;

  // Live transcript chunks streamed via Realtime
  transcriptChunks: TranscriptChunk[];

  // SOAP note populated after analysis
  soapNote:         SOAPNote | null;

  // Actions
  setSessionId:     (id: string | null) => void;
  setPatientId:     (id: string | null) => void;
  setStatus:        (status: SessionStatus | null) => void;
  setRecording:     (isRecording: boolean) => void;
  appendChunk:      (chunk: TranscriptChunk) => void;
  setSoapNote:      (note: SOAPNote | null) => void;
  resetSession:     () => void;
}

const initialState = {
  sessionId:        null,
  patientId:        null,
  status:           null,
  isRecording:      false,
  transcriptChunks: [],
  soapNote:         null,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,

  setSessionId:  (id)          => set({ sessionId: id }),
  setPatientId:  (id)          => set({ patientId: id }),
  setStatus:     (status)      => set({ status }),
  setRecording:  (isRecording) => set({ isRecording }),
  setSoapNote:   (soapNote)    => set({ soapNote }),

  appendChunk: (chunk) =>
    set(state => {
      // Deduplicate by chunk_index in case Realtime re-delivers
      const exists = state.transcriptChunks.some(
        c => c.chunk_index === chunk.chunk_index && c.session_id === chunk.session_id,
      );
      if (exists) return state;
      return {
        transcriptChunks: [...state.transcriptChunks, chunk].sort(
          (a, b) => a.chunk_index - b.chunk_index,
        ),
      };
    }),

  resetSession: () => set(initialState),
}));