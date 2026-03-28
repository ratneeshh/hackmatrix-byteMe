import { create } from 'zustand';
import type { Doctor } from '../../shared/types/db';

interface AuthState {
  doctor:       Doctor | null;
  accessToken:  string | null;
  isLoading:    boolean;

  setDoctor:     (doctor: Doctor | null) => void;
  setToken:      (token: string | null) => void;
  setLoading:    (loading: boolean) => void;
  clearAuth:     () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  doctor:      null,
  accessToken: null,
  isLoading:   true,

  setDoctor:  (doctor)  => set({ doctor }),
  setToken:   (token)   => set({ accessToken: token }),
  setLoading: (loading) => set({ isLoading: loading }),

  clearAuth: () => set({ doctor: null, accessToken: null }),
}));