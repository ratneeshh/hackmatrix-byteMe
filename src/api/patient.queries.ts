/**
 * patient.queries.ts
 * TanStack Query hooks for patient search and creation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Patient } from '../../shared/types/db';
import { useAuthStore } from '../store/authStore';

export const patientKeys = {
  all:    ['patients'] as const,
  search: (term: string) => [...patientKeys.all, 'search', term] as const,
  detail: (id: string)   => [...patientKeys.all, 'detail', id] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// usePatientSearch — debounced search used in PatientSearch component
// ─────────────────────────────────────────────────────────────────────────────

export const usePatientSearch = (term: string) =>
  useQuery<Patient[]>({
    queryKey: patientKeys.search(term),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .ilike('name', `%${term}%`)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: term.length >= 2,
    staleTime: 1000 * 10,
  });

// ─────────────────────────────────────────────────────────────────────────────
// useCreatePatient — mutation to create a new patient record
// ─────────────────────────────────────────────────────────────────────────────

export const useCreatePatient = () => {
  const qc = useQueryClient();
  const { doctor } = useAuthStore();

  return useMutation<
    Patient,
    Error,
    { name: string; age: number; gender: 'MALE' | 'FEMALE' | 'OTHER'; mobile?: string; abha_id?: string }
  >({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from('patients')
        .insert({ doctor_id: doctor!.id, ...payload })
        .select()
        .single();
      if (error) throw error;
      return data as Patient;
    },
    onSuccess: () => {
      // Bust all patient search caches so new patient appears
      qc.invalidateQueries({ queryKey: patientKeys.all });
    },
  });
};