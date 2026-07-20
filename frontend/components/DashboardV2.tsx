"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import * as api from "@/lib/api";
import {
  IconHome, IconBriefcase, IconDoc, IconSearchDoc, IconTarget,
  IconBell, IconSun, IconGear, IconLogout, IconPlus, IconArrow, IconTrend,
  IconBellDot, IconFileText, IconMail, IconShield, IconBuilding, IconChat,
  IconClipboard, IconLayers, IconBar, IconBook, IconSpark,
} from "@/components/icons";
import {
  JobsModule, AlertsModule, JdModule, TailorModule, CoverModule,
  AtsModule, SkillsModule, ScamModule, CompanyModule, InterviewModule,
  TrackerModule, VersionsModule, AnalyticsModule, LearningModule, AdvisorModule,
} from "@/lib/modules";
import { JobBoard, JobApplyModal } from "@/components/JobBoard";
import { EditProfileModal } from "@/components/AppAuth";
import { stopScroll, startScroll } from "@/lib/smoothScroll";

// Reference dashboard nav: every item maps to an existing module. The home
// page (Dashboard) stays exactly as designed; clicking any other item swaps
// the CENTER column to that module while the nav + right rail stay visible.
type NavItem = { id: string; title: string; sub: string; Icon: any; settings?: boolean; logout?: boolean };
type NavSection = { heading?: string; items: NavItem[] };

const NAV: NavSection[] = [
  {
    heading: "Overview",
    items: [
      { id: "dashboard", title: "Dashboard", sub: "Overview", Icon: IconHome },
      { id: "jobs", title: "Job Workflow", sub: "Live discovery", Icon: IconBriefcase },
      { id: "alerts", title: "Job Alerts", sub: "Smart matches", Icon: IconBellDot },
      { id: "jd", title: "Job Analysis", sub: "Parse a posting", Icon: IconFileText },
    ],
  },
  {
    heading: "Resume & Apply",
    items: [
      { id: "tailor", title: "Resume Builder", sub: "Tailor & generate", Icon: IconDoc },
      { id: "cover", title: "Cover Letter", sub: "Generate", Icon: IconMail },
      { id: "ats", title: "ATS Analyzer", sub: "Score fit", Icon: IconSearchDoc },
      { id: "skills", title: "Job Matcher", sub: "Skill gaps", Icon: IconTarget },
      { id: "versions", title: "Resume Versions", sub: "History", Icon: IconLayers },
      { id: "tracker", title: "Application Tracker", sub: "Your pipeline", Icon: IconClipboard },
    ],
  },
  {
    heading: "Intelligence",
    items: [
      { id: "scam", title: "Scam Shield", sub: "Fraud check", Icon: IconShield },
      { id: "company", title: "Company Research", sub: "Insights", Icon: IconBuilding },
      { id: "interview", title: "Interview Prep", sub: "Practice", Icon: IconChat },
      { id: "learning", title: "Learning Path", sub: "Upskill", Icon: IconBook },
      { id: "advisor", title: "AI Advisor", sub: "Ask anything", Icon: IconSpark },
      { id: "analytics", title: "Analytics", sub: "Your stats", Icon: IconBar },
    ],
  },
];

const NAV_ITEMS = NAV.flatMap((s) => s.items).filter((n) => !n.settings && !n.logout);
const NAV_BY_ID: Record<string, NavItem> = Object.fromEntries(NAV_ITEMS.map((n) => [n.id, n]));

// Mobile bottom-nav: a focused subset of the modules (icon + short label).
// Mirrors the desktop nav so the app is fully navigable on phones.
const MOBILE_NAV: NavItem[] = [
  { id: "dashboard", title: "Home", sub: "Overview", Icon: IconHome },
  { id: "jobs", title: "Jobs", sub: "Live discovery", Icon: IconBriefcase },
  { id: "ats", title: "ATS", sub: "Score fit", Icon: IconSearchDoc },
  { id: "skills", title: "Match", sub: "Skill gaps", Icon: IconTarget },
  { id: "scam", title: "Scam", sub: "Fraud check", Icon: IconShield },
  { id: "interview", title: "Interview", sub: "Practice", Icon: IconChat },
  { id: "learning", title: "Learn", sub: "Upskill", Icon: IconBook },
];

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

