"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useUser, useClerk } from "@clerk/nextjs";

function greeting(d: Date) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

/**
 * Top-right utility header: time-aware greeting, locale date/time (updated
 * once per minute), and an avatar (or initials fallback) that opens an
 * accessible profile menu. Reuses Clerk auth data + the existing theme
 * toggle; no fabricated username.
 */
export function DashboardHeader({ onEditProfile }: { onEditProfile: () => void }) {
  const [now, setNow] = useState<Date | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const { user: u } = useUser();
  const clerk = useClerk();

  const displayName =
    u?.firstName || u?.fullName || u?.primaryEmailAddress?.emailAddress?.split("@")[0] || "there";
  const avatarUrl = u?.imageUrl || "";

  // Clock: align to the next minute, then tick per minute (no seconds shown).
  useEffect(() => {
    setNow(new Date());
    let interval: number | undefined;
    const align = window.setTimeout(() => {
      setNow(new Date());
      interval = window.setInterval(() => setNow(new Date()), 60_000);
    }, (60 - new Date().getSeconds()) * 1000);
    return () => {
      window.clearTimeout(align);
      if (interval) window.clearInterval(interval);
    };
  }, []);

  // Close menu on outside click / Escape; restore focus to trigger on Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const toggleTheme = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    root.style.colorScheme = next;
    try {
      localStorage.setItem("careeros-theme", next);
    } catch {
      /* selected theme still applies */
    }
  };

  const dateStr = now
    ? now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
    : "";
  const timeStr = now
    ? now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : "";

  return (
    <header className="dhead">
      <div className="dhead__meta">
        <p className="dhead__greeting">
          {now ? greeting(now) : "Welcome"},{" "}
          <span className="dhead__name">{displayName}</span>
        </p>
        <p className="dhead__clock" suppressHydrationWarning>
          <span className="dhead__date">{dateStr}</span>
          <span className="dhead__time">{timeStr}</span>
        </p>
      </div>

      <div className="dhead__profile">
        <button
          ref={btnRef}
          className="dhead__avatar"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Open profile menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" />
          ) : (
            <span className="dhead__initials">{initials(displayName)}</span>
          )}
        </button>

        {menuOpen && (
          <div ref={menuRef} className="dmenu" role="menu" aria-label="Profile">
            <div className="dmenu__id">
              <span className="dmenu__name">{u?.fullName || displayName}</span>
              {u?.primaryEmailAddress?.emailAddress && (
                <span className="dmenu__email">{u.primaryEmailAddress.emailAddress}</span>
              )}
            </div>
            <button
              className="dmenu__item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onEditProfile();
              }}
            >
              Edit profile
            </button>
            <button className="dmenu__item" role="menuitem" onClick={toggleTheme}>
              Toggle theme
            </button>
            <Link className="dmenu__item" role="menuitem" href="/" onClick={() => setMenuOpen(false)}>
              Landing page
            </Link>
            {clerk && (
              <button
                className="dmenu__item dmenu__item--danger"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  clerk.signOut({ redirectUrl: "/" });
                }}
              >
                Sign out
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
