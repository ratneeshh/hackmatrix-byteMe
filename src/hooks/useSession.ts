import { useCallback } from 'react';
import { callFunction } from '../api/supabase';
import { useSessionStore } from '../store/sessionStore';
import type {
  StartSessionRequest,
  StartSessionResponse,
  EndSessionResponse,
  GetSessionResponse,
  PatchSOAPRequest,
  FinaliseResponse,
} from '../../shared/types/api';

export function useSession() {
  const {
    sessionId,
    setSessionId,
    setPatientId,
    setStatus,
    setRecording,
    setSoapNote,
    resetSession,
  } = useSessionStore();

  // ── Start a new session ──────────────────────────────────────────────────
  const startSession = useCallback(async (
    patientId: string,
    language = 'en-hi',
  ): Promise<StartSessionResponse> => {
    const res = await callFunction<StartSessionResponse>('sessions/start', {
      patient_id: patientId,
      language,
    } satisfies StartSessionRequest);

    setSessionId(res.session_id);
    setPatientId(patientId);
    setStatus('RECORDING');

    return res;
  }, [setSessionId, setPatientId, setStatus]);

  // ── Send an audio chunk ──────────────────────────────────────────────────
  const sendChunk = useCallback(async (
    audiob64: string,
    chunkIndex: number,
  ) => {
    if (!sessionId) throw new Error('No active session');

    return callFunction(
      `sessions/${sessionId}/chunk`,
      { audio_b64: audiob64, chunk_index: chunkIndex },
    );
  }, [sessionId]);

  // ── End session (triggers analyse → SOAP → FHIR pipeline) ───────────────
  const endSession = useCallback(async (): Promise<EndSessionResponse> => {
    if (!sessionId) throw new Error('No active session');

    const res = await callFunction<EndSessionResponse>(
      `sessions/${sessionId}/end`,
      {},
    );

    setRecording(false);
    setStatus('PROCESSING');

    return res;
  }, [sessionId, setRecording, setStatus]);

  // ── Fetch full session data (session + transcripts + SOAP + FHIR) ────────
  const getSession = useCallback(async (id?: string): Promise<GetSessionResponse> => {
    const sid = id ?? sessionId;
    if (!sid) throw new Error('No session ID');

    const res = await callFunction<GetSessionResponse>(
      `sessions/${sid}`,
      undefined,
      'GET',
    );

    if (res.soap_note) {
      setSoapNote(res.soap_note);
      setStatus(res.session.status);
    }

    return res;
  }, [sessionId, setSoapNote, setStatus]);

  // ── Save doctor edits to SOAP note ───────────────────────────────────────
  const patchSoap = useCallback(async (
    edits: Record<string, unknown>,
  ) => {
    if (!sessionId) throw new Error('No active session');

    return callFunction(
      `sessions/${sessionId}/soap`,
      { doctor_edits: edits } satisfies PatchSOAPRequest,
      'PATCH',
    );
  }, [sessionId]);

  // ── Finalise session → generate PDF ─────────────────────────────────────
  const finaliseSession = useCallback(async (): Promise<FinaliseResponse> => {
    if (!sessionId) throw new Error('No active session');

    const res = await callFunction<FinaliseResponse>(
      `sessions/${sessionId}/finalise`,
      {},
    );

    setStatus('COMPLETE');

    return res;
  }, [sessionId, setStatus]);

  // ── Reset local session state (call after navigating away) ───────────────
  const clearSession = useCallback(() => {
    resetSession();
  }, [resetSession]);

  return {
    sessionId,
    startSession,
    sendChunk,
    endSession,
    getSession,
    patchSoap,
    finaliseSession,
    clearSession,
  };
}