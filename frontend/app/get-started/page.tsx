"use client";

import { useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://localhost:8000";

export default function GetStartedPage() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("resume_text", resumeText);
      fd.append("job_description", jobDescription);
      const res = await fetch(`${API_BASE}/api/resume/tailor`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || "Tailoring failed");
      }
      setResult(data);
      // If we have an email, also trigger a job alert scan in the background.
      if (email) {
        fetch(
          `${API_BASE}/api/jobs/alerts?email=${encodeURIComponent(email)}&q=${encodeURIComponent(jobDescription.slice(0, 60))}`,
        ).catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "6rem 1.25rem 4rem",
        maxWidth: 880,
        margin: "0 auto",
      }}
    >
      <a href="/" style={{ opacity: 0.6, fontSize: 13 }}>
        ← Back to CareerOS
      </a>
      <h1
        style={{
          fontSize: "clamp(2rem, 6vw, 3.4rem)",
          lineHeight: 1.02,
          margin: "1.5rem 0 0.5rem",
          letterSpacing: "-0.02em",
        }}
      >
        Start with your resume
      </h1>
      <p style={{ opacity: 0.65, marginBottom: "2.5rem", maxWidth: 560 }}>
        Paste your resume and a job description. CareerOS tailors the framing to
        the role without inventing experience, and finds live matching jobs.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{ display: "grid", gap: "1.25rem" }}
      >
        <Field label="Your email (for job alerts)">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={inputStyle}
          />
        </Field>

        <Field label="Resume text">
          <textarea
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Paste your resume content here…"
            rows={8}
            style={inputStyle}
          />
        </Field>

        <Field label="Target job description">
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description you are applying to…"
            rows={8}
            style={inputStyle}
          />
        </Field>

        <button
          type="submit"
          disabled={loading || !resumeText || jobDescription.length < 20}
          className="primary-cta"
          style={{
            justifySelf: "start",
            padding: "0.85rem 1.5rem",
            opacity: loading ? 0.6 : 1,
            cursor: "pointer",
          }}
        >
          <span>{loading ? "Working…" : "Tailor my resume"}</span>
          <span aria-hidden="true">↗</span>
        </button>
      </form>

      {error && (
        <div
          style={{
            marginTop: "2rem",
            padding: "1rem 1.25rem",
            border: "1px solid #b4453a",
            borderRadius: 10,
            color: "#ffb4ab",
            background: "rgba(180,69,58,0.12)",
          }}
        >
          <strong>Could not complete:</strong> {error}
          {error.includes("429") && (
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
              The AI key is rate-limited. Add a Gemini API key in the backend
              <code> .env</code> to enable live tailoring.
            </div>
          )}
        </div>
      )}

      {result && (
        <div style={{ marginTop: "2.5rem" }}>
          <h2 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>
            Result
          </h2>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              padding: "1.25rem",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10,
  padding: "0.75rem 0.9rem",
  color: "inherit",
  font: "inherit",
  resize: "vertical",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: "0.5rem", fontSize: 13, opacity: 0.8 }}>
      {label}
      {children}
    </label>
  );
}
