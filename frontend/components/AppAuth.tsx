"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { UserButton, useUser } from "@clerk/nextjs";
import { profiles, resume as resumeApi } from "@/lib/api";
import { ResumeUpload } from "@/components/ResumeUpload";
import { StatusButton } from "@/components/StatusButton";
import { extractProfile } from "@/lib/resumeExtract";
import { stopScroll, startScroll } from "@/lib/smoothScroll";

const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function AppAuth() {
  if (!clerkEnabled) return null;
  return <AppAuthInner />;
}

function AppAuthInner() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [editing, setEditing] = useState(false);

  if (!isLoaded) return null;

  if (!isSignedIn) {
    return (
      <a className="app-nav__auth-link" href="/sign-in">
        Sign in
      </a>
    );
  }

  const email = user?.primaryEmailAddress?.emailAddress || "";

  return (
    <>
      <div className="app-nav__auth">
        <button className="app-nav__edit" onClick={() => setEditing(true)}>
          Edit profile
        </button>
        <UserButton />
      </div>
      {editing && (
        <EditProfileModal
          email={email}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}

export function EditProfileModal({ email, onClose }: { email: string; onClose: () => void }) {
  const [fullName, setFullName] = useState("");
  const [location, setLocation] = useState("");
  const [skills, setSkills] = useState("");
  const [goal, setGoal] = useState("");
  const [resume, setResume] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [mounted, setMounted] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Lock background scroll, trap focus, close on Esc — while the modal is open.
  useEffect(() => {
    if (!mounted) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    stopScroll(); // fully pause Lenis so wheeling the modal can't move the page
    modalRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      startScroll();
    };
  }, [mounted, onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, r] = await Promise.allSettled([
          profiles.get(email),
          resumeApi.master.get(email),
        ]);
        if (cancelled) return;
        if (p.status === "fulfilled" && p.value) {
          setFullName(p.value.fullName || "");
          setLocation(p.value.location || "");
          setSkills((p.value.skills || []).join(", "));
          setGoal(p.value.careerPreferences?.goal || "");
        }
        if (r.status === "fulfilled" && r.value?.data?.text) {
          setResume(r.value.data.text);
        }
      } catch {
        /* ignore — empty form is fine */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email]);

  function autoFillFromResume(text: string) {
    const e = extractProfile(text);
    if (e.fullName) setFullName((v) => v.trim() || e.fullName);
    if (e.location) setLocation((v) => v.trim() || e.location);
    if (e.skills.length) setSkills((v) => v.trim() || e.skills.join(", "));
    if (e.goal) setGoal((v) => v.trim() || e.goal);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await profiles.upsert({
        email,
        fullName: fullName.trim(),
        location: location.trim() || null,
        skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
        careerPreferences: { goal: goal.trim() },
      });
      if (resume.trim()) await resumeApi.master.upsert(email, resume.trim());
      if (resume.trim() && typeof window !== "undefined") {
        window.dispatchEvent(new Event("resume:updated"));
      }
      setDone(true);
    } catch (e: any) {
      setError(e?.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal profile-edit"
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        data-lenis-prevent
      >
        <header className="modal__head">
          <div>
            <span className="modal__eyebrow">Account</span>
            <h3 className="modal__title">Edit your profile</h3>
          </div>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        {loading ? (
          <p className="modal__hint">Loading…</p>
        ) : done ? (
          <p className="modal__done-msg">Saved ✅ Your profile and resume are updated.</p>
        ) : (
          <div className="modal__body">
            <label className="field">
              <span>Full name</span>
              <input
                style={fieldStyle}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Location</span>
              <input
                style={fieldStyle}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Skills (comma separated)</span>
              <input
                style={fieldStyle}
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Career goal</span>
              <input
                style={fieldStyle}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </label>
            <ResumeUpload
              label="Master resume (we'll auto-fill the form from it)"
              value={resume}
              onChange={(t) => { setResume(t); if (t) autoFillFromResume(t); }}
            />
            {error && <p className="modal__err">{error}</p>}
          </div>
        )}

        <div className="modal__actions">
          <button className="modal__secondary" onClick={onClose}>
            Close
          </button>
          <StatusButton
            idleLabel="Save changes"
            loadingLabel="Saving…"
            successLabel="Saved"
            loading={saving}
            done={done}
            onClick={save}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  background: "color-mix(in srgb, var(--ink) 4%, transparent)",
  border: "1px solid color-mix(in srgb, var(--ink) 12%, transparent)",
  borderRadius: 10,
  padding: "0.7rem 0.85rem",
  color: "inherit",
  font: "inherit",
  outline: "none",
};
