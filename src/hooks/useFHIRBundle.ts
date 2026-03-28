import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../api/supabase';
import type { FHIRBundle } from '../../shared/types/db';

interface UseFHIRBundleResult {
  bundle:    FHIRBundle | null;
  isLoading: boolean;
  error:     string | null;
  refetch:   () => Promise<void>;
}

/**
 * Fetches and caches the FHIR bundle for a session.
 * Also subscribes to the "fhir_ready" Realtime event to auto-load
 * the bundle as soon as the Edge Function finishes generating it.
 */
export function useFHIRBundle(sessionId: string | null): UseFHIRBundleResult {
  const [bundle,    setBundle]    = useState<FHIRBundle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchBundle = useCallback(async () => {
    if (!sessionId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: dbErr } = await supabase
        .from('fhir_bundles')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (dbErr) throw dbErr;
      setBundle(data as FHIRBundle | null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to fetch FHIR bundle');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Initial fetch
  useEffect(() => {
    if (sessionId) {
      fetchBundle();
    } else {
      setBundle(null);
    }
  }, [sessionId, fetchBundle]);

  // Realtime subscription for fhir_ready event
  useEffect(() => {
    if (!sessionId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`fhir:${sessionId}`)
      .on('broadcast', { event: 'fhir_ready' }, () => {
        // Bundle is now in DB — fetch it
        fetchBundle();
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId, fetchBundle]);

  return { bundle, isLoading, error, refetch: fetchBundle };
}