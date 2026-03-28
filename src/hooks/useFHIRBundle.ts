import { useEffect } from 'react';
import { supabase } from '../api/supabase';
import { useSessionStore } from '../store/sessionStore';

/**
 * useFHIRBundle
 *
 * Fetches and caches the FHIR bundle for the active session.
 * Usually populated via Realtime (fhir_ready event in useTranscriptStream),
 * but this hook acts as a fallback: if sessionId exists and fhirBundle is
 * missing, it polls the DB once to hydrate the store.
 *
 * Place this hook on the review screen so the FHIR tab auto-populates
 * even if the Realtime event was missed (e.g. app was backgrounded).
 */
export const useFHIRBundle = (sessionId: string | null) => {
  const { fhirBundle, setFhirBundle } = useSessionStore();

  useEffect(() => {
    if (!sessionId || fhirBundle) return;

    let cancelled = false;

    const fetchBundle = async () => {
      try {
        const { data, error } = await supabase
          .from('fhir_bundles')
          .select('*')
          .eq('session_id', sessionId)
          .maybeSingle();

        if (!cancelled && !error && data) {
          setFhirBundle(data);
        }
      } catch (e) {
        console.error('useFHIRBundle fetch error:', e);
      }
    };

    fetchBundle();

    // Also subscribe to the fhir_ready event in case it fires later
    const channel = supabase
      .channel(`fhir-fallback:${sessionId}`)
      .on('broadcast', { event: 'fhir_ready' }, async ({ payload }) => {
        if (cancelled) return;
        const { bundle_id } = payload as { bundle_id: string };
        const { data } = await supabase
          .from('fhir_bundles')
          .select('*')
          .eq('id', bundle_id)
          .single();
        if (data && !cancelled) setFhirBundle(data);
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return { fhirBundle };
};