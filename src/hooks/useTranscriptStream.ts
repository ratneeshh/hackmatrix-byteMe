import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../api/supabase';
import { useSessionStore } from '../store/sessionStore';
import type { TranscriptChunk } from '../../shared/types/db';

/**
 * Subscribes to the Supabase Realtime channel for the active session.
 *
 * Events handled:
 *   transcript_chunk   → appended to sessionStore.transcriptChunks
 *   analysis_complete  → navigate to review screen
 *   fhir_ready         → (no-op here; useFHIRBundle handles it)
 *   error              → logged; could trigger a toast via error store
 */
export function useTranscriptStream(sessionId: string | null) {
  const router     = useRouter();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { appendChunk, setStatus } = useSessionStore();

  useEffect(() => {
    if (!sessionId) return;

    const channelName = `session:${sessionId}`;

    // Unsubscribe any existing channel before creating a new one
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'transcript_chunk' }, ({ payload }) => {
        if (!payload) return;

        const chunk: TranscriptChunk = {
          id:            payload.id ?? `${sessionId}-${payload.chunk_index}`,
          session_id:    sessionId,
          chunk_index:   payload.chunk_index,
          text:          payload.text,
          speaker_label: payload.speaker_label ?? 'UNKNOWN',
          confidence:    payload.confidence ?? 1,
          created_at:    payload.created_at ?? new Date().toISOString(),
        };

        appendChunk(chunk);
      })
      .on('broadcast', { event: 'analysis_complete' }, ({ payload }) => {
        console.log('analysis_complete:', payload);
        setStatus('REVIEW');
        // Navigate to review screen — Expo Router push
        router.replace(`/session/review`);
      })
      .on('broadcast', { event: 'fhir_ready' }, ({ payload }) => {
        console.log('fhir_ready:', payload);
        // useFHIRBundle will pick this up via its own subscription or poll
      })
      .on('broadcast', { event: 'pdf_ready' }, ({ payload }) => {
        console.log('pdf_ready:', payload);
        // PrescriptionPDF.tsx listens for this via its own subscription
      })
      .on('broadcast', { event: 'error' }, ({ payload }) => {
        console.error('session realtime error:', payload);
        setStatus('FAILED');
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          console.log(`Realtime subscribed to ${channelName}`);
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId]);
}