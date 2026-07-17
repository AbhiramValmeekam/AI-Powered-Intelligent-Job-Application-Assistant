"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import * as api from "@/lib/api";
import {
  IconHome, IconBriefcase, IconDoc, IconSearchDoc, IconTarget,
  IconBell, IconSun, IconGear, IconLogout, IconPlus, IconArrow, IconTrend,
} from "@/components/icons";
import {
  JobsModule, AlertsModule, JdModule, TailorModule, CoverModule,
  AtsModule, SkillsModule, ScamModule, CompanyModule, InterviewModule,
  TrackerModule, VersionsModule, AnalyticsModule, LearningModule, AdvisorModule,
} from "@/lib/modules";
import { EditProfileModal } from "@/components/AppAuth";
import { stopScroll, startScroll } from "@/lib/smoothScroll";

// Reference dashboard nav: every icon maps to an existing module (portal).
const NAV = [
  { id: "dashboard", title: "Dashboard", sub: "Overview", Icon: IconHome },
  { id: "jobs", title: "Job Workflow", sub: "Live discovery", Icon: IconBriefcase },
  { id: "tailor", title: "Resume Builder", sub: "Tailor & generate", Icon: IconDoc },
  { id: "ats", title: "ATS Analyzer", sub: "Score fit", Icon: IconSearchDoc },
  { id: "skills", title: "Job Matcher", sub: "Skill gaps", Icon: IconTarget },
] as const;

const MODULE_BY_ID: Record<string, React.ComponentType> = {
  jobs: JobsModule, alerts: AlertsModule, jd: JdModule, tailor: TailorModule,
  cover: CoverModule, ats: AtsModule, skills: SkillsModule, scam: ScamModule,
  company: CompanyModule, interview: InterviewModule, tracker: TrackerModule,
  versions: VersionsModule, analytics: AnalyticsModule, learning: LearningModule,
  advisor: AdvisorModule,
};

function initials(name: string) {
  return (name || "?").trim().slice(0, 2).toUpperCase();
}

