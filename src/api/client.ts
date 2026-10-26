/**
 * api/client.ts — Typed API client for the GRYNDR FastAPI backend.
 * All functions return typed data or throw with a user-friendly message.
 */

export const API_BASE = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

async function req<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new Error(controller.signal.aborted
      ? "The API request timed out. Refresh before retrying a save to avoid duplicates."
      : "Cannot reach the API at " + API_BASE + ". Start the backend and try Refresh.");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let msg = `API error ${res.status} for ${options.method ?? "GET"} ${path}. Check the backend terminal for details.`;
    try {
      const err = await res.json();
      msg = Array.isArray(err.detail)
        ? err.detail.map((item: { loc: string[]; msg: string }) => `${item.loc.slice(1).join(".")}: ${item.msg}`).join("; ")
        : typeof err.detail === "string" ? err.detail : JSON.stringify(err);
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Subject {
  id: number;
  name: string;
  exam_date: string | null;
  color: string;
  created_at: string;
  topic_count: number;
}

export interface Topic {
  id: number;
  subject_id: number;
  name: string;
  confidence: number;
  prev_quiz_score: number;
  days_since_revision: number;
  available_hours: number;
  complexity: number;
  predicted_difficulty: "Easy" | "Medium" | "Hard" | null;
  difficulty_prob_easy: number | null;
  difficulty_prob_medium: number | null;
  difficulty_prob_hard: number | null;
  priority_score: number;
  is_demo: boolean;
  created_at: string;
  subject_name: string;
}

export interface Session {
  id: number;
  topic_id: number;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  status: "upcoming" | "active" | "done" | "skipped";
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  topic_name: string;
  subject_name: string;
}

export interface AgentLogEntry {
  id: number;
  action: string;
  details: string;
  created_at: string;
}

export interface AgentResult {
  success: boolean;
  sessions_created: number;
  sessions_modified: number;
  actions: AgentLogEntry[];
  explanation: string;
}

export interface PredictResponse {
  difficulty: "Easy" | "Medium" | "Hard";
  probabilities: { Easy: number; Medium: number; Hard: number };
  features_used: Record<string, number>;
}

export interface Analytics {
  total_subjects: number;
  total_topics: number;
  sessions_completed: number;
  sessions_upcoming: number;
  average_quiz_score: number;
  topics_by_difficulty: Record<string, number>;
  weekly_minutes: { day: string; date: string; minutes: number; planned: number }[];
  subject_hours: { name: string; hours: number; color: string }[];
  model_metrics: Record<string, unknown>;
  total_study_minutes: number;
  quiz_count: number;
}

// ─── Subjects ─────────────────────────────────────────────────────────────────
export interface QuizResult { id: number; topic_id: number; score: number; taken_at: string; notes: string | null }
export interface PlanSettings { days_ahead: number; daily_hours: number }

export const api = {
  settings: () => req<PlanSettings>("/planner-settings"),
  async health() {
    return req<{ status: string }>("/health");
  },

  subjects: {
    list: () => req<Subject[]>("/subjects"),
    create: (data: { name: string; exam_date?: string; color?: string }) =>
      req<Subject>("/subjects", { method: "POST", body: JSON.stringify(data) }),
  },

  topics: {
    list: (subjectId?: number) =>
      req<Topic[]>(subjectId ? `/topics?subject_id=${subjectId}` : "/topics"),
    create: (data: Omit<Topic, "id" | "predicted_difficulty" | "difficulty_prob_easy" | "difficulty_prob_medium" | "difficulty_prob_hard" | "priority_score" | "is_demo" | "created_at" | "subject_name">) =>
      req<Topic>("/topics", { method: "POST", body: JSON.stringify(data) }),
  },

  ml: {
    predict: (data: {
      topic_id?: number;
      confidence: number;
      prev_quiz_score: number;
      days_since_revision: number;
      available_hours: number;
      complexity: number;
    }) =>
      req<PredictResponse>("/predict-difficulty", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  plan: {
    get: (status?: string) =>
      req<Session[]>(status ? `/study-plan?status=${status}` : "/study-plan"),
    generate: (data: { days_ahead?: number; daily_hours?: number; start_date?: string }) =>
      req<AgentResult>("/study-plan/generate", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    replan: (reason: string = "quiz_score_updated", settings?: PlanSettings) =>
      req<AgentResult>("/study-plan/replan", {
        method: "POST",
        body: JSON.stringify({ reason, ...settings }),
      }),
  },

  sessions: {
    complete: async (sessionId: number, data: { notes?: string; new_quiz_score?: number } = {}) => {
      const saved = await req<Session>(`/sessions/${sessionId}/complete`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (saved.id !== sessionId || saved.status !== "done" || !saved.completed_at) {
        throw new Error("The API did not confirm completion for this session. Refresh to check its saved status.");
      }
      return saved;
    },
  },

  quiz: {
    list: () => req<QuizResult[]>("/quiz-results"),
    add: (data: { topic_id: number; score: number; notes?: string }) =>
      req<QuizResult>("/quiz-results", { method: "POST", body: JSON.stringify(data) }),
  },

  analytics: {
    get: () => req<Analytics>("/analytics"),
  },

  agentLogs: {
    list: (limit = 50) => req<AgentLogEntry[]>(`/agent-logs?limit=${limit}`),
  },
};
