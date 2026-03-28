/**
 * analytics.queries.ts
 * TanStack Query hooks for the Analytics dashboard.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { AnalyticsSummary, AnalyticsWeekly } from '../../shared/types/api';

export const analyticsKeys = {
  all:     ['analytics'] as const,
  summary: () => [...analyticsKeys.all, 'summary'] as const,
  weekly:  () => [...analyticsKeys.all, 'weekly'] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// useAnalyticsSummary — KPI cards on Home + Analytics screen
// ─────────────────────────────────────────────────────────────────────────────

export const useAnalyticsSummary = () =>
  useQuery<AnalyticsSummary>({
    queryKey: analyticsKeys.summary(),
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('analytics/summary');
      if (error) throw error;
      return data as AnalyticsSummary;
    },
    staleTime: 1000 * 60 * 2, // Refresh every 2 minutes
  });

// ─────────────────────────────────────────────────────────────────────────────
// useAnalyticsWeekly — bar chart data on Analytics screen
// ─────────────────────────────────────────────────────────────────────────────

export const useAnalyticsWeekly = () =>
  useQuery<AnalyticsWeekly>({
    queryKey: analyticsKeys.weekly(),
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('analytics/weekly');
      if (error) throw error;
      return data as AnalyticsWeekly;
    },
    staleTime: 1000 * 60 * 5,
  });