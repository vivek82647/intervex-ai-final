/**
 * Auth Store - Zustand + localStorage fallback for Safari ITP
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies from 'js-cookie';

// Safari safe token helpers — Cookie + localStorage dono mein store karo
const saveToken = (key: string, value: string, days: number) => {
  try {
    // Cookie — lax sameSite (Safari strict se block karta hai)
    Cookies.set(key, value, { expires: days, sameSite: 'lax' });
  } catch {}
  try {
    // localStorage fallback — Safari private mode mein bhi kaam karta hai
    localStorage.setItem(key, value);
  } catch {}
};

const getToken = (key: string): string | undefined => {
  try {
    const cookie = Cookies.get(key);
    if (cookie) return cookie;
  } catch {}
  try {
    const local = localStorage.getItem(key);
    if (local) return local;
  } catch {}
  return undefined;
};

const removeToken = (key: string) => {
  try { Cookies.remove(key); } catch {}
  try { localStorage.removeItem(key); } catch {}
};

interface AuthState {
  user: { id: string; email: string; full_name: string; role: string; } | null;
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
        saveToken('access_token', access, 1);
        saveToken('refresh_token', refresh, 30);
      },
      logout: () => {
        removeToken('access_token');
        removeToken('refresh_token');
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

// Student store — WITH persistence so Safari page navigation safe rahe
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

export const useStudentStore = create<StudentSessionState>()(
  persist(
    (set) => ({
      studentId: null,
      studentName: null,
      sessionId: null,
      sessionTitle: null,
      attemptId: null,
      token: null,
      setSession: (data) => {
        // Token ko localStorage mein bhi save karo
        if (data.token) saveToken('access_token', data.token, 1);
        set(data);
      },
      clearSession: () => {
        set({ studentId: null, studentName: null, sessionId: null, sessionTitle: null, attemptId: null, token: null });
      },
    }),
    {
      name: 'intervex-student', // localStorage mein persist hoga
    }
  )
);
