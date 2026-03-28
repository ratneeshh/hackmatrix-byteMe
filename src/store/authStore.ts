import { create } from 'zustand';
import { Doctor } from '../../shared/types/db';

type AuthState = {
  doctor: Doctor | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setDoctor: (doctor: Doctor | null) => void;
  setAuthenticated: (val: boolean) => void;
  setLoading: (val: boolean) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  doctor: null,
  isAuthenticated: false,
  isLoading: true,
  setDoctor: (doctor) => set({ doctor }),
  setAuthenticated: (val) => set({ isAuthenticated: val }),
  setLoading: (val) => set({ isLoading: val }),
  logout: () => set({ doctor: null, isAuthenticated: false }),
}));