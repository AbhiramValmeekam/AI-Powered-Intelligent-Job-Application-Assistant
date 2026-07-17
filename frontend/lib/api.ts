// Typed client for the CareerOS FastAPI backend.
// Every module in the app talks to the backend through here.

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://localhost:8000";

export type ApiError = { status: number; message: string };

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message =
      (data && (data.detail || data.message)) ||
      `Request failed (${res.status})`;
    const err = new Error(message) as Error & ApiError;
    (err as any).status = res.status;
    throw err;
  }
  // Endpoints return { ok, data } or raw; unwrap .data when present.
  return (data && "data" in data ? data.data : data) as T;
}

// 1. Profile
export const profiles = {
  upsert: (p: any) => request<any>("/api/profiles", {
    method: "POST",
    body: JSON.stringify(p),
  }),
  get: (email: string) => request<any>(`/api/profiles/${encodeURIComponent(email)}`),
};

// 2/3. Job discovery
export const jobs = {
  search: (q: string, opts: { location?: string; useAdzuna?: boolean; useJobdataapi?: boolean } = {}) => {
    const params = new URLSearchParams({ q });
    if (opts.location) params.set("location", opts.location);
    if (opts.useAdzuna === false) params.set("use_adzuna", "false");
    if (opts.useJobdataapi === false) params.set("use_jobdataapi", "false");
    return request<any>(`/api/jobs/search?${params}`);
  },
  analyze: (jobDescription: string) => request<any>("/api/jobs/analyze", {
    method: "POST",
    body: JSON.stringify({ jobDescription }),
  }),
  alerts: (email: string, q?: string) => {
    const params = new URLSearchParams({ email });
    if (q) params.set("q", q);
    return request<any>(`/api/jobs/alerts?${params}`);
  },
  runAlertScan: () => request<any>("/api/jobs/alerts/run", { method: "POST" }),
};

export const notifications = {
  list: (email?: string, unreadOnly = false) => {
    const params = new URLSearchParams();
    if (email) params.set("email", email);
    if (unreadOnly) params.set("unread_only", "true");
    return request<any>(`/api/notifications?${params}`);
  },
};

// 4. Resume tailor
export const resume = {
  parse: (file: File) => {
    const fd = new FormData();
    fd.append("resume_file", file);
    return request<any>("/api/resume/parse", { method: "POST", body: fd });
  },
  tailor: (resumeText: string, jobDescription: string) => {
    const fd = new FormData();
    fd.append("resume_text", resumeText);
    fd.append("job_description", jobDescription);
    return request<any>("/api/resume/tailor", { method: "POST", body: fd });
  },
  coverLetter: (payload: any) => request<any>("/api/cover-letter", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  atsAnalyze: (tailoredResume: any, jobJson: any) => request<any>("/api/ats/analyze", {
    method: "POST",
    body: JSON.stringify({ tailoredResume, jobJson }),
  }),
  missingSkills: (tailoredResume: any, jobJson: any) => request<any>("/api/skills/missing", {
    method: "POST",
    body: JSON.stringify({ tailoredResume, jobJson }),
  }),
  versions: (email?: string) => {
    const params = email ? `?email=${encodeURIComponent(email)}` : "";
    return request<any>(`/api/resume/versions${params}`);
  },
  master: {
    get: (email: string) =>
      request<any>(`/api/resume/master?email=${encodeURIComponent(email)}`),
    upsert: (email: string, text: string) =>
      request<any>("/api/resume/master", {
        method: "POST",
        body: JSON.stringify({ email, text }),
      }),
  },
};

// 8. Scam shield
export const scam = {
  check: (text: string, url?: string, type = "job_posting") =>
    request<any>("/api/scam/check", {
      method: "POST",
      body: JSON.stringify({ text, url, type }),
    }),
};

// 9/10. Intelligence
export const intelligence = {
  companyResearch: (company: string, extraContext = "") =>
    request<any>("/api/company/research", {
      method: "POST",
      body: JSON.stringify({ company, extraContext }),
    }),
  interviewQuestions: (payload: any) => request<any>("/api/interview/questions", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  interviewFeedback: (question: string, answer: string) =>
    request<any>("/api/interview/feedback", {
      method: "POST",
      body: JSON.stringify({ question, answer }),
    }),
  learning: (payload: any) => request<any>("/api/learning/recommend", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  advisor: (payload: any) => request<any>("/api/advisor/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
};

// 11. Applications
export const applications = {
  add: (payload: any) => request<any>("/api/applications", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  autoApply: (payload: { email: string; job: any; resumeText?: string }) =>
    request<any>("/api/applications/auto-apply", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  list: (email?: string, status?: string) => {
    const params = new URLSearchParams();
    if (email) params.set("email", email);
    if (status) params.set("status", status);
    return request<any>(`/api/applications?${params}`);
  },
  update: (appId: string, payload: any) => request<any>(`/api/applications/${appId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }),
};

// 13. Analytics
export const analytics = {
  summary: (email?: string) => {
    const params = email ? `?email=${encodeURIComponent(email)}` : "";
    return request<any>(`/api/analytics/summary${params}`);
  },
};

export { API_BASE };
