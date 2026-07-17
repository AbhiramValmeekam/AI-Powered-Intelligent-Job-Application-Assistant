"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "loading" | "success";

/**
 * StatusButton — equivalent of the uselayouts "status-button" registry
 * component, rebuilt with the CareerOS design tokens (no Tailwind/motion/
 * hugeicons deps).
 *
 * Three states: idle -> loading -> success (auto-returns to idle).
 * - `loading` is controlled by the parent (as with the old RunButton).
 * - `done` is optional: pass an explicit boolean to force the success state
 *   (e.g. only on a successful, non-error result). When omitted, success is
 *   inferred from the loading -> idle transition (matches the reference
 *   component's self-managing behaviour).
 */
export function StatusButton({
  idleLabel,
  loadingLabel = "Working…",
  successLabel = "Done",
  loading = false,
  done,
  disabled,
  onClick,
  type = "button",
  className = "",
}: {
  idleLabel: string;
  loadingLabel?: string;
  successLabel?: string;
  loading?: boolean;
  done?: boolean | null;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
}) {
  const [autoSuccess, setAutoSuccess] = useState(false);
  const wasLoading = useRef(false);
  const timer = useRef<number | null>(null);

  // Infer success from the loading -> idle transition (auto mode).
  useEffect(() => {
    if (!loading && wasLoading.current) {
      const explicit = done !== undefined && done !== null;
      if (!explicit) {
        setAutoSuccess(true);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setAutoSuccess(false), 2000);
      }
    }
    wasLoading.current = loading;
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [loading, done]);

  const status: Status = loading
    ? "loading"
    : done !== undefined && done !== null
      ? done
        ? "success"
        : "idle"
      : autoSuccess
        ? "success"
        : "idle";

  const label =
    status === "loading" ? loadingLabel : status === "success" ? successLabel : idleLabel;

  return (
    <button
      type={type}
      className={`status-btn status-btn--${status} ${className}`}
      onClick={onClick}
      disabled={disabled || status === "loading"}
      data-status={status}
      aria-busy={status === "loading"}
    >
      <span className="status-btn__label" aria-live="polite">
        {label.split("").map((ch, i) => (
          <span
            key={i}
            className="status-btn__char"
            style={{ transitionDelay: `${i * 14}ms` }}
          >
            {ch === " " ? " " : ch}
          </span>
        ))}
      </span>

      <span className="status-btn__indicator" aria-hidden="true">
        {status === "loading" && (
          <svg className="status-btn__spinner" viewBox="0 0 24 24" width="16" height="16">
            <circle className="status-btn__spinner-track" cx="12" cy="12" r="9" />
            <path className="status-btn__spinner-head" d="M12 3a9 9 0 0 1 9 9" />
          </svg>
        )}
        {status === "success" && (
          <svg className="status-btn__check" viewBox="0 0 24 24" width="16" height="16">
            <path className="status-btn__check-path" d="M5 13l4 4 10-11" />
          </svg>
        )}
      </span>
    </button>
  );
}