export function DashboardV2() {
  const { user } = useUser();
  const clerk = useClerk();
  const [active, setActive] = useState<string | null>(null); // portal module id or 'dashboard'
  const [editing, setEditing] = useState(false);

  // Right-rail data (live analytics)
  const [stats, setStats] = useState<{ total: number; interview: number; ats: number } | null>(null);
  const [resumeReady, setResumeReady] = useState(72);

  useEffect(() => {
    const email = user?.primaryEmailAddress?.emailAddress;
    (async () => {
      try {
        const r = await api.analytics.summary(email || undefined);
        if (r) setStats({ total: r.totalApplications ?? 0, interview: r.interviewRate ?? 0, ats: r.atsScore ?? 70 });
      } catch {
        setStats({ total: 0, interview: 0, ats: 70 });
      }
    })();
  }, [user]);

  // Center job search
  const [query, setQuery] = useState("frontend engineering");
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("US");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  async function search() {
    setLoading(true); setError(null);
    try {
      const r = await api.jobs.search(query, { location, useAdzuna: true });
      setJobs(r.jobs || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { search(); /* eslint-disable-next-line */ }, []);

  const firstName = user?.firstName || user?.primaryEmailAddress?.emailAddress?.split("@")[0] || "there";
  const avatar = user?.imageUrl || "";
  const displayName = user?.fullName || firstName;

  const openModule = (id: string) => {
    setActive(id);
    stopScroll();
  };
  const closeModule = () => {
    setActive(null);
    startScroll();
  };

  const ActiveMod = active && !NAV.find((n) => n.id === active) ? MODULE_BY_ID[active] : null;

  return (
    <div className="db3" data-app-motion>
      {/* ---------- LEFT NAV ---------- */}
      <aside className="db3__nav" aria-label="Primary">
        <div className="db3__brand">CareerOS</div>
        <nav className="db3__navlist" aria-label="Modules">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`db3__navitem${active === n.id || (n.id === "dashboard" && active === null) ? " is-active" : ""}`}
              onClick={() => (n.id === "dashboard" ? (setActive(null), startScroll()) : openModule(n.id))}
              aria-current={n.id === "dashboard" && active === null ? "page" : undefined}
            >
              <span className="db3__navicon"><n.Icon /></span>
              <span className="db3__navtext">
                <span className="db3__navtitle">{n.title}</span>
                <span className="db3__navsub">{n.sub}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="db3__navfoot">
          <p className="db3__navkicker">Settings</p>
          <button className="db3__navitem" onClick={() => setEditing(true)}>
            <span className="db3__navicon"><IconGear /></span>
            <span className="db3__navtext"><span className="db3__navtitle">Settings</span><span className="db3__navsub">Account</span></span>
          </button>
          <button className="db3__navitem" onClick={() => clerk.signOut({ redirectUrl: "/" })}>
            <span className="db3__navicon"><IconLogout /></span>
            <span className="db3__navtext"><span className="db3__navtitle">Logout</span><span className="db3__navsub">Sign out</span></span>
          </button>
          <p className="db3__footnote">CANDIDATE CONTROLLED WORKSPACE</p>
        </div>
      </aside>

      {/* ---------- CENTER ---------- */}
      <main className="db3__main">
        <header className="db3__topbar">
          <div className="db3__search">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Search your resumes…"
              aria-label="Search resumes"
            />
          </div>
          <div className="db3__topactions">
            <button className="db3__iconbtn" aria-label="Notifications"><IconBell /></button>
            <button className="db3__iconbtn" aria-label="Toggle theme" onClick={() => {
              const root = document.documentElement;
              const next = root.dataset.theme === "light" ? "dark" : "light";
              root.dataset.theme = next; root.style.colorScheme = next;
              try { localStorage.setItem("careeros-theme", next); } catch {}
            }}><IconSun /></button>
            <button className="db3__avatar" aria-label="Profile">
              {avatar ? <img src={avatar} alt="" /> : <span>{initials(displayName)}</span>}
            </button>
          </div>
        </header>

        {active === null && (
          <div className="db3__center" ref={searchRef}>
            {/* Hero */}
            <section className="db3__hero">
              <div className="db3__herotext">
                <p className="db3__herokick">CAREER WORKSPACE</p>
                <h1 className="db3__herotitle">Build stronger resumes.<br />Land better roles.</h1>
                <p className="db3__herocopy">Create, analyze, and tailor every application from one focused workspace.</p>
                <button className="db3__cta" onClick={() => openModule("tailor")}>
                  Create resume <IconArrow />
                </button>
              </div>
              <div className="db3__herographic" aria-hidden="true">
                <svg viewBox="0 0 200 200" width="100%" height="100%">
                  <circle cx="100" cy="100" r="62" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
                  <circle cx="100" cy="100" r="40" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
                  <path d="M100 20v160M20 100h160" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />
                  <circle cx="100" cy="100" r="6" fill="var(--signal)" />
                  <path d="M100 100 158 54" stroke="var(--signal)" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            </section>

            {/* Job search (top priority) */}
            <section className="db3__jobs">
              <div className="db3__sectionhead">
                <div>
                  <p className="db3__eyebrow">LIVE DISCOVERY</p>
                  <h2 className="db3__h2">Search jobs</h2>
                </div>
                <button className="db3__link" onClick={() => openModule("jobs")}>All discovered jobs <IconArrow /></button>
              </div>

              <div className="db3__jobsearch">
                <label className="db3__field">
                  <span>Role or Keyword</span>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Frontend Engineering" />
                </label>
                <label className="db3__field">
                  <span>Location</span>
                  <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City or remote" />
                </label>
                <label className="db3__field db3__field--sm">
                  <span>Country</span>
                  <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="US" />
                </label>
                <button className="db3__find" onClick={search} disabled={loading}>
                  {loading ? "Finding…" : "Find jobs"}
                </button>
              </div>
              <p className="db3__disclaimer">Discovery only searches — it never submits applications on your behalf.</p>

              {error && <p className="db3__error">{error}</p>}

              <ul className="db3__listings">
                {jobs.slice(0, 6).map((j, i) => (
                  <li key={i} className="db3__listing" onClick={() => j.url && window.open(j.url, "_blank", "noreferrer")}>
                    <div className="db3__listingmain">
                      <p className="db3__listingtitle">{j.title}</p>
                      <p className="db3__listingsub">{j.company}{j.location ? ` · ${j.location}` : ""}</p>
                    </div>
                    <div className="db3__listingtags">
                      {j.source && <span className="db3__tag">{j.source}</span>}
                      <span className="db3__tag db3__tag--official">Official Listing</span>
                    </div>
                  </li>
                ))}
                {!loading && jobs.length === 0 && !error && (
                  <li className="db3__listing db3__listing--empty">No jobs found for "{query}".</li>
                )}
              </ul>
            </section>
          </div>
        )}

        {/* Module portal */}
        {ActiveMod && (
          <div className="db3__portal" role="dialog" aria-modal="true" aria-label={active ?? ""}>
            <div className="db3__portal__bar">
              <button className="db3__back" onClick={closeModule}>← Back to dashboard</button>
            </div>
            <div className="db3__portal__body"><ActiveMod /></div>
          </div>
        )}
      </main>

      {/* ---------- RIGHT RAIL ---------- */}
      <aside className="db3__rail" aria-label="Status and analytics">
        <section className="db3__readiness">
          <p className="db3__eyebrow">READINESS</p>
          <h2 className="db3__h2">Resume completeness</h2>
          <div className="db3__gauge" role="img" aria-label={`${resumeReady} percent complete`}>
            <svg viewBox="0 0 120 120" width="120" height="120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="10" />
              <circle
                cx="60" cy="60" r="52" fill="none" stroke="var(--signal)" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 52}
                strokeDashoffset={2 * Math.PI * 52 * (1 - resumeReady / 100)}
                transform="rotate(-90 60 60)"
              />
              <text x="60" y="56" textAnchor="middle" className="db3__gaugepct">{resumeReady}%</text>
              <text x="60" y="76" textAnchor="middle" className="db3__gaugeinit">{initials(displayName)}</text>
            </svg>
          </div>
          <p className="db3__greeting">Good morning, {firstName}.</p>
          <p className="db3__railnote">Your resume is <strong>{resumeReady}% complete</strong>. Add the missing details to improve readiness.</p>
          <button className="db3__cta db3__cta--ghost" onClick={() => openModule("tailor")}>Complete resume <IconArrow /></button>
        </section>

        <section className="db3__analysis">
          <div className="db3__sectionhead">
            <div>
              <p className="db3__eyebrow">ANALYSIS</p>
              <h2 className="db3__h2">ATS progress</h2>
            </div>
            <IconTrend />
          </div>
          <div className="db3__chart" aria-label="ATS score over time">
            <span className="db3__chartpct">{stats ? stats.ats : "—"}%</span>
            <div className="db3__bar" style={{ height: `${stats ? stats.ats : 70}%` }}>
              <span className="db3__barfill" style={{ height: `${stats ? stats.ats : 70}%` }} />
            </div>
            <span className="db3__chartx">Jul 18</span>
          </div>
          <div className="db3__railstats">
            <div className="db3__railstat">
              <span className="db3__railnum">{stats ? stats.total : "—"}</span>
              <span className="db3__raillabel">Applications</span>
            </div>
            <div className="db3__railstat">
              <span className="db3__railnum">{stats ? `${stats.interview}%` : "—"}</span>
              <span className="db3__raillabel">Interview rate</span>
            </div>
          </div>
        </section>
      </aside>

      {editing && <EditProfileModal email={user?.primaryEmailAddress?.emailAddress || ""} onClose={() => setEditing(false)} />}
    </div>
  );
}
