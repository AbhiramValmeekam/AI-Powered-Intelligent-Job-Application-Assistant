"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Panel, Field, RunButton, ErrorNote, inputStyle } from "@/components/Panel";
import { StatusButton } from "@/components/StatusButton";
import * as api from "@/lib/api";
import { parseSections } from "@/lib/describe";
import { stopScroll, startScroll } from "@/lib/smoothScroll";

type Job = {
  source: string;
  title: string;
  company: string;
  location: string;
  url: string;
  salary: string;
  type: string;
  description: string;
  skills: string[];
  postedAt: string;
};

function initials(name: string) {
  return (name || "?").trim().slice(0, 2).toUpperCase();
}

function timeAgo(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function stripHtml(s: string) {
  return (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function JobBoard({ initialQuery, initialLocation }: { initialQuery?: string; initialLocation?: string }) {
  const [query, setQuery] = useState(initialQuery || "python developer");
  const [location, setLocation] = useState(initialLocation || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [sources, setSources] = useState<Record<string, number>>({});
  const [srcErrors, setSrcErrors] = useState<string[]>([]);

  const [kw, setKw] = useState("");
  const [srcFilter, setSrcFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [selected, setSelected] = useState<Job | null>(null);

  async function search() {
    setLoading(true); setError(null);
    try {
      const r = await api.jobs.search(query, { location, useAdzuna: true, useJobdataapi: true });
      setJobs(r.jobs || []);
      setSources(r.sources || {});
      setSrcErrors(r.errors || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  // Load jobs immediately on mount (no manual search required).
  useEffect(() => { search(); /* eslint-disable-next-line */ }, []);

  const types = useMemo(() => {
    const t = new Set(jobs.map((j) => (j.type || "Other").trim()).filter(Boolean));
    return ["all", ...Array.from(t)];
  }, [jobs]);

  const filtered = useMemo(() => {
    const k = kw.toLowerCase();
    return jobs.filter((j) => {
      if (srcFilter !== "all" && j.source !== srcFilter) return false;
      if (typeFilter !== "all" && (j.type || "Other") !== typeFilter) return false;
      if (k) {
        const hay = `${j.title} ${j.company} ${(j.skills || []).join(" ")}`.toLowerCase();
        if (!hay.includes(k)) return false;
      }
      return true;
    });
  }, [jobs, kw, srcFilter, typeFilter]);

  return (
    <Panel index="02" eyebrow="Live Job Board" title="Find your next role">
      <div className="jobbar">
        <input className="jobbar__search" style={inputStyle} value={query}
          onChange={(e) => setQuery(e.target.value)} placeholder="Job title or keyword (e.g. python developer)"
          onKeyDown={(e) => e.key === "Enter" && search()} />
        <input className="jobbar__loc" style={inputStyle} value={location}
          onChange={(e) => setLocation(e.target.value)} placeholder="Location (optional)"
          onKeyDown={(e) => e.key === "Enter" && search()} />
        <RunButton onClick={search} loading={loading} disabled={!query}>Search</RunButton>
      </div>

      <div className="jobboard__sources">
        <span className="jobboard__sources-label">Sources:</span>
        <span className={"src-chip" + (sources.remotive ? " src-chip--on" : "")}>Remotive {sources.remotive ? `(${sources.remotive})` : "✓"}</span>
        <span className={"src-chip" + (sources.adzuna ? " src-chip--on" : "")}>Adzuna {sources.adzuna ? `(${sources.adzuna})` : "⚙"}</span>
        <span className={"src-chip" + (sources.jobdataapi ? " src-chip--on" : "")}>jobdataapi {sources.jobdataapi ? `(${sources.jobdataapi})` : "⚙"}</span>
      </div>
      {srcErrors.length > 0 && (
        <div className="jobboard__srcnote">
          {srcErrors.map((e, i) => <div key={i}>⚙ {e}</div>)}
        </div>
      )}

      {jobs.length > 0 && (
        <div className="jobfilters">
          <input style={inputStyle} value={kw} onChange={(e) => setKw(e.target.value)}
            placeholder="Filter results by skill/company…" />
          <select value={srcFilter} onChange={(e) => setSrcFilter(e.target.value)} style={inputStyle}>
            <option value="all">All sources</option>
            {Object.keys(sources).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={inputStyle}>
            {types.map((t) => <option key={t} value={t}>{t === "all" ? "All types" : t}</option>)}
          </select>
          <span className="jobfilters__count">{filtered.length} of {jobs.length} jobs</span>
        </div>
      )}

      <ErrorNote error={error} />

      <div className="joblist">
        {filtered.map((j, i) => {
          const desc = stripHtml(j.description);
          return (
            <article key={i} className="jobcard jobcard--rich" onClick={() => setSelected(j)}>
              <div className="jobcard__logo" aria-hidden="true">{initials(j.company)}</div>
              <div className="jobcard__body">
                <div className="jobcard__title">{j.title}</div>
                <div className="jobcard__meta">
                  {j.company}{j.location ? ` · ${j.location}` : ""}
                </div>
                <div className="jobcard__sub">
                  {j.salary ? <span>💰 {j.salary}</span> : null}
                  {j.type ? <span>🕒 {j.type}</span> : null}
                  {j.postedAt ? <span>📅 {timeAgo(j.postedAt)}</span> : null}
                  <span className="chip jobcard__src">{j.source}</span>
                </div>
                {desc && <p className="jobcard__desc">{desc.slice(0, 220)}{desc.length > 220 ? "…" : ""}</p>}
                <div className="jobcard__tags">
                  {(j.skills || []).slice(0, 6).map((s, k) => (
                    <span key={k} className="chip chip--match">{s}</span>
                  ))}
                </div>
              </div>
              <div className="jobcard__side">
                <span className="jobcard__time">{timeAgo(j.postedAt)}</span>
                <button className="jobcard__apply" onClick={(e) => { e.stopPropagation(); setSelected(j); }}>
                  Apply
                </button>
              </div>
            </article>
          );
        })}
        {jobs.length > 0 && filtered.length === 0 && (
          <p className="jobfilters__count">No jobs match your filters.</p>
        )}
      </div>

      {selected && (
        <JobApplyModal job={selected} onClose={() => setSelected(null)} />
      )}
    </Panel>
  );
}

function JobApplyModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoResult, setAutoResult] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [modalRef, setModalRef] = useState<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => setMounted(true), []);

  // Focus + scroll lock: while the popup is open, the background must not
  // scroll and focus stays trapped inside the modal.
  useEffect(() => {
    if (!mounted) return;
    stopScroll();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => {
      const focusable = modalRef?.querySelector<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }, 50);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !modalRef) return;
      const nodes = Array.from(
        modalRef.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((n) => !n.hasAttribute("disabled"));
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      startScroll();
    };
  }, [mounted, modalRef]);

  async function loadProfile() {
    if (!email) return;
    setLoadingProfile(true); setProfileErr(null);
    try {
      const p = await api.profiles.get(email);
      setProfile(p);
    } catch (e: any) {
      setProfileErr(e.message.includes("404") || e.message.includes("not found")
        ? "No profile found. You can still apply — it will be saved with this email."
        : e.message);
      setProfile(null);
    } finally { setLoadingProfile(false); }
  }

  async function submit() {
    if (!email) { setSubmitErr("Enter your email to track this application."); return; }
    setSubmitting(true); setSubmitErr(null);
    try {
      await api.applications.add({
        candidateEmail: email,
        company: job.company,
        role: job.title,
        status: "Applied",
        jobUrl: job.url,
        source: job.source,
        description: stripHtml(job.description).slice(0, 2000),
      });
      setDone(true);
    } catch (e: any) { setSubmitErr(e.message); }
    finally { setSubmitting(false); }
  }

  async function autoApply() {
    if (!email) { setSubmitErr("Enter your email so we can tailor & apply."); return; }
    setAutoBusy(true); setSubmitErr(null); setAutoResult(null);
    try {
      const r = await api.applications.autoApply({ email, job });
      setAutoResult(r);
      setDone(true);
    } catch (e: any) { setSubmitErr(e.message); }
    finally { setAutoBusy(false); }
  }

  const desc = stripHtml(job.description);
  const sections = parseSections(job.description);

  return mounted ? createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} data-lenis-prevent ref={setModalRef}>
        <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>

        {done ? (
          <div className="modal__done">
            <h3>{autoResult ? "Auto-applied ✅" : "Application tracked ✅"}</h3>
            <p>Your application to <strong>{job.company}</strong> for <strong>{job.title}</strong> is saved in your Application Tracker (status: Applied).</p>
            {autoResult && (
              <div className="modal__auto">
                {autoResult.data?.tailored ? (
                  <>
                    <p className="modal__auto-badge">⚡ Resume auto-tailored to this job
                      {typeof autoResult.data?.atsScore === "number" && <span className="chip chip--match"> ATS {autoResult.data.atsScore}</span>}
                    </p>
                    {autoResult.data?.summary && (
                      <p className="modal__hint"><strong>Tailored summary:</strong> {autoResult.data.summary}</p>
                    )}
                    {autoResult.data?.changes?.length > 0 && (
                      <ul className="modal__auto-changes">
                        {autoResult.data.changes.slice(0, 5).map((c: string, i: number) => <li key={i}>{c}</li>)}
                      </ul>
                    )}
                    {autoResult.data?.missingSkills?.length > 0 && (
                      <p className="modal__hint modal__hint--warn">Honest gaps: {autoResult.data.missingSkills.join(", ")}</p>
                    )}
                  </>
                ) : (
                  <p className="modal__hint modal__hint--warn">{autoResult.data?.note || "Applied without tailoring."}</p>
                )}
              </div>
            )}
            <button className="primary-cta" onClick={onClose}><span>Done</span><span aria-hidden>↗</span></button>
          </div>
        ) : (
          <>
            <div className="modal__head">
              <div className="jobcard__logo" aria-hidden="true">{initials(job.company)}</div>
              <div>
                <h2 className="modal__title">{job.title}</h2>
                <div className="jobcard__meta">{job.company}{job.location ? ` · ${job.location}` : ""}</div>
                <div className="jobcard__sub">
                  {job.salary ? <span>💰 {job.salary}</span> : null}
                  {job.type ? <span>🕒 {job.type}</span> : null}
                  {job.postedAt ? <span>📅 {timeAgo(job.postedAt)}</span> : null}
                  <span className="chip jobcard__src">{job.source}</span>
                </div>
              </div>
            </div>

            <div className="modal__section">
              <h4>Job description</h4>
              {sections.length > 1 ? (
                <div className="modal__sections">
                  {sections.map((s, i) => (
                    <div key={i} className="modal__block">
                      {s.heading && s.heading.toLowerCase() !== "description" && (
                        <h5 className="modal__block-h">{s.heading}</h5>
                      )}
                      <p className="modal__block-b">{s.body || "—"}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="modal__desc">{desc || "No description provided by the source."}</p>
              )}
              {job.skills?.length > 0 && (
                <div className="jobcard__tags">
                  {job.skills.map((s, k) => <span key={k} className="chip chip--match">{s}</span>)}
                </div>
              )}
            </div>

            <div className="modal__section">
              <h4>Your details</h4>
              <Field label="Email (used to load your profile & track the application)">
                <input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" onBlur={loadProfile} />
              </Field>
              {loadingProfile && <p className="modal__hint">Loading profile…</p>}
              {profileErr && <p className="modal__hint modal__hint--warn">{profileErr}</p>}
              {profile && (
                <div className="modal__profile">
                  <strong>{profile.fullName || email}</strong>
                  {profile.skills?.length > 0 && (
                    <div className="jobcard__tags">
                      {profile.skills.map((s: string, k: number) => <span key={k} className="chip">{s}</span>)}
                    </div>
                  )}
                  {profile.careerPreferences?.goal && (
                    <p className="modal__hint">Goal: {profile.careerPreferences.goal}</p>
                  )}
                </div>
              )}
            </div>

            {submitErr && <ErrorNote error={submitErr} />}

            <div className="modal__actions">
              <button className="modal__secondary" onClick={onClose}>Cancel</button>
              <button className="modal__secondary" onClick={submit} disabled={submitting || autoBusy || !email}>
                {submitting ? "Saving…" : "Track only"}
              </button>
              <StatusButton
                idleLabel="⚡ Auto-Apply (tailor + submit)"
                loadingLabel="Tailoring & applying…"
                successLabel="Applied"
                loading={autoBusy}
                done={autoResult ? autoResult.applied ?? autoResult.autoApplied ?? null : undefined}
                onClick={autoApply}
                disabled={!email}
              />
            </div>
            <p className="modal__fineprint">
              Auto-Apply tailors your resume to this job with AI, then files the application in your tracker.
              Track only saves it without tailoring. No redirect to the source site.
              {job.url && <a href={job.url} target="_blank" rel="noreferrer" className="modal__srclink">View original posting ↗</a>}
            </p>
          </>
        )}
      </div>
    </div>,
    document.body,
  ) : null;
}
