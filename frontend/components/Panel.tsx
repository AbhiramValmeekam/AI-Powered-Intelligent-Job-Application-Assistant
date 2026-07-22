"use client";

import { ReactNode } from "react";
import { StatusButton } from "@/components/StatusButton";

/**
 * Cinematic UI primitives that share the landing page's visual language:
 * numbered section labels, big headlines, monospace meta, and a dark/light
 * theme-aware surface. Used by every module in the Command Center so the
 * integration feels native to the CareerOS brand — not a pile of forms.
 */

export function SectionLabel({ index, children }: { index: string; children: ReactNode }) {
  return (
    <p className="section-label">
      {index} / {children}
    </p>
  );
}

export function Panel({
  index,
  title,
  eyebrow,
  children,
  className = "",
}: {
  index: string;
  title: ReactNode;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`} data-scene-style>
      <div className="panel__head">
        {eyebrow && <p className="panel__eyebrow">{eyebrow}</p>}
        <p className="section-label">{index}</p>
        <h2 className="panel__title">{title}</h2>
      </div>
      <div className="panel__body">{children}</div>
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
    </label>
  );
}

export const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "color-mix(in srgb, var(--ink) 4%, transparent)",
  border: "1px solid color-mix(in srgb, var(--ink) 14%, transparent)",
  borderRadius: 10,
  padding: "0.7rem 0.9rem",
  color: "inherit",
  font: "inherit",
  resize: "vertical",
};

export function RunButton({
  onClick,
  loading,
  disabled,
  children,
  done,
}: {
  onClick: () => void;
  loading: boolean;
  disabled?: boolean;
  children: ReactNode;
  done?: boolean | null;
}) {
  return (
    <StatusButton
      idleLabel={String(children ?? "")}
      loadingLabel="Working…"
      successLabel="Done"
      loading={loading}
      done={done}
      disabled={disabled}
      onClick={onClick}
      className="panel__run"
    />
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="note note--error">
      <strong>Could not complete.</strong> {error}
      {error.includes("429") && (
        <div className="note__hint">
          The AI key is rate-limited. Add a Gemini API key in the backend{" "}
          <code>.env</code> to enable this feature.
        </div>
      )}
      {error.includes("fetch") || error.includes("Failed to fetch") ? (
        <div className="note__hint">
          Backend unreachable. Set <code>NEXT_PUBLIC_API_BASE</code> to your
          deployed API and ensure CORS allows this domain.
        </div>
      ) : null}
    </div>
  );
}

export function ResultCard({ children }: { children: ReactNode }) {
  return <div className="result-card">{children}</div>;
}

export function Pre({ data }: { data: unknown }) {
  return (
    <pre className="result-pre">
      {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
    </pre>
  );
}
