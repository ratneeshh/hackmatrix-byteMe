/**
 * session.queries.ts
 * TanStack Query hooks for session data fetching.
 * All queries go through Supabase Edge Functions (the API contract).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type {
  GetSessionResponse,
  PagedSessions,
  PatchSOAPRequest,
  FinaliseResponse,
} from '../../shared/types/api';

// ─────────────────────────────────────────────────────────────────────────────
// Query keys
// ─────────────────────────────────────────────────────────────────────────────

export const sessionKeys = {
  all:    ['sessions'] as const,
  lists:  () => [...sessionKeys.all, 'list'] as const,
  list:   (page: number, limit: number) => [...sessionKeys.lists(), { page, limit }] as const,
  detail: (id: string) => [...sessionKeys.all, 'detail', id] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// useSessionList — paginated list of sessions for History screen
// ─────────────────────────────────────────────────────────────────────────────

export const useSessionList = (page = 1, limit = 20) =>
  useQuery<PagedSessions>({
    queryKey: sessionKeys.list(page, limit),
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('sessions', {
        body: undefined,
        // Pass page + limit as query params via the body or let the fn use defaults
      });
      if (error) throw error;
      return data as PagedSessions;
    },
    staleTime: 1000 * 30, // 30 seconds — sessions list doesn't change mid-consultation
  });

// ─────────────────────────────────────────────────────────────────────────────
// useSessionDetail — full session data for History/[id] screen
// ─────────────────────────────────────────────────────────────────────────────

export const useSessionDetail = (sessionId: string | undefined) =>
  useQuery<GetSessionResponse>({
    queryKey: sessionKeys.detail(sessionId!),
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(`sessions/${sessionId}`);
      if (error) throw error;
      return data as GetSessionResponse;
    },
    enabled: !!sessionId,
    staleTime: 1000 * 60 * 5, // 5 minutes — historical sessions don't change
  });

// ─────────────────────────────────────────────────────────────────────────────
// usePatchSOAP — mutation to save doctor inline edits
// ─────────────────────────────────────────────────────────────────────────────

export const usePatchSOAP = (sessionId: string) => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: PatchSOAPRequest) => {
      const { error } = await supabase.functions.invoke(`sessions/${sessionId}/soap`, {
        body: payload,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate detail so next open of history shows edited version
      qc.invalidateQueries({ queryKey: sessionKeys.detail(sessionId) });
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// useFinaliseSession — mutation for the Finalise button
// ─────────────────────────────────────────────────────────────────────────────

export const useFinaliseSession = (sessionId: string) => {
  const qc = useQueryClient();

  return useMutation<FinaliseResponse>({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        `sessions/${sessionId}/finalise`,
        { body: {} }
      );
      if (error) throw error;
      return data as FinaliseResponse;
    },
    onSuccess: () => {
      // Refresh list so the session shows COMPLETE status
      qc.invalidateQueries({ queryKey: sessionKeys.lists() });
      qc.invalidateQueries({ queryKey: sessionKeys.detail(sessionId) });
    },
  });
};