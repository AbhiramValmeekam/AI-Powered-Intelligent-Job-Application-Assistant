"use client";

/**
 * BootController — cinematic "camera pull-back" transition.
 * -----------------------------------------------------------
 * The loading scene (gradient + particles + glass + CareerOS wordmark) and the
 * dashboard both exist from the start, stacked in z-space. One master GSAP
 * timeline overlaps every motion:
 *   - the loading LAYER scales up (1 -> 1.15), blurs (0 -> 25px), fades out;
 *   - the dashboard LAYER (already mounted underneath) scales down (1.08 -> 1),
 *     un-blurs (20px -> 0), brightens (0.7 -> 1), fades in;
 *   - depth layers move at slightly different speeds (parallax);
 *   - cards emerge (blur + translateY + scale, stagger 0.05).
 * Nothing translates aggressively or flies — it reads as the camera moving
 * backward through the loading screen into the workspace.
 *
 * Replay policy: runs once per Clerk session (keyed by sessionId).
 * Reduced motion -> skip straight to ready.
 */

import { useLayoutEffect, useRef, useState } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import gsap from "gsap";
import { DashboardV2 } from "./DashboardV2";

type Phase = "loading" | "ready";

const BOOT_KEY = (sid?: string | null) => `careeros_booted_${sid ?? "anon"}`;

export default function BootController() {
  const { isLoaded, isSignedIn } = useUser();
  const { sessionId } = useAuth();
  const [phase, setPhase] = useState<Phase>("loading");

  const rootRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null); // loading LAYER (camera group)
  const bgRef = useRef<HTMLDivElement>(null); // loading bg gradient (far layer)
  const particlesRef = useRef<HTMLDivElement>(null); // particles (mid layer)
  const glassRef = useRef<HTMLDivElement>(null); // glass overlays (near layer)
  const logoRef = useRef<HTMLDivElement>(null); // wordmark (attached to scene)
  const dashRef = useRef<HTMLDivElement>(null); // dashboard LAYER (underneath)

  const skip =
    isLoaded && isSignedIn && typeof window !== "undefined" && sessionStorage.getItem(BOOT_KEY(sessionId));

  useLayoutEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (skip || phase === "ready") {
      setPhase("ready");
      return;
    }
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sessionStorage.setItem(BOOT_KEY(sessionId), "1");
      setPhase("ready");
      return;
    }

    const ctx = gsap.context(() => {
      const scene = sceneRef.current!;
      const bg = bgRef.current!;
      const particles = particlesRef.current!;
      const glass = glassRef.current!;
      const logo = logoRef.current!;
      const dash = dashRef.current!;

      // --- initial states (before paint; useLayoutEffect => no flash) ---
      // Loading layer calm and present.
      gsap.set(scene, { autoAlpha: 1, scale: 1, filter: "blur(0px)" });
      gsap.set(bg, { autoAlpha: 1, scale: 1 });
      gsap.set(particles, { autoAlpha: 1, scale: 1, yPercent: 0 });
      gsap.set(glass, { autoAlpha: 0.5 });
      gsap.set(logo, { autoAlpha: 1, scale: 1, filter: "blur(0px)" });
      // Dashboard hidden underneath, slightly larger + dim + blurred (camera far).
      gsap.set(dash, { autoAlpha: 0, scale: 1.08, filter: "blur(20px)", brightness: 0.7 });
      gsap.set("[data-boot]", { autoAlpha: 0, y: 16, scale: 0.98, filter: "blur(15px)" });

      const tl = gsap.timeline({
        defaults: { ease: "power4.inOut" },
        onComplete: () => {
          sessionStorage.setItem(BOOT_KEY(sessionId), "1");
          setPhase("ready");
        },
      });

      // LABELS — everything overlaps; nothing fully finishes before the next starts.
      tl.addLabel("reveal", 0.35); // begin ~350ms after mount (auth settle)

      // Loading LAYER pulls back: scale up, blur, fade. The camera moves away.
      tl.to(scene, { scale: 1.15, filter: "blur(25px)", autoAlpha: 0, duration: 1.9 }, "reveal");
      // Far bg recedes a touch faster (parallax depth).
      tl.to(bg, { scale: 1.22, autoAlpha: 0, duration: 1.7 }, "reveal");
      // Particles drift + recede.
      tl.to(particles, { scale: 1.3, yPercent: -6, autoAlpha: 0, duration: 1.8 }, "reveal");
      // Glass overlays soften first.
      tl.to(glass, { autoAlpha: 0, duration: 0.9 }, "reveal");
      // Wordmark stays attached to the scene: shrink + blur + fade (no travel).
      tl.to(logo, { scale: 0.22, filter: "blur(15px)", autoAlpha: 0, duration: 1.7 }, "reveal");

      // Dashboard LAYER emerges: scale down, un-blur, brighten, fade in.
      tl.to(dash, { autoAlpha: 1, scale: 1, filter: "blur(0px)", brightness: 1, duration: 1.9 }, "reveal+=0.15");

      // Navbar first (guide the eye), then sidebar, greeting, widgets, charts…
      const order = [
        ".db3__topbar",
        ".db3__nav",
        ".db3__topactions",
        ".db3__center",
        ".db3__rail",
      ];
      tl.to(
        order,
        { autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.9, stagger: 0.08 },
        "reveal+=0.55",
      );
      // Remaining [data-boot] cards emerge after the structure is in focus.
      tl.to(
        '[data-boot]:not(.db3__topbar):not(.db3__nav):not(.db3__topactions):not(.db3__center):not(.db3__rail)',
        { autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.8, stagger: 0.05 },
        "reveal+=0.95",
      );
    }, rootRef);

    return () => ctx.revert();
  }, [isLoaded, isSignedIn, skip, sessionId, phase]);

  return (
    <div ref={rootRef} className="boot-root">
      {/* Dashboard layer lives underneath the loading scene from the start. */}
      <div ref={dashRef} className="boot-dash">
        <DashboardV2 />
      </div>

      {/* Loading scene (camera group) — only shown until ready. */}
      {phase !== "ready" && (
        <div ref={sceneRef} className="boot-scene" role="status" aria-live="polite">
          <div ref={bgRef} className="boot-scene__bg" aria-hidden="true" />
          <div ref={particlesRef} className="boot-scene__particles" aria-hidden="true">
            {Array.from({ length: 16 }).map((_, i) => (
              <span key={i} className="boot-particle" style={{ ["--i" as any]: i }} />
            ))}
          </div>
          <div ref={glassRef} className="boot-scene__glass" aria-hidden="true" />
          <div className="boot-scene__center">
            {!isLoaded || !isSignedIn ? (
              <div className="boot-loader">
                <span className="boot-loader__spinner" />
                <p>Preparing your workspace…</p>
              </div>
            ) : (
              <div ref={logoRef} className="boot-logo">
                <div className="boot-logo__text">
                  <span className="boot-logo__career">Career</span>
                  <span className="boot-logo__os">OS</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
