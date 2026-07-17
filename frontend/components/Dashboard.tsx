"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { SECTIONS } from "@/lib/nav";
import { DashboardNav } from "@/components/DashboardNav";
import { DashboardHeader } from "@/components/DashboardHeader";
import { DashboardHome } from "@/components/DashboardHome";
import { EditProfileModal } from "@/components/AppAuth";
import {
  JobsModule, AlertsModule, JdModule, TailorModule, CoverModule,
  AtsModule, SkillsModule, ScamModule, CompanyModule, InterviewModule,
  TrackerModule, VersionsModule, AnalyticsModule, LearningModule, AdvisorModule,
} from "@/lib/modules";

// Maps each section slug to its existing module component (functionality
// preserved 1:1 — the modules are unchanged, only re-hosted as sections).
const MODULE_BY_SLUG: Record<string, React.ComponentType> = {
  jobs: JobsModule, alerts: AlertsModule, jd: JdModule, tailor: TailorModule,
  cover: CoverModule, ats: AtsModule, skills: SkillsModule, scam: ScamModule,
  company: CompanyModule, interview: InterviewModule, tracker: TrackerModule,
  versions: VersionsModule, analytics: AnalyticsModule, learning: LearningModule,
  advisor: AdvisorModule,
};

export function Dashboard() {
  const { user } = useUser();
  const [active, setActive] = useState("home");
  const [editing, setEditing] = useState(false);
  const observed = useRef<Map<Element, string>>(new Map());

  // Scroll-spy: the section whose top is nearest the header line wins.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        // Pick the most-visible intersecting section.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const slug = observed.current.get(visible[0].target);
          if (slug) setActive(slug);
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    observed.current.forEach((_, el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const registerSection = (slug: string) => (el: HTMLElement | null) => {
    if (el) observed.current.set(el, slug);
  };

  const email = user?.primaryEmailAddress?.emailAddress || "";

  // Enable scroll snapping only while on the dashboard.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("dash-snap");
    return () => root.classList.remove("dash-snap");
  }, []);

  return (
    <div className="dash" data-app-motion>
      <DashboardNav active={active} />
      <DashboardHeader onEditProfile={() => setEditing(true)} />

      <main className="dash__main" id="dash-main">
        <section id="sec-home" ref={registerSection("home")} className="dsection dsection--home">
          <DashboardHome />
        </section>

        {SECTIONS.filter((s) => s.slug !== "home").map((s) => {
          const Mod = MODULE_BY_SLUG[s.slug];
          return (
            <section
              key={s.slug}
              id={`sec-${s.slug}`}
              ref={registerSection(s.slug)}
              className="dsection"
              aria-label={s.title}
            >
              <div className="dsection__wrap">{Mod && <Mod />}</div>
            </section>
          );
        })}
      </main>

      {editing && <EditProfileModal email={email} onClose={() => setEditing(false)} />}
    </div>
  );
}
