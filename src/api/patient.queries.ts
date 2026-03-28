import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Patient } from '../../shared/types/db';

// ── Query keys ───────────────────────────────────────────────────────────────
export const patientKeys = {
  all:    ['patients'] as const,
  search: (q: string) => ['patients', 'search', q] as const,
  detail: (id: string) => ['patients', id] as const,
};

// ── Search patients (debounced in PatientSearch.tsx) ─────────────────────────
export function useSearchPatients(query: string) {
  return useQuery({
    queryKey: patientKeys.search(query),
    queryFn: async (): Promise<Patient[]> => {
      if (!query.trim()) return [];

      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .ilike('name', `%${query}%`)
        .order('name', { ascending: true })
        .limit(10);

      if (error) throw error;
      return (data ?? []) as Patient[];
    },
    enabled: query.length >= 2,
    staleTime: 1000 * 30, // 30 seconds
  });
}

// ── Get a single patient ─────────────────────────────────────────────────────
export function usePatient(patientId: string | null) {
  return useQuery({
    queryKey: patientKeys.detail(patientId ?? ''),
    queryFn: async (): Promise<Patient | null> => {
      if (!patientId) return null;

      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

      if (error) throw error;
      return data as Patient;
    },
    enabled: !!patientId,
    staleTime: 1000 * 60 * 5,
  });
}

// ── Create a new patient ─────────────────────────────────────────────────────
export function useCreatePatient() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name:    string;
      age:     number;
      gender:  'MALE' | 'FEMALE' | 'OTHER';
      mobile?: string;
      abha_id?: string;
    }): Promise<Patient> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('patients')
        .insert({ ...input, doctor_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data as Patient;
    },
    onSuccess: () => {
      // Invalidate all patient queries so search results refresh
      qc.invalidateQueries({ queryKey: patientKeys.all });
    },
  });
}