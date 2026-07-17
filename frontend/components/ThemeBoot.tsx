"use client";

import { useEffect } from "react";

// Applies the saved/ preferred theme before the UI paints.
// Runs as a client component (no <script> tag) so it does not trigger the
// Next 16 / React 19 "script tag while rendering React component" error.
// We set the attribute during the first effect, which fires before paint
// for the most part; the CSS default (dark) matches our initial state, so
// any flash is imperceptible.
export function ThemeBoot() {
  useEffect(() => {
    try {
      const stored = localStorage.getItem("careeros-theme");
      const preferred = window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
      document.documentElement.dataset.theme =
        stored === "light" || stored === "dark" ? stored : preferred;
    } catch {
      document.documentElement.dataset.theme = "dark";
    }
  }, []);
  return null;
}
