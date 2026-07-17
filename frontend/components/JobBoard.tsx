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

export function JobBoard() {
  const [query, setQuery] = useState("python developer");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [sources, setSources] = useState<Record<string, number>>({});

  // client-side filters
  const [kw, setKw] = useState("");
  const [srcFilter, setSrcFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

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
      {/* search + filters */}
      <div className="jobbar">
        <input
          className="jobbar__search"
          style={inputStyle}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Job title or keyword (e.g. python developer)"
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <input
          className="jobbar__loc"
          style={inputStyle}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location (optional)"
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <RunButton onClick={search} loading={loading} disabled={!query}>Search</RunButton>
      </div>

      {jobs.length > 0 && (
        <div className="jobfilters">
          <input
            style={inputStyle}
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="Filter results by skill/company…"
          />
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

      {/* listings */}
      <div className="joblist">
        {filtered.map((j, i) => (
          <a className="jobcard" key={i} href={j.url} target="_blank" rel="noreferrer">
            <div className="jobcard__logo" aria-hidden="true">{initials(j.company)}</div>
            <div className="jobcard__body">
              <div className="jobcard__title">{j.title}</div>
              <div className="jobcard__meta">
                {j.company}{j.location ? ` · ${j.location}` : ""}
                {j.salary ? ` · ${j.salary}` : ""}
              </div>
              <div className="jobcard__tags">
                <span className="chip">{j.source}</span>
                {j.type ? <span className="chip">{j.type}</span> : null}
                {(j.skills || []).slice(0, 4).map((s, k) => (
                  <span key={k} className="chip chip--match">{s}</span>
                ))}
              </div>
            </div>
            <div className="jobcard__side">
              <span className="jobcard__time">{timeAgo(j.postedAt)}</span>
              <span className="jobcard__apply">Apply ↗</span>
            </div>
          </a>
        ))}
        {jobs.length > 0 && filtered.length === 0 && (
          <p className="jobfilters__count">No jobs match your filters.</p>
        )}
      </div>
    </Panel>
  );
}
