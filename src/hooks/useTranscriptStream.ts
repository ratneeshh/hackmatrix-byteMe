import { useEffect } from 'react';
import { supabase } from '../api/supabase';
import { useSessionStore } from '../store/sessionStore';
import { useRouter } from 'expo-router';
import {
  RealtimeTranscriptChunk,
  RealtimeAnalysisComplete,
  RealtimeFHIRReady,
  RealtimePDFReady,
  RealtimeError,
} from '../../shared/types/api';
import { TranscriptChunk } from '../../shared/types/db';

export const useTranscriptStream = (sessionId: string | null) => {
  const { appendTranscript, setSoapNote, setFhirBundle, setPdfUrl, setStatus } = useSessionStore();
  const router = useRouter();

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase.channel(`session:${sessionId}`)
      .on('broadcast', { event: 'transcript_chunk' }, ({ payload }) => {
        const chunk = payload as RealtimeTranscriptChunk;
        const transcriptChunk: TranscriptChunk = {
          id: `${sessionId}-${chunk.chunk_index}`,
          session_id: sessionId,
          chunk_index: chunk.chunk_index,
          text: chunk.text,
          speaker_label: chunk.speaker_label,
          confidence: chunk.confidence,
          created_at: new Date().toISOString(),
        };
        appendTranscript(transcriptChunk);
      })
      .on('broadcast', { event: 'analysis_complete' }, async ({ payload }) => {
        const { soap_note_id } = payload as RealtimeAnalysisComplete;
        setStatus('REVIEW');
        // Fetch the SOAP note
        const { data } = await supabase
          .from('soap_notes')
          .select('*')
          .eq('id', soap_note_id)
          .single();
        if (data) {
          setSoapNote(data);
          router.push('/(app)/session/review');
        }
      })
      .on('broadcast', { event: 'fhir_ready' }, async ({ payload }) => {
        const { bundle_id } = payload as RealtimeFHIRReady;
        const { data } = await supabase
          .from('fhir_bundles')
          .select('*')
          .eq('id', bundle_id)
          .single();
        if (data) setFhirBundle(data);
      })
      .on('broadcast', { event: 'pdf_ready' }, ({ payload }) => {
        const { pdf_url } = payload as RealtimePDFReady;
        setPdfUrl(pdf_url);
      })
      .on('broadcast', { event: 'error' }, ({ payload }) => {
        const { message } = payload as RealtimeError;
        console.error('Session error:', message);
        setStatus('FAILED');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);
};