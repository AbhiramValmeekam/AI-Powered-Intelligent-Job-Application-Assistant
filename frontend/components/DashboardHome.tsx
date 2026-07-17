"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import * as api from "@/lib/api";

/**
 * Home section: welcome + exactly two prominent statistic cards backed by
 * real analytics data (applications + interview rate). Each card carries a
 * lightweight, looping decorative SVG that reinforces its meaning. All motion
 * is CSS-driven and respects prefers-reduced-motion (handled in globals.css).
 */
export function DashboardHome() {
  const { user } = useUser();
  const [stats, setStats] = useState<{ total: number; interview: number } | null>(null);

  useEffect(() => {
    const email = user?.primaryEmailAddress?.emailAddress;
    let cancelled = false;
    (async () => {
      try {
        const r = await api.analytics.summary(email || undefined);
        if (!cancelled && r) {
          setStats({
            total: r.totalApplications ?? 0,
            interview: r.interviewRate ?? 0,
          });
        }
      } catch {
        if (!cancelled) setStats({ total: 0, interview: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const name =
    user?.firstName ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "there";

  return (
    <div className="dhome">
      <p className="section-label">00 / Overview</p>
      <h1 className="dhome__title">
        Welcome back, <span className="dhome__accent">{name}</span>.
      </h1>
      <p className="dhome__copy">
        Your entire job search — discovery, tailoring, tracking and coaching —
        on one calm surface. Slide to the left edge for navigation.
      </p>

      <div className="dhome__stats">
        {/* Stat 1 — Applications (orbiting nodes = a growing pipeline) */}
        <article className="scard scard--stat">
          <div className="scard__svg" aria-hidden="true">
            <svg viewBox="0 0 120 120" width="100%" height="100%">
              <circle className="orbit-ring" cx="60" cy="60" r="34" />
              <circle className="orbit-ring orbit-ring--2" cx="60" cy="60" r="22" />
              <g className="orbit orbit--slow">
                <circle className="orbit-node" cx="60" cy="26" r="4" />
              </g>
              <g className="orbit orbit--fast">
                <circle className="orbit-node orbit-node--signal" cx="60" cy="38" r="3" />
              </g>
              <circle className="orbit-core" cx="60" cy="60" r="7" />
            </svg>
          </div>
          <div className="scard__body">
            <span className="scard__label">Applications</span>
            <span className="scard__num" suppressHydrationWarning>
              {stats ? stats.total : "—"}
            </span>
            <span className="scard__sub">Tracked across your pipeline</span>
          </div>
        </article>

        {/* Stat 2 — Interview rate (pulsing bars = momentum) */}
        <article className="scard scard--stat">
          <div className="scard__svg" aria-hidden="true">
            <svg viewBox="0 0 120 120" width="100%" height="100%">
              <rect className="pulse-bar pulse-bar--1" x="26" y="60" width="12" height="34" rx="4" />
              <rect className="pulse-bar pulse-bar--2" x="46" y="46" width="12" height="48" rx="4" />
              <rect className="pulse-bar pulse-bar--3" x="66" y="34" width="12" height="60" rx="4" />
              <rect className="pulse-bar pulse-bar--4" x="86" y="52" width="12" height="42" rx="4" />
            </svg>
          </div>
          <div className="scard__body">
            <span className="scard__label">Interview rate</span>
            <span className="scard__num" suppressHydrationWarning>
              {stats ? `${stats.interview}%` : "—"}
            </span>
            <span className="scard__sub">Of applications reaching interview</span>
          </div>
        </article>
      </div>
    </div>
  );
}
