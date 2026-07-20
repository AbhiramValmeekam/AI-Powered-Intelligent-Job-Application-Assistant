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
 * Plays on every mount of /app (every reload). Reduced motion -> skip.
 */

import { useLayoutEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import gsap from "gsap";
import { DashboardV2 } from "./DashboardV2";

type Phase = "loading" | "ready";

export default function BootController() {
  const { isLoaded } = useUser();
  const [phase, setPhase] = useState<Phase>("loading");

  const rootRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null); // loading LAYER (camera group)
  const bgRef = useRef<HTMLDivElement>(null); // loading bg gradient (far layer)
  const particlesRef = useRef<HTMLDivElement>(null); // particles (mid layer)
  const glassRef = useRef<HTMLDivElement>(null); // glass overlays (near layer)
  const logoRef = useRef<HTMLDivElement>(null); // wordmark (attached to scene)
  const dashRef = useRef<HTMLDivElement>(null); // dashboard LAYER (underneath)

  useLayoutEffect(() => {
    if (phase === "ready") return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("ready");
      return;
    }
    // Run once on mount. /app is middleware-protected, so the user is already
    // authenticated here — we do NOT wait on Clerk's client useUser() (it can
    // stall on reload and leave only the spinner). The dashboard is mounted
    // underneath; we just orchestrate the camera pull-back.
    const ctx = gsap.context(() => {
      const scene = sceneRef.current!;
      const bg = bgRef.current!;
      const particles = particlesRef.current!;
      const glass = glassRef.current!;
      const logo = logoRef.current!;
      const dash = dashRef.current!;

      // --- initial states (before paint; useLayoutEffect => no flash) ---
      gsap.set(scene, { autoAlpha: 1, scale: 1, filter: "blur(0px)" });
      gsap.set(bg, { autoAlpha: 1, scale: 1 });
      gsap.set(particles, { autoAlpha: 1, scale: 1, yPercent: 0 });
      gsap.set(glass, { autoAlpha: 0.5 });
      gsap.set(logo, { autoAlpha: 1, scale: 1, filter: "blur(0px)" });
      gsap.set(dash, { autoAlpha: 1, scale: 1.08, filter: "blur(20px)", brightness: 0.7 });
      gsap.set("[data-boot]", { autoAlpha: 0, y: 16, scale: 0.98, filter: "blur(15px)" });
      // Hide the real navbar brand until the wordmark lands in its place.
      const brandEl = rootRef.current?.querySelector<HTMLElement>(".db3__brand");
      if (brandEl) gsap.set(brandEl, { autoAlpha: 0 });

      const tl = gsap.timeline({
        defaults: { ease: "power4.inOut" },
        onComplete: () => setPhase("ready"),
      });

      tl.addLabel("reveal", 0.35);

      tl.to(scene, { scale: 1.15, filter: "blur(25px)", autoAlpha: 0, duration: 1.9 }, "reveal");
      tl.to(bg, { scale: 1.22, autoAlpha: 0, duration: 1.7 }, "reveal");
      tl.to(particles, { scale: 1.3, yPercent: -6, autoAlpha: 0, duration: 1.8 }, "reveal");
      tl.to(glass, { autoAlpha: 0, duration: 0.9 }, "reveal");
      // Wordmark FLIES to the top-left navbar brand: compute target rect, tween
      // the boot wordmark to land exactly on .db3__brand, then hand off to it.
      const targetBrand = rootRef.current?.querySelector<HTMLElement>(".db3__brand");
      if (targetBrand && logoRef.current) {
        const tr = targetBrand.getBoundingClientRect();
        const lr = (logoRef.current as HTMLElement).getBoundingClientRect();
        const dx = tr.left + tr.width / 2 - (lr.left + lr.width / 2);
        const dy = tr.top + tr.height / 2 - (lr.top + lr.height / 2);
        const scale = tr.height / lr.height;
        tl.to(logo, { x: dx, y: dy, scale, filter: "blur(0px)", duration: 1.5, ease: "power3.inOut" }, "reveal+=0.45");
        tl.to(logo, { autoAlpha: 0, duration: 0.3 }, "reveal+=1.85");
        tl.to(targetBrand, { autoAlpha: 1, duration: 0.4 }, "reveal+=1.85");
      } else {
        tl.to(logo, { scale: 0.22, filter: "blur(15px)", autoAlpha: 0, duration: 1.7 }, "reveal");
      }
      tl.to(dash, { autoAlpha: 1, scale: 1, filter: "blur(0px)", brightness: 1, duration: 1.9 }, "reveal+=0.15");

      const order = [".db3__topbar", ".db3__nav", ".db3__topactions", ".db3__center", ".db3__rail"];
      tl.to(order, { autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.9, stagger: 0.08 }, "reveal+=0.55");
      tl.to(
        '[data-boot]:not(.db3__topbar):not(.db3__nav):not(.db3__topactions):not(.db3__center):not(.db3__rail):not(.db3__brand)',
        { autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.8, stagger: 0.05 },
        "reveal+=0.95",
      );
    }, rootRef);

    return () => ctx.revert();
  }, [phase]);

  return (
    <div ref={rootRef} className="boot-root">
      {/* Dashboard layer lives underneath the loading scene from the start. */}
      <div ref={dashRef} className="boot-dash">
        <DashboardV2 />
      </div>

      {/* Loading scene (camera group: bg + particles + glass) — dissolves. */}
      {phase !== "ready" && (
        <>
          <div ref={sceneRef} className="boot-scene" role="status" aria-live="polite">
            <div ref={bgRef} className="boot-scene__bg" aria-hidden="true" />
            <div ref={particlesRef} className="boot-scene__particles" aria-hidden="true">
              {Array.from({ length: 16 }).map((_, i) => (
                <span key={i} className="boot-particle" style={{ ["--i" as any]: i }} />
              ))}
            </div>
            <div ref={glassRef} className="boot-scene__glass" aria-hidden="true" />
          </div>

          {/* Wordmark lives in its OWN fixed layer so it can fly to the top-left
              and hand off to the navbar brand (independent of the scene pull-back). */}
          <div ref={logoRef} className="boot-wordmark" aria-hidden="true">
            <div className="boot-logo__text">
              <span className="boot-logo__career">Career</span>
              <span className="boot-logo__os">OS</span>
            </div>
            {!isLoaded && (
              <div className="boot-loader boot-loader--mini">
                <span className="boot-loader__spinner" />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
