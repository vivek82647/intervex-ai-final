// ─── API Types ────────────────────────────────────────────────────────────────

export interface Admin {
  id: string;
  email: string;
  full_name: string;
  organization?: string;
  avatar_url?: string;
  role: 'admin' | 'super_admin';
  created_at: string;
}

export interface Student {
  id: string;
  email: string;
  full_name: string;
  roll_number?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
}

export interface Class {
  id: string;
  name: string;
  description?: string;
  subject?: string;
  student_count: number;
  is_active: boolean;
  created_at: string;
}

export interface Question {
  id: string;
  type: 'mcq' | 'descriptive' | 'coding';
  difficulty: 'easy' | 'medium' | 'moderate' | 'hard' | 'high';
  topic: string;
  title: string;
  content: string;
  options?: MCQOption[];
  correct_answer?: string;
  explanation?: string;
  marks: number;
  negative_marks: number;
  time_limit_seconds?: number;
  test_cases?: TestCase[];
  starter_code?: Record<string, string>;
  is_ai_generated: boolean;
  source: string;
  created_at: string;
}

export interface MCQOption {
  id: string;
  text: string;
  is_correct?: boolean;
}

export interface TestCase {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  marks: number;
}

export interface Session {
  id: string;
  title: string;
  description?: string;
  instructions?: string;
  duration_minutes: number;
  total_marks: number;
  passing_marks?: number;
  shuffle_questions: boolean;
  max_warnings: number;
  fullscreen_required: boolean;
  join_link: string;
  join_code: string;
  status: 'draft' | 'active' | 'ended' | 'archived';
  scheduled_start?: string;
  scheduled_end?: string;
  created_at: string;
  question_count: number;
}

export interface Attempt {
  id: string;
  session_id: string;
  student_id: string;
  status: 'not_started' | 'in_progress' | 'submitted' | 'terminated' | 'evaluated';
  started_at?: string;
  submitted_at?: string;
  total_score?: number;
  max_score?: number;
  percentage?: number;
  warning_count: number;
  ai_feedback?: AIFeedback;
  strengths?: string[];
  weaknesses?: string[];
}

export interface AIFeedback {
  overall_feedback: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  performance_level: string;
  next_steps: string;
}

export interface DashboardStats {
  total_classes: number;
  total_students: number;
  total_sessions: number;
  active_sessions: number;
  total_attempts: number;
  avg_score: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  role: string;
  user_id: string;
  email: string;
  full_name: string;
}

// ─── UI Types ─────────────────────────────────────────────────────────────────

export type QuestionFilter = {
  topic?: string;
  type?: string;
  difficulty?: string;
  search?: string;
};

export interface LiveStudent {
  student_id: string;
  student_name: string;
  status: string;
  warning_count: number;
  progress: number;
  time_remaining?: number;
  connected: boolean;
  joined_at?: string;
  last_activity?: string;
  ip_address?: string;   // ← NEW
  user_agent?: string;   // ← NEW
}

export interface AnswerDraft {
  question_id: string;
  selected_option?: string;
  text_answer?: string;
  code_answer?: string;
  language?: string;
}
