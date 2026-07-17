"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Panel, Field, RunButton, ErrorNote, ResultCard, Pre, inputStyle } from "@/components/Panel";
import * as api from "@/lib/api";
import { JobBoard } from "@/components/JobBoard";
import { ResumeUpload } from "@/components/ResumeUpload";

/* 2. Job Board (LinkedIn/Internshala style) */
export function JobsModule() {
  return <JobBoard />;
}

/* 2b. Alerts */
export function AlertsModule() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);

  async function run(scan = false) {
    setLoading(true); setError(null);
    try {
      if (scan) await api.jobs.runAlertScan();
      setItems(await api.notifications.list(email));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  return (
    <Panel index="02b" eyebrow="Real-time Alerts" title="Your matched job alerts">
      <Field label="Email (same as profile)"><input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <RunButton onClick={() => run(false)} loading={loading} disabled={!email}>Load alerts</RunButton>
        <RunButton onClick={() => run(true)} loading={loading} disabled={!email}>Scan now</RunButton>
      </div>
      <ErrorNote error={error} />
      {items.length > 0 && (
        <ResultCard>
          {items.map((n: any, i) => (
            <div className="app-row" key={i}>
              <span>{n.title} · <span style={{ opacity: 0.6 }}>{n.company}</span></span>
              <div className="chip-row">
                {(n.matchedSkills || []).map((s: string, k: number) => (
                  <span key={k} className="chip chip--match">{s}</span>
                ))}
              </div>
            </div>
          ))}
        </ResultCard>
      )}
    </Panel>
  );
}

/* 3. JD Intelligence */
export function JdModule() {
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  async function run() {
    setLoading(true); setError(null);
    try { setResult(await api.jobs.analyze(jd)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  return (
    <Panel index="03" eyebrow="JD Intelligence" title="Decode the job description">
      <Field label="Job description"><textarea style={inputStyle} rows={5} value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the JD…" /></Field>
      <RunButton onClick={run} loading={loading} disabled={jd.length < 20}>Analyze JD</RunButton>
      <ErrorNote error={error} />
      {result && <ResultCard><Pre data={result} /></ResultCard>}
    </Panel>
  );
}

/* 4. Tailor */
export function TailorModule() {
  const { user } = useUser();
  const [resume, setResume] = useState("");
  const [jd, setJd] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // Load the user's saved master resume + email as the default source.
  useEffect(() => {
    const e = user?.primaryEmailAddress?.emailAddress || "";
    if (!e) return;
    let cancelled = false;
    setEmail(e);
    (async () => {
      try {
        const r = await api.resume.master.get(e);
        if (!cancelled && r?.data?.text) setResume(r.data.text);
      } catch {
        /* no master resume yet — user uploads manually */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function run() {
    setLoading(true); setError(null);
    try { setResult(await api.resume.tailor(resume, jd)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  return (
    <Panel index="04" eyebrow="Resume Tailoring" title="Tailor to the role, keep the facts">
      <ResumeUpload label="Your resume (your saved resume is loaded automatically)" value={resume} onChange={setResume} />
      <Field label="Target job description"><textarea style={inputStyle} rows={5} value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the JD…" /></Field>
      <RunButton onClick={run} loading={loading} disabled={!resume || jd.length < 20}>Tailor resume</RunButton>
      {email && resume && <p className="modal__hint">Using your saved resume for {email}.</p>}
      <ErrorNote error={error} />
      {result && <ResultCard><Pre data={result} /></ResultCard>}
    </Panel>
  );
}

/* 5. Cover Letter */
export function CoverModule() {
  const { user } = useUser();
  const [raw, setRaw] = useState("");
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [letter, setLetter] = useState("");

  // Load the saved master resume as the default source.
  useEffect(() => {
    const e = user?.primaryEmailAddress?.emailAddress || "";
    if (!e) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await api.resume.master.get(e);
        if (!cancelled && r?.data?.text) setRaw(r.data.text);
      } catch {
        /* no master resume yet */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function run() {
    setLoading(true); setError(null);
    try {
      const r = await api.resume.coverLetter({ rawText: raw, jobDescription: jd });
      setLetter(typeof r === "string" ? r : JSON.stringify(r));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  return (
    <Panel index="05" eyebrow="Cover Letter" title="Generate a cover letter">
      <ResumeUpload label="Resume (your saved resume is loaded automatically)" value={raw} onChange={setRaw} />
      <Field label="Job description"><textarea style={inputStyle} rows={4} value={jd} onChange={(e) => setJd(e.target.value)} /></Field>
      <RunButton onClick={run} loading={loading} disabled={!raw || !jd}>Write cover letter</RunButton>
      <ErrorNote error={error} />
      {letter && <ResultCard><pre className="result-pre">{letter}</pre></ResultCard>}
    </Panel>
  );
}

/* 6. ATS */
export function AtsModule() {
  const [tailored, setTailored] = useState("");
  const [jdJson, setJdJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  async function run() {
    setLoading(true); setError(null);
    try { setResult(await api.resume.atsAnalyze(safeJson(tailored, "tailoredResume"), safeJson(jdJson, "jobJson"))); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  return (
    <Panel index="06" eyebrow="ATS Analyzer" title="Score ATS fit">
      <Field label="Tailored resume (JSON or text)"><textarea style={inputStyle} rows={4} value={tailored} onChange={(e) => setTailored(e.target.value)} placeholder='{"skills":["python"]}' /></Field>
      <Field label="Job JSON"><textarea style={inputStyle} rows={4} value={jdJson} onChange={(e) => setJdJson(e.target.value)} placeholder='{"requiredSkills":["python","java"]}' /></Field>
      <RunButton onClick={run} loading={loading} disabled={!tailored || !jdJson}>Analyze ATS</RunButton>
      <ErrorNote error={error} />
      {result && <ResultCard><Pre data={result} /></ResultCard>}
    </Panel>
  );
}

/* 7. Missing Skills */
export function SkillsModule() {
  const [tailored, setTailored] = useState("");
  const [jdJson, setJdJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  async function run() {
    setLoading(true); setError(null);
    try { setResult(await api.resume.missingSkills(safeJson(tailored, "tailoredResume"), safeJson(jdJson, "jobJson"))); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  return (
    <Panel index="07" eyebrow="Missing Skills" title="Find the gaps">
      <Field label="Tailored resume (JSON or text)"><textarea style={inputStyle} rows={4} value={tailored} onChange={(e) => setTailored(e.target.value)} /></Field>
      <Field label="Job JSON"><textarea style={inputStyle} rows={4} value={jdJson} onChange={(e) => setJdJson(e.target.value)} /></Field>
      <RunButton onClick={run} loading={loading} disabled={!tailored || !jdJson}>Analyze gaps</RunButton>
      <ErrorNote error={error} />
      {result && <ResultCard><Pre data={result} /></ResultCard>}
    </Panel>
  );
}

/* 8. Scam Shield */
export function ScamModule() {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  async function run() {
    setLoading(true); setError(null);
    try { setResult(await api.scam.check(text, url || undefined)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  return (
    <Panel index="08" eyebrow="Scam Shield (ML)" title="Is this posting safe?">
      <Field label="Posting text / email"><textarea style={inputStyle} rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the suspicious posting…" /></Field>
      <Field label="URL (optional)"><input style={inputStyle} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" /></Field>
      <RunButton onClick={run} loading={loading} disabled={!text && !url}>Scan for scams</RunButton>
      <ErrorNote error={error} />
      {result && (
        <ResultCard>
          {(() => {
            const v = result.prediction === "legit" ? "legit" : "scam";
            const verdictClass = "verdict verdict--" + v;
            return (
              <div className={verdictClass}>
                <span className="verdict__score">{result.risk_score}</span>
                <div>
                  <strong>{result.prediction?.toUpperCase()}</strong> · confidence {Math.round((result.confidence || 0) * 100)}%
                  <div className="chip-row">
                    {(result.reasons || []).map((r: string, i: number) => <span key={i} className="chip">{r}</span>)}
                  </div>
                </div>
              </div>
            );
          })()}
        </ResultCard>
      )}
    </Panel>
  );
}

/* 9. Company Intel */
export function CompanyModule() {
  const [company, setCompany] = useState("");
  const [ctx, setCtx] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  async function run() {
    setLoading(true); setError(null);
    try { setResult(await api.intelligence.companyResearch(company, ctx)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  return (
    <Panel index="09" eyebrow="Company Intelligence" title="Research the employer">
      <Field label="Company"><input style={inputStyle} value={company} onChange={(e) => setCompany(e.target.value)} /></Field>
      <Field label="Extra context (optional)"><textarea style={inputStyle} rows={3} value={ctx} onChange={(e) => setCtx(e.target.value)} /></Field>
      <RunButton onClick={run} loading={loading} disabled={!company}>Research company</RunButton>
      <ErrorNote error={error} />
      {result && <ResultCard><Pre data={result} /></ResultCard>}
    </Panel>
  );
}

/* 10. Interview */
export function InterviewModule() {
  const [company, setCompany] = useState("");
  const [jobJson, setJobJson] = useState('{"requiredSkills":["python"],"technologies":["flask"]}');
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any>(null);
  const [feedback, setFeedback] = useState<any>(null);
  async function gen() {
    setLoading(true); setError(null);
    try { setQuestions(await api.intelligence.interviewQuestions({ jobJson: safeJson(jobJson, "jobJson"), company })); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  async function fb() {
    setLoading(true); setError(null);
    try { setFeedback(await api.intelligence.interviewFeedback(q, a)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  return (
    <Panel index="10" eyebrow="Interview Coach" title="Practice & get feedback">
      <Field label="Company"><input style={inputStyle} value={company} onChange={(e) => setCompany(e.target.value)} /></Field>
      <Field label="Job JSON"><textarea style={inputStyle} rows={3} value={jobJson} onChange={(e) => setJobJson(e.target.value)} /></Field>
      <RunButton onClick={gen} loading={loading} disabled={!jobJson}>Generate questions</RunButton>
      <div style={{ marginTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "1rem" }}>
        <Field label="Your answer to a question"><textarea style={inputStyle} rows={3} value={a} onChange={(e) => setA(e.target.value)} /></Field>
        <Field label="The question (optional)"><input style={inputStyle} value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        <RunButton onClick={fb} loading={loading} disabled={!a}>Get feedback</RunButton>
      </div>
      <ErrorNote error={error} />
      {questions && <ResultCard><Pre data={questions} /></ResultCard>}
      {feedback && <ResultCard><Pre data={feedback} /></ResultCard>}
    </Panel>
  );
}

/* 11. Tracker */
export function TrackerModule() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  async function add() {
    setLoading(true); setError(null);
    try { await api.applications.add({ candidateEmail: email, company, role, status: "Applied" }); await load(); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  async function load() {
    setLoading(true); setError(null);
    try { const r = await api.applications.list(email); setItems(r.data || []); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  async function upd(id: string, status: string) {
    try { await api.applications.update(id, { status }); await load(); }
    catch (e: any) { setError(e.message); }
  }
  return (
    <Panel index="11" eyebrow="Application Tracker" title="Track every application">
      <Field label="Email"><input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Company"><input style={inputStyle} value={company} onChange={(e) => setCompany(e.target.value)} /></Field>
      <Field label="Role"><input style={inputStyle} value={role} onChange={(e) => setRole(e.target.value)} /></Field>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <RunButton onClick={add} loading={loading} disabled={!email || !company}>Add</RunButton>
        <RunButton onClick={load} loading={loading} disabled={!email}>Load</RunButton>
      </div>
      <ErrorNote error={error} />
      {items.length > 0 && (
        <ResultCard>
          {items.map((app: any) => (
            <div className="app-row" key={app._id}>
              <span>{app.company} · <span style={{ opacity: 0.6 }}>{app.role}</span></span>
              <select value={app.status} onChange={(e) => upd(app._id, e.target.value)}>
                {["Applied", "Interview", "Offer", "Rejected"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ))}
        </ResultCard>
      )}
    </Panel>
  );
}

/* 12. Versions */
export function VersionsModule() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  async function run() {
    setLoading(true); setError(null);
    try { const r = await api.resume.versions(email || undefined); setItems(r.data || []); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  return (
    <Panel index="12" eyebrow="Resume Versions" title="Your tailored history">
      <Field label="Email (optional)"><input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <RunButton onClick={run} loading={loading}>Load versions</RunButton>
      <ErrorNote error={error} />
      {items.length > 0 && <ResultCard><Pre data={{ count: items.length, latest: items[0] }} /></ResultCard>}
    </Panel>
  );
}

/* 13. Analytics */
export function AnalyticsModule() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  async function run() {
    setLoading(true); setError(null);
    try { setResult(await api.analytics.summary(email || undefined)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  return (
    <Panel index="13" eyebrow="Analytics" title="Your pipeline at a glance">
      <Field label="Email (optional)"><input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <RunButton onClick={run} loading={loading}>Summarize</RunButton>
      <ErrorNote error={error} />
      {result && (
        <ResultCard>
          <div className="stat-row">
            <div className="stat"><span className="stat__num">{result.totalApplications}</span><span className="stat__label">Applications</span></div>
            <div className="stat"><span className="stat__num">{result.interviewRate}%</span><span className="stat__label">Interview rate</span></div>
            <div className="stat"><span className="stat__num">{result.offerRate}%</span><span className="stat__label">Offer rate</span></div>
          </div>
          <Pre data={result.byStatus} />
        </ResultCard>
      )}
    </Panel>
  );
}

/* 14. Learning */
export function LearningModule() {
  const [goal, setGoal] = useState("backend engineer");
  const [missing, setMissing] = useState('{"critical":["system design"]}');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  async function run() {
    setLoading(true); setError(null);
    try { setResult(await api.intelligence.learning({ goal, missing: safeJson(missing, "missing") })); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  return (
    <Panel index="14" eyebrow="Learning Paths" title="Close the gaps">
      <Field label="Goal"><input style={inputStyle} value={goal} onChange={(e) => setGoal(e.target.value)} /></Field>
      <Field label="Missing skills (JSON)"><textarea style={inputStyle} rows={3} value={missing} onChange={(e) => setMissing(e.target.value)} /></Field>
      <RunButton onClick={run} loading={loading} disabled={!goal || !missing}>Recommend learning</RunButton>
      <ErrorNote error={error} />
      {result && <ResultCard><Pre data={result} /></ResultCard>}
    </Panel>
  );
}

/* 15. Advisor */
export function AdvisorModule() {
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<{ q: string; a: string }[]>([]);
  async function run() {
    if (!question) return;
    setLoading(true); setError(null);
    try {
      const r = await api.intelligence.advisor({ email: email || undefined, question });
      const answer = typeof r === "string" ? r : (r.advice || r.answer || JSON.stringify(r));
      setChat((c) => [...c, { q: question, a: typeof answer === "string" ? answer : JSON.stringify(answer) }]);
      setQuestion("");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  return (
    <Panel index="15" eyebrow="Career Advisor" title="Ask the advisor">
      <Field label="Email (optional)"><input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Your question"><textarea style={inputStyle} rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Should I apply to X? How do I prep for Y?" /></Field>
      <RunButton onClick={run} loading={loading} disabled={!question}>Ask</RunButton>
      <ErrorNote error={error} />
      {chat.length > 0 && (
        <ResultCard>
          {chat.map((m, i) => (
            <div key={i} style={{ marginBottom: "1rem" }}>
              <p style={{ opacity: 0.6, fontSize: 13 }}>Q: {m.q}</p>
              <pre className="result-pre">{m.a}</pre>
            </div>
          ))}
        </ResultCard>
      )}
    </Panel>
  );
}

export function safeJson(s: string, field: string) {
  if (!s.trim()) throw new Error(`${field} is required`);
  try { return JSON.parse(s); }
  catch { return { raw: s }; }
}
