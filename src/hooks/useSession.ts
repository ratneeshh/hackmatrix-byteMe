import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../api/supabase';
import { useSessionStore } from '../store/sessionStore';
import { useAuthStore } from '../store/authStore';

/**
 * useSession — master hook for session lifecycle.
 *
 * Responsibilities:
 *  - startSession(patientId): calls /sessions/start, sets sessionId in store
 *  - endSession():            calls /sessions/{id}/end, sets status to PROCESSING
 *  - finaliseSession(edits):  patches soap edits then calls /sessions/{id}/finalise
 *  - resetAndGoHome():        clears store and navigates home
 *
 * Does NOT own recording or transcript streaming — those live in
 * AmbientRecorder and useTranscriptStream respectively.
 */
export const useSession = () => {
  const router = useRouter();
  const { doctor } = useAuthStore();
  const {
    sessionId,
    setSessionId,
    setPatientId,
    setStatus,
    setRecording,
    resetSession,
  } = useSessionStore();

  // Track in-flight requests to avoid duplicates
  const endingRef = useRef(false);
  const finalisingRef = useRef(false);

  // ─────────────────────────────────────────────────────────────
  // startSession
  // ─────────────────────────────────────────────────────────────
  const startSession = useCallback(
    async (patientId: string): Promise<string | null> => {
      try {
        resetSession();
        setPatientId(patientId);

        const language = doctor?.preferred_language ?? 'en-hi';

        const { data, error } = await supabase.functions.invoke('sessions/start', {
          body: { patient_id: patientId, language },
        });

        if (error) throw error;
        if (!data?.session_id) throw new Error('No session_id returned');

        setSessionId(data.session_id);
        setStatus('RECORDING');

        return data.session_id as string;
      } catch (e: any) {
        console.error('startSession error:', e);
        Alert.alert('Error', e.message ?? 'Failed to start session');
        return null;
      }
    },
    [doctor]
  );

  // ─────────────────────────────────────────────────────────────
  // endSession  (called after recording stops)
  // ─────────────────────────────────────────────────────────────
  const endSession = useCallback(async () => {
    if (!sessionId || endingRef.current) return;
    endingRef.current = true;

    try {
      setRecording(false);
      setStatus('PROCESSING');

      const { error } = await supabase.functions.invoke(`sessions/${sessionId}/end`, {
        body: {},
      });

      if (error) throw error;
      // Status will transition to REVIEW via Realtime analysis_complete event
    } catch (e: any) {
      console.error('endSession error:', e);
      setStatus('FAILED');
      Alert.alert('Error', e.message ?? 'Failed to end session');
    } finally {
      endingRef.current = false;
    }
  }, [sessionId]);

  // ─────────────────────────────────────────────────────────────
  // finaliseSession  (called from review screen)
  // ─────────────────────────────────────────────────────────────
  const finaliseSession = useCallback(
    async (doctorEdits: Record<string, any> = {}): Promise<string | null> => {
      if (!sessionId || finalisingRef.current) return null;
      finalisingRef.current = true;

      try {
        // 1. Persist doctor edits to soap_notes
        if (Object.keys(doctorEdits).length > 0) {
          const { error: patchError } = await supabase.functions.invoke(
            `sessions/${sessionId}/soap`,
            { body: { doctor_edits: doctorEdits } }
          );
          if (patchError) throw patchError;
        }

        // 2. Finalise: triggers prescription PDF generation
        const { data, error } = await supabase.functions.invoke(
          `sessions/${sessionId}/finalise`,
          { body: {} }
        );
        if (error) throw error;

        setStatus('COMPLETE');
        return data?.pdf_url ?? null;
      } catch (e: any) {
        console.error('finaliseSession error:', e);
        Alert.alert('Error', e.message ?? 'Failed to finalise session');
        return null;
      } finally {
        finalisingRef.current = false;
      }
    },
    [sessionId]
  );

  // ─────────────────────────────────────────────────────────────
  // resetAndGoHome
  // ─────────────────────────────────────────────────────────────
  const resetAndGoHome = useCallback(() => {
    resetSession();
    router.replace('/(app)');
  }, []);

  return {
    sessionId,
    startSession,
    endSession,
    finaliseSession,
    resetAndGoHome,
  };
};