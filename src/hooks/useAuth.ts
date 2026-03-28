import { useCallback, useEffect } from 'react';
import { supabase, callFunction } from '../api/supabase';
import { useAuthStore } from '../store/authStore';
import type { Doctor } from '../../shared/types/db';

export function useAuth() {
  const { doctor, isLoading, setDoctor, setToken, setLoading, clearAuth } = useAuthStore();

  // ── Bootstrap: re-hydrate auth state on app launch ──────────────────────
  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user && mounted) {
        setToken(session.access_token);
        await loadDoctorProfile(session.user.id);
      }

      if (mounted) setLoading(false);
    };

    bootstrap();

    // Listen for auth state changes (token refresh, sign-out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (session?.user) {
          setToken(session.access_token);
          await loadDoctorProfile(session.user.id);
        } else {
          clearAuth();
        }

        setLoading(false);
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadDoctorProfile = async (uid: string) => {
    const { data, error } = await supabase
      .from('doctors')
      .select('*')
      .eq('id', uid)
      .single();

    if (!error && data) {
      setDoctor(data as Doctor);
    }
  };

  // ── OTP request ──────────────────────────────────────────────────────────
  const requestOtp = useCallback(async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw error;
  }, []);

  // ── OTP verify ───────────────────────────────────────────────────────────
  const verifyOtp = useCallback(async (phone: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });
    if (error) throw error;
    return data;
  }, []);

  // ── Set PIN (first-time) ─────────────────────────────────────────────────
  const setPin = useCallback(async (pin: string) => {
    await callFunction('auth-otp/set-pin', { pin });
  }, []);

  // ── Verify PIN (daily login) ─────────────────────────────────────────────
  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    try {
      const res = await callFunction<{ valid: boolean }>('auth-otp/verify-pin', { pin });
      return res.valid === true;
    } catch {
      return false;
    }
  }, []);

  // ── Update doctor profile ────────────────────────────────────────────────
  const updateProfile = useCallback(async (updates: Partial<Doctor>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('doctors')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    setDoctor(data as Doctor);
  }, [setDoctor]);

  // ── Sign out ─────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    clearAuth();
  }, [clearAuth]);

  return {
    doctor,
    isLoading,
    isAuthenticated: !!doctor,
    requestOtp,
    verifyOtp,
    setPin,
    verifyPin,
    updateProfile,
    signOut,
  };
}