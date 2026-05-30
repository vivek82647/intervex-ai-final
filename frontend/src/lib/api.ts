/**
 * API Client - With retry logic for Render cold starts
 */
import axios, { AxiosError } from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://intervex-ai-final.onrender.com/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 90000, // 90s — Render cold start takes 50s+
  headers: { 'Content-Type': 'application/json' },
});

// Auth token interceptor
api.interceptors.request.use((config) => {
  const token = Cookies.get('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Retry + refresh interceptor
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as any;

    // Retry once on network error or 503 (Render waking up)
    if (!original._retry && (!error.response || error.response.status === 503 || error.code === 'ECONNABORTED')) {
      original._retry = true;
      await new Promise(r => setTimeout(r, 3000)); // wait 3s then retry
      return api(original);
    }

    // Refresh token on 401
    if (error.response?.status === 401 && !original._refreshed) {
      original._refreshed = true;
      const refresh = Cookies.get('refresh_token');
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refresh });
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

  getSessionByLink: (link: string) =>
    api.get(`/sessions/join/${link}`),
};

// ─── Sessions ─────────────────────────────────────────────────────────────────
export const sessionApi = {
  create: (data: any) => api.post('/sessions', data),
  list: (params?: any) => api.get('/sessions', { params }),
  get: (id: string) => api.get(`/sessions/${id}`),
  update: (id: string, data: any) => api.patch(`/sessions/${id}`, data),
  delete: (id: string) => api.delete(`/sessions/${id}`),
 activate: (id: string) =>
  api.patch(`/sessions/${id}/status`, {
    status: 'active'
  }),
  
end: (id: string) =>
  api.patch(`/sessions/${id}/status`, {
    status: 'ended'
  }),
  getQuestions: (id: string) => api.get(`/sessions/${id}/questions`),
  addQuestions: (id: string, data: any) => api.post(`/sessions/${id}/questions`, data),
  getMonitor: (id: string) => api.get(`/sessions/${id}/monitor`),
};

// ─── Questions ────────────────────────────────────────────────────────────────
export const questionApi = {
  list: (params?: any) => api.get('/questions', { params }),
  create: (data: any) => api.post('/questions', data),
  delete: (id: string) => api.delete(`/questions/${id}`),
  stats: () => api.get('/questions/stats'),
  aiGenerate: (data: any) => api.post('/questions/ai-generate', data),
  csvUpload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/questions/csv-upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
  },
};

// ─── Students ─────────────────────────────────────────────────────────────────
export const studentApi = {
  list: (params?: any) => api.get('/students', { params }),
  create: (data: any) => api.post('/students', data),
  delete: (id: string) => api.delete(`/students/${id}`),
  bulkCreate: (data: any) => api.post('/students/bulk', data),
};

// ─── Attempts ─────────────────────────────────────────────────────────────────
export const attemptApi = {
  start: (data: any) => api.post('/attempts/start', data),
  saveAnswer: (attemptId: string, data: any) => api.post(`/attempts/${attemptId}/answer`, data),
  submit: (attemptId: string) => api.post(`/attempts/${attemptId}/submit`),
  getResult: (attemptId: string) => api.get(`/attempts/${attemptId}/result`),
  recordWarning: (attemptId: string, data: any) => api.post(`/attempts/${attemptId}/warning`, data),
  runCode: (attemptId: string, data: any) => api.post(`/attempts/${attemptId}/run-code`, data),
};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  dashboard: () => api.get('/admin/dashboard'),
  results: (sessionId: string) =>
  api.get(`/results/session/${sessionId}`),
};

// ─── Classes ──────────────────────────────────────────────────────────────────
export const classApi = {
  list: () => api.get('/classes'),
  create: (data: any) => api.post('/classes', data),
  delete: (id: string) => api.delete(`/classes/${id}`),

  enrollStudent: (classId: string, studentId: string) =>
    api.post(`/classes/${classId}/students/${studentId}`),
};