// Honest resume-readiness score derived from the saved master resume: how many
// of the core sections are present. 0 when nothing is saved.
function computeReadiness(text: string | null | undefined): number {
  if (!text || text.trim().length < 40) return 0;
  const t = text.toLowerCase();
  const checks: [string[], number][] = [
    [["email", "phone", "@"], 18],
    [["experience", "work", "intern"], 22],
    [["education", "university", "school", "b.tech", "btech"], 18],
    [["skill", "technolog", "proficien"], 20],
    [["project"], 12],
    [["summary", "objective", "about"], 10],
  ];
  let score = 0;
  for (const [keys, weight] of checks) {
    if (keys.some((k) => t.includes(k))) score += weight;
  }
  return Math.min(100, score);
}

export function DashboardV2() {
  const { user } = useUser();
  const clerk = useClerk();
  // active = module id to show in the center, or null for the home dashboard.
  const [active, setActive] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreSheetRef = useRef<HTMLDivElement | null>(null);

  // Right-rail + resume data (live)
  const [stats, setStats] = useState<{ total: number; interview: number; ats: number } | null>(null);
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [completeness, setCompleteness] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);

  // Run the ATS readiness scan on a resume and push the result into the rail.
  async function scanResume(text: string, email?: string) {
    if (!text || text.trim().length < 20) {
      setCompleteness(0);
      setStats((s) => (s ? { ...s, ats: 0 } : s));
      return;
    }
    setScanning(true);
    try {
      const r: any = await api.resume.score(email ? { email } : { text });
      const d = r?.data || {};
      if (typeof d.atsScore === "number") {
        setStats((s) => (s ? { ...s, ats: d.atsScore } : { total: 0, interview: 0, ats: d.atsScore }));
      }
      if (typeof d.completeness === "number") setCompleteness(d.completeness);
    } catch {
      /* keep last known score */
    } finally {
      setScanning(false);
    }
  }

  // Reload rail data + run a fresh ATS scan. Called on mount and whenever a
  // resume is uploaded/saved elsewhere (the 'resume:updated' event).
  const loadData = useCallback(async () => {
    const email = user?.primaryEmailAddress?.emailAddress;
    try {
      const r = await api.analytics.summary(email || undefined);
      if (r) setStats({ total: r.totalApplications ?? 0, interview: r.interviewRate ?? 0, ats: r.atsScore ?? 0 });
      if (typeof r?.resumeCompleteness === "number") setCompleteness(r.resumeCompleteness);
    } catch {
      setStats({ total: 0, interview: 0, ats: 0 });
    }
    if (email) {
      try {
        const mr = await api.resume.master.get(email);
        const text = mr?.data?.text || null;
        setResumeText(text);
        // Auto ATS scan whenever the saved resume is loaded → real score.
        if (text) await scanResume(text, email);
      } catch {
        setResumeText(null);
      }
    }
  }, [user, scanResume]);

  useEffect(() => {
    void loadData();
    const onUpd = () => void loadData();
    window.addEventListener("resume:updated", onUpd);
    return () => window.removeEventListener("resume:updated", onUpd);
  }, [loadData]);

  // Close the profile popover on outside-click or Escape.
  useEffect(() => {
    if (!profileOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(".db3__avatarwrap")) setProfileOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setProfileOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [profileOpen]);

  const resumeReady = completeness ?? computeReadiness(resumeText);

  // Center job search
  const [query, setQuery] = useState("frontend engineering");
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("US");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
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

  // Focus trap + scroll lock for the mobile "More" sheet: keep Tab focus
  // inside the sheet, focus the close button on open, close on Escape, and
  // pause background (Lenis) scroll so the page behind doesn't move.
  useEffect(() => {
    if (!moreOpen) return;
    const root = moreSheetRef.current;
    stopScroll(); // pause Lenis so wheeling/touching the sheet can't move the page
    if (!root) return;
    const closeBtn = root.querySelector<HTMLButtonElement>(".db3__moresheet__close");
    closeBtn?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMoreOpen(false); return; }
      if (e.key !== "Tab") return;
      const f = root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      startScroll(); // resume background scroll on close
    };
  }, [moreOpen]);

  const firstName = user?.firstName || user?.primaryEmailAddress?.emailAddress?.split("@")[0] || "there";
  const avatar = user?.imageUrl || "";
  const displayName = user?.fullName || firstName;

  const openModule = (id: string) => setActive(id);
  const closeModule = () => setActive(null);

  const ActiveMod = active && NAV_ITEMS.some((n) => n.id === active) ? MODULE_BY_ID[active] : null;
  const openJobs = () => openModule("jobs");

  return (
    <div className="db3" data-app-motion>
      {/* ---------- LEFT NAV ---------- */}
      <aside className="db3__nav" aria-label="Primary" data-lenis-prevent>
        <div className="db3__brand">CareerOS</div>
        <nav className="db3__navlist" aria-label="Modules">
          {NAV.map((section, si) => (
            <div key={section.heading || si} className="db3__navgroup">
              {section.heading && <p className="db3__navkicker">{section.heading}</p>}
              {section.items.map((n) => (
                <button
                  key={n.id}
                  className={`db3__navitem${active === n.id || (n.id === "dashboard" && active === null) ? " is-active" : ""}`}
                  onClick={() => (n.id === "dashboard" ? closeModule() : openModule(n.id))}
                  aria-current={n.id === "dashboard" && active === null ? "page" : undefined}
                >
                  <span className="db3__navicon"><n.Icon /></span>
                  <span className="db3__navtext">
                    <span className="db3__navtitle">{n.title}</span>
                    <span className="db3__navsub">{n.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <p className="db3__footnote">CANDIDATE CONTROLLED WORKSPACE</p>
      </aside>

      {/* ---------- CENTER ---------- */}
      <main className="db3__main">
        <header className="db3__topbar">
          <div className="db3__search">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Search jobs by role or keyword…"
              aria-label="Search jobs"
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
            <div className="db3__avatarwrap">
              <button
                className={`db3__avatar${profileOpen ? " is-open" : ""}`}
                aria-label="Profile menu"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((v) => !v)}
              >
                {avatar ? <img src={avatar} alt="" /> : <span>{initials(displayName)}</span>}
              </button>
              {profileOpen && (
                <div className="db3__pop" role="menu">
                  <div className="db3__pophead">{displayName}</div>
                  <button className="db3__popitem" role="menuitem" onClick={() => { setProfileOpen(false); setEditing(true); }}>
                    <IconGear /> Edit profile
                  </button>
                  <button
                    className="db3__popitem db3__popitem--danger"
                    role="menuitem"
                    onClick={async () => {
                      setProfileOpen(false);
                      try {
                        await clerk.signOut({ redirectUrl: "/" });
                        // Hard redirect in case the SPA redirect gets stuck in middleware.
                        window.location.assign("/");
                      } catch (err) {
                        console.error("Logout failed", err);
                        window.location.assign("/sign-in");
                      }
                    }}
                  >
                    <IconLogout /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {active === null ? (
          /* HOME */
          <div className="db3__center" ref={searchRef}>
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

            <section className="db3__jobs">
              <div className="db3__sectionhead">
                <div>
                  <p className="db3__eyebrow">LIVE DISCOVERY</p>
                  <h2 className="db3__h2">Search jobs</h2>
                </div>
                <button className="db3__link" onClick={openJobs}>All discovered jobs <IconArrow /></button>
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
                  <li key={i} className="db3__listing" onClick={() => setSelected(j)}>
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
        ) : (
          /* MODULE VIEW (center column swaps; nav + rail stay) */
          <div className="db3__center" data-lenis-prevent>
            <div className="db3__modulebar">
              <button className="db3__back" onClick={closeModule}>← Back to dashboard</button>
              <span className="db3__modulecrumb">{NAV_BY_ID[active]?.title}</span>
            </div>
            {active === "jobs" ? (
              <JobBoard initialQuery={query} initialLocation={location} />
            ) : ActiveMod ? (
              <ActiveMod />
            ) : null}
          </div>
        )}
      </main>

      {/* ---------- RIGHT RAIL ---------- */}
      <aside className="db3__rail" aria-label="Status and analytics">
        <section className="db3__readiness">
          <p className="db3__eyebrow">READINESS {scanning && <span className="db3__live">• scanning</span>}</p>
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
          <p className="db3__railnote">
            {resumeText
              ? <>Your saved resume is <strong>{resumeReady}% complete</strong>. ATS scans run automatically on every upload.</>
              : <>No resume saved yet. Add your resume to power tailoring, matching & insights.</>}
          </p>
          <button className="db3__cta db3__cta--ghost" onClick={() => resumeText && scanResume(resumeText, user?.primaryEmailAddress?.emailAddress)} disabled={scanning}>
            {scanning ? "Scanning…" : "Re-scan resume"} <IconArrow />
          </button>
        </section>

        <section className="db3__analysis">
          <div className="db3__sectionhead">
            <div>
              <p className="db3__eyebrow">ANALYSIS {stats && typeof stats.ats === "number" && <span className="db3__live">• live</span>}</p>
              <h2 className="db3__h2">ATS progress</h2>
            </div>
            <IconTrend />
          </div>
          <div className="db3__chart" aria-label="ATS score">
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

      {/* Center job preview → in-app apply modal (never redirects externally) */}
      {selected && <JobApplyModal job={selected} onClose={() => setSelected(null)} />}

      {editing && <EditProfileModal email={user?.primaryEmailAddress?.emailAddress || ""} onClose={() => setEditing(false)} />}

      {/* ---------- MOBILE BOTTOM NAV (always visible <=680px) ---------- */}
      <nav className="db3__bottomnav" aria-label="Primary mobile">
        {MOBILE_NAV.map((n) => (
          <button
            key={n.id}
            className={`db3__bnitem${active === n.id || (n.id === "dashboard" && active === null) ? " is-active" : ""}`}
            onClick={() => (n.id === "dashboard" ? closeModule() : openModule(n.id))}
            aria-current={n.id === "dashboard" && active === null ? "page" : undefined}
            aria-label={n.title}
          >
            <span className="db3__bnicon"><n.Icon /></span>
            <span className="db3__bntitle">{n.title}</span>
          </button>
        ))}
        <button
          className={`db3__bnitem${moreOpen ? " is-active" : ""}`}
          onClick={() => setMoreOpen(true)}
          aria-label="More features"
          aria-expanded={moreOpen}
        >
          <span className="db3__bnicon"><IconLayers /></span>
          <span className="db3__bntitle">More</span>
        </button>
      </nav>

      {/* ---------- MOBILE "MORE" SHEET: every feature ---------- */}
      {moreOpen && (
        <div
          className="db3__moresheet" role="dialog" aria-modal="true" aria-label="All features"
          onClick={(e) => { if (e.target === e.currentTarget) setMoreOpen(false); }}
        >
          <div className="db3__moresheet__panel" ref={moreSheetRef}>
            <div className="db3__moresheet__head">
              <span>All features</span>
              <button className="db3__moresheet__close" onClick={() => setMoreOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="db3__moresheet__scroll" data-lenis-prevent>
              {NAV.map((sec, i) => (
                <div className="db3__moresheet__group" key={i}>
                  {sec.heading && <div className="db3__moresheet__heading">{sec.heading}</div>}
                  {sec.items
                    .filter((it) => !it.settings && !it.logout)
                    .map((it) => (
                      <button
                        key={it.id}
                        className="db3__moresheet__item"
                        onClick={() => { setMoreOpen(false); openModule(it.id); }}
                      >
                        <span className="db3__moresheet__icon"><it.Icon /></span>
                        <span className="db3__moresheet__text">
                          <span className="db3__moresheet__title">{it.title}</span>
                          <span className="db3__moresheet__sub">{it.sub}</span>
                        </span>
                      </button>
                    ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
