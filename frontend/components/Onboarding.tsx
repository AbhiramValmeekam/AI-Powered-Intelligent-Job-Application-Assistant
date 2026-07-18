"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useUser } from "@clerk/nextjs";
import { profiles, resume as resumeApi } from "@/lib/api";
import { ResumeUpload } from "@/components/ResumeUpload";
import { extractProfile } from "@/lib/resumeExtract";

type Form = {
  fullName: string;
  location: string;
  links: string; // github / linkedin / portfolio, comma-ish lines
  skills: string; // comma separated
  education: string; // "Degree, Institution, Year" per line
  experience: string; // "Title @ Company — bullets" per line (simplified)
  goal: string; // career goal / preferred roles
  preferredLocations: string;
  salaryExpectation: string;
  resume: string; // parsed resume text (master resume)
};

const empty: Form = {
  fullName: "",
  location: "",
  links: "",
  skills: "",
  education: "",
  experience: "",
  goal: "",
  preferredLocations: "",
  salaryExpectation: "",
  resume: "",
};

const TOTAL = 4;

function parseList(s: string): string[] {
  return s
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseEducation(s: string): any[] {
  return parseList(s).map((line) => {
    const [degree, ...rest] = line.split(/[–—-]/).map((x) => x.trim());
    const joined = rest.join(" ").trim();
    return { degree: degree || line, institution: joined || "", dates: "" };
  });
}

function parseExperience(s: string): any[] {
  return parseList(s).map((line) => {
    const [title, ...rest] = line.split(/[–—@]/).map((x) => x.trim());
    return { title: title || line, company: rest.join(" ").replace(/^[-:]\s*/, "") || "", bullets: [] };
  });
}

function parseLinks(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  parseList(s).forEach((line) => {
    const [k, ...v] = line.split(/[:]/).map((x) => x.trim());
    if (v.join("")) out[(k || "link").toLowerCase()] = v.join(":").trim();
  });
  return out;
}

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { user, isLoaded } = useUser();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const email = user?.primaryEmailAddress?.emailAddress || "";

  // GSAP step transition
  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { autoAlpha: 0, y: 26, scale: 0.98 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, ease: "power3.out" }
      );
    }
    if (progressRef.current) {
      gsap.to(progressRef.current, {
        width: `${((step + 1) / TOTAL) * 100}%`,
        duration: 0.5,
        ease: "power2.out",
      });
    }
  }, [step]);

  // Intro animation + focus first field
  useEffect(() => {
    if (!isLoaded || !user) return;
    const root = document.querySelector(".onboarding");
    if (root) {
      gsap.fromTo(
        root,
        { autoAlpha: 0, backdropFilter: "blur(0px)" },
        { autoAlpha: 1, duration: 0.4, ease: "power2.out" }
      );
    }
  }, [isLoaded, user]);

  function set<K extends keyof Form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // When a resume is parsed, auto-fill every empty field so the user doesn't
  // have to retype what's already in their document. Existing entries win.
  function autoFillFromResume(text: string) {
    const e = extractProfile(text);
    setForm((f) => ({
      ...f,
      fullName: f.fullName.trim() || e.fullName,
      location: f.location.trim() || e.location,
      skills: f.skills.trim() || e.skills.join(", "),
      education: f.education.trim() || e.education.join("\n"),
      experience: f.experience.trim() || e.experience.join("\n"),
      links: f.links.trim() || e.links,
      goal: f.goal.trim() || e.goal,
    }));
  }

  function next() {
    if (step < TOTAL - 1) {
      setStep((s) => s + 1);
    } else {
      void finish();
    }
  }
  function back() {
    if (step > 0) setStep((s) => s - 1);
  }

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        fullName: form.fullName.trim() || (user?.fullName ?? ""),
        email,
        location: form.location.trim() || null,
        links: parseLinks(form.links),
        skills: parseList(form.skills),
        education: parseEducation(form.education),
        experience: parseExperience(form.experience),
        careerPreferences: {
          goal: form.goal.trim(),
          preferredRoles: parseList(form.goal),
        },
        preferredLocations: parseList(form.preferredLocations),
        salaryExpectation: form.salaryExpectation.trim() || null,
      };
      await profiles.upsert(payload);
      // Save the master resume (used for tailoring, auto-apply, etc.)
      if (form.resume.trim()) {
        await resumeApi.master.upsert(email, form.resume.trim());
      }
      // animate out
      setClosing(true);
      const root = document.querySelector(".onboarding");
      if (root) {
        gsap.to(root, {
          autoAlpha: 0,
          y: 20,
          duration: 0.35,
          ease: "power2.in",
          onComplete: onDone,
        });
      } else {
        onDone();
      }
    } catch (e: any) {
      setError(e?.message || "Could not save your profile. Please try again.");
    } finally {
      if (!closing) setSaving(false);
    }
  }

  function skip() {
    // Allow entering the app without completing the wizard (profile stays empty).
    onDone();
  }

  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-label="Welcome to CareerOS">
      <div className="onboarding__card" ref={cardRef}>
        <div className="onboarding__progress">
          <div className="onboarding__progress-bar" ref={progressRef} />
        </div>

        <div className="onboarding__head">
          <span className="onboarding__eyebrow">CareerOS · Setup</span>
          <h2 className="onboarding__title">
            {step === 0 && "Welcome aboard 👋"}
            {step === 1 && "Your skills & goals"}
            {step === 2 && "Education & experience"}
            {step === 3 && "Almost there"}
          </h2>
          <p className="onboarding__sub">
            {step === 0 && "Let's build your master profile — it powers tailoring, matching and insights. Takes ~1 minute."}
            {step === 1 && "What do you know and where are you headed? Comma- or line-separated."}
            {step === 2 && "Add your background so we can tailor applications truthfully."}
            {step === 3 && "Final touches — links and preferences. You can edit any time later."}
          </p>
        </div>

        <div className="onboarding__body">
          {step === 0 && (
            <div className="onboarding__fields">
              <label className="field">
                <span>Full name</span>
                <input
                  style={inputStyle}
                  value={form.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                  placeholder={user?.fullName || "Valmeekam Abhiram"}
                  autoFocus
                />
              </label>
              <label className="field">
                <span>Location</span>
                <input style={inputStyle} value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Hyderabad, India" />
              </label>
              <label className="field">
                <span>Career goal / preferred roles</span>
                <input style={inputStyle} value={form.goal} onChange={(e) => set("goal", e.target.value)} placeholder="Backend / AI engineer" />
              </label>
              <ResumeUpload label="Upload your resume (we'll auto-fill the form from it)" value={form.resume} onChange={(t) => { set("resume", t); if (t) autoFillFromResume(t); }} />
            </div>
          )}

          {step === 1 && (
            <div className="onboarding__fields">
              <label className="field">
                <span>Skills (comma or newline separated)</span>
                <textarea style={inputStyle} rows={4} value={form.skills} onChange={(e) => set("skills", e.target.value)} placeholder="Python, React, Node.js, OpenCV, SQL" />
              </label>
              <label className="field">
                <span>Preferred locations</span>
                <input style={inputStyle} value={form.preferredLocations} onChange={(e) => set("preferredLocations", e.target.value)} placeholder="Hyderabad, Bengaluru, Remote" />
              </label>
              <label className="field">
                <span>Expected salary (optional)</span>
                <input style={inputStyle} value={form.salaryExpectation} onChange={(e) => set("salaryExpectation", e.target.value)} placeholder="12 LPA" />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="onboarding__fields">
              <label className="field">
                <span>Education (one per line: Degree — Institution — Year)</span>
                <textarea style={inputStyle} rows={3} value={form.education} onChange={(e) => set("education", e.target.value)} placeholder={"B.Tech CSE — Anurag University — 2028"} />
              </label>
              <label className="field">
                <span>Experience (one per line: Title @ Company)</span>
                <textarea style={inputStyle} rows={4} value={form.experience} onChange={(e) => set("experience", e.target.value)} placeholder={"AI Tutor @ Self — built React/Node tutor"} />
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="onboarding__fields">
              <label className="field">
                <span>Links (one per line: github: url, linkedin: url, portfolio: url)</span>
                <textarea style={inputStyle} rows={3} value={form.links} onChange={(e) => set("links", e.target.value)} placeholder={"github: https://github.com/abhiram\nlinkedin: https://linkedin.com/in/abhiram"} />
              </label>
              <p className="onboarding__hint">
                That's it! We'll use this to tailor resumes, score ATS fit, and surface relevant roles.
              </p>
            </div>
          )}
        </div>

        {error && <p className="onboarding__error">{error}</p>}

        <div className="onboarding__actions">
          <button className="onboarding__skip" onClick={skip} disabled={saving}>
            Skip for now
          </button>
          <div className="onboarding__nav">
            {step > 0 && (
              <button className="onboarding__back" onClick={back} disabled={saving}>
                Back
              </button>
            )}
            <button className="primary-cta" onClick={next} disabled={saving}>
              <span>{saving ? "Saving…" : step === TOTAL - 1 ? "Finish & enter" : "Continue"}</span>
              <span aria-hidden>↗</span>
            </button>
          </div>
        </div>
        <div className="onboarding__dots">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <span key={i} className={`onboarding__dot ${i === step ? "is-active" : ""} ${i < step ? "is-done" : ""}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Shared input styling (kept inline-light to avoid theme coupling).
const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10,
  padding: "0.7rem 0.85rem",
  color: "inherit",
  font: "inherit",
  outline: "none",
};
