import { useState } from 'react';
import { supabase } from '../api/supabase';
import { useAuthStore } from '../store/authStore';
import { useRouter } from 'expo-router';

export const useAuth = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setDoctor, setAuthenticated, logout } = useAuthStore();
  const router = useRouter();

  // Step 1: Request OTP
  const requestOTP = async (phone: string) => {
    setLoading(true);
    setError(null);
    try {
      const formatted = phone.startsWith('+91') ? phone : `+91${phone}`;
      const { error } = await supabase.auth.signInWithOtp({ phone: formatted });
      if (error) throw error;
      return { success: true, phone: formatted };
    } catch (e: any) {
      setError(e.message || 'Failed to send OTP');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const verifyOTP = async (phone: string, token: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: 'sms',
      });
      if (error) throw error;

      // Check if doctor profile exists
      const { data: doctor } = await supabase
        .from('doctors')
        .select('*')
        .eq('id', data.user!.id)
        .single();

      if (doctor) {
        // Returning doctor — go to PIN setup confirmation
        setDoctor(doctor);
        setAuthenticated(true);
        router.replace('/(app)/');
      } else {
        // New doctor — needs to set PIN + profile
        router.replace('/(auth)/verify');
      }
      return { success: true, isNewUser: !doctor };
    } catch (e: any) {
      setError(e.message || 'Invalid OTP');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Set PIN (new doctor)
  const setPin = async (pin: string, profile: {
    name: string;
    speciality: string;
    clinic_name: string;
    city: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Call Edge Function to hash + store PIN
      const { error: pinError } = await supabase.functions.invoke('auth-otp/set-pin', {
        body: { pin },
      });
      if (pinError) throw pinError;

      // Create doctor profile
      const { data: doctor, error: profileError } = await supabase
        .from('doctors')
        .insert({
          id: user.id,
          mobile_number: user.phone,
          ...profile,
          preferred_language: 'en-hi',
        })
        .select()
        .single();
      if (profileError) throw profileError;

      setDoctor(doctor);
      setAuthenticated(true);
      router.replace('/(app)/');
      return { success: true };
    } catch (e: any) {
      setError(e.message || 'Failed to set PIN');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Daily PIN login
  const verifyPin = async (pin: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('auth-otp/verify-pin', {
        body: { pin },
      });
      if (error || !data?.valid) throw new Error('Invalid PIN');

      // Fetch doctor profile
      const { data: { user } } = await supabase.auth.getUser();
      const { data: doctor } = await supabase
        .from('doctors')
        .select('*')
        .eq('id', user!.id)
        .single();

      setDoctor(doctor);
      setAuthenticated(true);
      router.replace('/(app)/');
      return { success: true };
    } catch (e: any) {
      setError(e.message || 'Invalid PIN');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const signOut = async () => {
    await supabase.auth.signOut();
    logout();
    router.replace('/(auth)/login');
  };

  return { requestOTP, verifyOTP, setPin, verifyPin, signOut, loading, error };
};