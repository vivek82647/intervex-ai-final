/**
 * API Client - Axios instance with JWT auth interceptors
 */
import axios, { AxiosError } from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Auth token interceptor
api.interceptors.request.use((config) => {
  const token = Cookies.get('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Refresh token interceptor
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as any;
    
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = Cookies.get('refresh_token');
      
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, {
            refresh_token: refresh,
          });
          Cookies.set('access_token', data.access_token, { expires: 1 });
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          Cookies.remove('access_token');
          Cookies.remove('refresh_token');
          window.location.href = '/auth/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  adminRegister: (data: any) => api.post('/auth/admin/register', data),
  adminLogin: (data: any) => api.post('/auth/admin/login', data),
  studentJoin: (data: any) => api.post('/auth/student/join', data),
  getMe: () => api.get('/auth/me'),
  getSessionByLink: (link: string) => api.get(`/sessions/join/${link}`),
};

// ─── Admin ────────────────────────────────────────────────────────────────────

export const adminApi = {
  getDashboard: () => api.get('/admin/dashboard'),
  getProfile: () => api.get('/admin/profile'),
};

// ─── Classes ──────────────────────────────────────────────────────────────────

export const classApi = {
  create: (data: any) => api.post('/classes', data),
  list: () => api.get('/classes'),
  enrollStudent: (classId: string, studentId: string) =>
    api.post(`/classes/${classId}/students/${studentId}`),
};

// ─── Students ─────────────────────────────────────────────────────────────────

export const studentApi = {
  create: (data: any) => api.post('/students', data),
  list: () => api.get('/students'),
};

// ─── Questions ────────────────────────────────────────────────────────────────

export const questionApi = {
  create: (data: any) => api.post('/questions', data),
  list: (params?: any) => api.get('/questions', { params }),
  stats: () => api.get('/questions/stats'),
  aiGenerate: (data: any) => api.post('/questions/ai-generate', data),
  uploadCsv: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/questions/csv-upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (id: string) => api.delete(`/questions/${id}`),
};

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const sessionApi = {
  create: (data: any) => api.post('/sessions', data),
  list: (params?: any) => api.get('/sessions', { params }),
  get: (id: string) => api.get(`/sessions/${id}`),
  updateStatus: (id: string, status: string) =>
    api.patch(`/sessions/${id}/status`, { status }),
  getQuestions: (id: string) => api.get(`/sessions/${id}/questions`),
  getLiveStatus: (id: string) => api.get(`/sessions/${id}/live-status`),
};

// ─── Attempts ─────────────────────────────────────────────────────────────────

export const attemptApi = {
  start: (data: any) => api.post('/attempts/start', data),
  saveAnswer: (attemptId: string, data: any) =>
    api.post(`/attempts/${attemptId}/answer`, data),
  runCode: (attemptId: string, data: any) =>
    api.post(`/attempts/${attemptId}/run-code`, data),
  recordWarning: (attemptId: string, data: any) =>
    api.post(`/attempts/${attemptId}/warning`, data),
  submit: (attemptId: string) => api.post(`/attempts/${attemptId}/submit`),
  getResult: (attemptId: string) => api.get(`/attempts/${attemptId}/result`),
};

// ─── Results ──────────────────────────────────────────────────────────────────

export const resultsApi = {
  sessionResults: (sessionId: string) => api.get(`/results/session/${sessionId}`),
  exportCsv: (sessionId: string) =>
    api.get(`/results/session/${sessionId}/export/csv`, { responseType: 'blob' }),
  analytics: (sessionId: string) =>
    api.get(`/results/session/${sessionId}/analytics`),
};
