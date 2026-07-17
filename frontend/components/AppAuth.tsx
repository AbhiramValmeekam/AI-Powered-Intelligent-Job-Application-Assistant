"use client";

import { useEffect, useState } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { profiles, resume as resumeApi } from "@/lib/api";
import { ResumeUpload } from "@/components/ResumeUpload";

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

function EditProfileModal({ email, onClose }: { email: string; onClose: () => void }) {
  const [fullName, setFullName] = useState("");
  const [location, setLocation] = useState("");
  const [skills, setSkills] = useState("");
  const [goal, setGoal] = useState("");
  const [resume, setResume] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
      setDone(true);
    } catch (e: any) {
      setError(e?.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal profile-edit"
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
              label="Master resume (used for tailoring & auto-apply)"
              value={resume}
              onChange={setResume}
            />
            {error && <p className="modal__err">{error}</p>}
          </div>
        )}

        <div className="modal__actions">
          <button className="modal__secondary" onClick={onClose}>
            Close
          </button>
          {!done && !loading && (
            <button
              className="primary-cta"
              onClick={save}
              disabled={saving}
            >
              <span>{saving ? "Saving…" : "Save changes"}</span>
              <span aria-hidden>↗</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10,
  padding: "0.7rem 0.85rem",
  color: "inherit",
  font: "inherit",
  outline: "none",
};
