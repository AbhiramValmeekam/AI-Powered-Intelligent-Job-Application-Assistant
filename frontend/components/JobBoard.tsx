"use client";

import { useState, useMemo } from "react";
import { Panel, Field, RunButton, ErrorNote, inputStyle } from "@/components/Panel";
import * as api from "@/lib/api";

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

export function JobBoard() {
  const [query, setQuery] = useState("python developer");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [sources, setSources] = useState<Record<string, number>>({});

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
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

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
  const [submitErr, setSubmitErr] = useState<string | null>(null);

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

  const desc = stripHtml(job.description);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>

        {done ? (
          <div className="modal__done">
            <h3>Application tracked ✅</h3>
            <p>Your application to <strong>{job.company}</strong> for <strong>{job.title}</strong> is saved in your Application Tracker (status: Applied).</p>
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
              <p className="modal__desc">{desc || "No description provided by the source."}</p>
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
              <button className="primary-cta" onClick={submit} disabled={submitting || !email}>
                <span>{submitting ? "Saving…" : "Submit application"}</span>
                <span aria-hidden>↗</span>
              </button>
            </div>
            <p className="modal__fineprint">
              Applied within CareerOS — saved to your Application Tracker. No redirect to the source site.
              {job.url && <a href={job.url} target="_blank" rel="noreferrer" className="modal__srclink">View original posting ↗</a>}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
