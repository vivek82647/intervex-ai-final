/**
 * Auth Store - Zustand state management for authentication
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies from 'js-cookie';

interface AuthState {
  user: {
    id: string;
    email: string;
    full_name: string;
    role: string;
  } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  setUser: (user: AuthState['user']) => void;
  setTokens: (access: string, refresh: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setTokens: (access, refresh) => {
        const secure = window.location.protocol === 'https:';
        Cookies.set('access_token', access, { expires: 1, secure, sameSite: 'strict' });
        Cookies.set('refresh_token', refresh, { expires: 30, secure, sameSite: 'strict' });
      },

      logout: () => {
        Cookies.remove('access_token');
        Cookies.remove('refresh_token');
        set({ user: null, isAuthenticated: false });
        window.location.href = '/auth/login';
      },
    }),
    {
      name: 'intervex-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

// Student session store (no persistence)
interface StudentSessionState {
  studentId: string | null;
  studentName: string | null;
  sessionId: string | null;
  sessionTitle: string | null;
  attemptId: string | null;
  token: string | null;
  
  setSession: (data: Partial<StudentSessionState>) => void;
  clearSession: () => void;
}

export const useStudentStore = create<StudentSessionState>()((set) => ({
  studentId: null,
  studentName: null,
  sessionId: null,
  sessionTitle: null,
  attemptId: null,
  token: null,

  setSession: (data) => set(data),
  clearSession: () => set({
    studentId: null, studentName: null,
    sessionId: null, sessionTitle: null,
    attemptId: null, token: null,
  }),
}));
