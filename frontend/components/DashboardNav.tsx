"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { SECTIONS } from "@/lib/nav";
import { stopScroll, startScroll } from "@/lib/smoothScroll";

/**
 * Edge-activated navigation panel.
 * - Desktop: hidden just off the left edge; a narrow hover zone reveals it.
 *   Stays open while pointer is over the zone or the panel; closes after a
 *   short delay to avoid flicker. Esc closes; keyboard focus opens.
 * - Mobile/touch: a floating trigger opens it as a drawer with a backdrop.
 * - Scroll-spy keeps the active section highlighted; links smooth-scroll to
 *   the matching section (scroll-padding handles the fixed header).
 */
export function DashboardNav({ active }: { active: string }) {
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  const clearClose = useCallback(() => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 320);
  }, [clearClose]);

  // Esc closes either surface.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Lock background scroll while the mobile drawer is open.
  useEffect(() => {
    if (mobileOpen) stopScroll();
    else startScroll();
    return () => startScroll();
  }, [mobileOpen]);

  const go = (slug: string, closeMobile = false) => {
    const el = document.getElementById(`sec-${slug}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    if (closeMobile) setMobileOpen(false);
    else setOpen(false);
  };

  return (
    <>
      {/* Desktop hover activation zone */}
      <div
        className="dnav-zone"
        aria-hidden="true"
        onMouseEnter={() => {
          clearClose();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
      />

      {/* Mobile floating trigger */}
      <button
        className="dnav-trigger"
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
      >
        <span /><span /><span />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="dnav-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      <nav
        ref={panelRef}
        className={`dnav${open ? " is-open" : ""}${mobileOpen ? " is-mobile-open" : ""}`}
        aria-label="Dashboard sections"
        onMouseEnter={() => {
          clearClose();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        onFocusCapture={() => setOpen(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) scheduleClose();
        }}
      >
        <div className="dnav__inner">
          <div className="dnav__brand">
            <span className="dnav__brand-mark">CAREER OS</span>
            <span className="dnav__brand-kicker">Command Center</span>
          </div>
          <ul className="dnav__list">
            {SECTIONS.map((s) => {
              const isActive = active === s.slug;
              return (
                <li key={s.slug}>
                  <a
                    href={`#sec-${s.slug}`}
                    className={`dnav__item${isActive ? " is-active" : ""}`}
                    aria-current={isActive ? "true" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      go(s.slug, mobileOpen);
                    }}
                  >
                    <span className="dnav__idx">{s.index}</span>
                    <span className="dnav__txt">
                      <span className="dnav__title">{s.title}</span>
                      <span className="dnav__eyebrow">{s.eyebrow}</span>
                    </span>
                    {isActive && <span className="dnav__dot" aria-hidden="true" />}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </>
  );
}
