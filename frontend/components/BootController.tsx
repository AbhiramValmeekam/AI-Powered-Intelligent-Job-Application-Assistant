"use client";

/**
 * BootController
 * --------------
 * Drives the "boot into CareerOS" experience on the /app route:
 *   loading (Clerk auth) -> CareerOS logo boot-in -> pause -> logo flies into
 *   the navbar -> dashboard fades in + regions stagger -> ambient background.
 *
 * The dashboard (DashboardV2) is mounted underneath the boot overlay the whole
 * time; we only reveal it once the logo has travelled to the navbar. The real
 * .db3__brand in the sidebar stays hidden during the flight and is revealed as
 * the overlay logo arrives, so the hand-off is seamless.
 *
 * Replay policy: runs once per Clerk session (keyed by sessionId in
 * sessionStorage). Navigating back to /app in the same session skips the boot.
 */

import { useLayoutEffect, useRef, useState } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import gsap from "gsap";
import { DashboardV2 } from "./DashboardV2";

type Phase = "loading" | "boot" | "ready";

const BOOT_KEY = (sid?: string | null) => `careeros_booted_${sid ?? "anon"}`;

export default function BootController() {
  const { isLoaded, isSignedIn } = useUser();
  const { sessionId } = useAuth();
  const [phase, setPhase] = useState<Phase>("loading");

  const rootRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const logoFlyRef = useRef<HTMLDivElement>(null); // outer: flies to navbar
  const logoInnerRef = useRef<HTMLDivElement>(null); // inner: gentle float
  const dashRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  // Decide early whether we should skip the animation (already booted).
  const skip =
    isLoaded && isSignedIn && typeof window !== "undefined" && sessionStorage.getItem(BOOT_KEY(sessionId));

  useLayoutEffect(() => {
    if (!isLoaded || !isSignedIn) return; // wait for Clerk
    if (skip) {
      setPhase("ready");
      return;
    }
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sessionStorage.setItem(BOOT_KEY(sessionId), "1");
      setPhase("ready");
      return;
    }

    const ctx = gsap.context(() => {
      const overlay = overlayRef.current!;
      const fly = logoFlyRef.current!;
      const inner = logoInnerRef.current!;
      const dash = dashRef.current!;
      const bg = bgRef.current!;

      // --- initial states (set before paint; useLayoutEffect => no flash) ---
      gsap.set(dash, { autoAlpha: 0, scale: 1.03, filter: "blur(8px)" });
      gsap.set(bg, { autoAlpha: 0 });
      gsap.set(".db3__brand", { autoAlpha: 0 }); // hide real navbar brand
      gsap.set('[data-boot]', { autoAlpha: 0, y: 30 });

      // inner logo floats gently (decoupled from the fly transform)
      const floatTween = gsap.to(inner, {
        y: -8,
        duration: 1.8,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });

      const tl = gsap.timeline({
        defaults: { ease: "power4.out" },
        onComplete: () => {
          sessionStorage.setItem(BOOT_KEY(sessionId), "1");
          setPhase("ready");
        },
      });

      // Step 1+2: loader fade (phase swap handled in render) then logo boot-in.
      tl.fromTo(
        overlay,
        { autoAlpha: 1 },
        { autoAlpha: 1, duration: 0 }, // overlay already visible during loading
        0,
      );
      tl.fromTo(
        fly,
        { autoAlpha: 0, scale: 0.7, filter: "blur(12px)", y: 20 },
        { autoAlpha: 1, scale: 1, filter: "blur(0px)", y: 0, duration: 0.7, ease: "power4.out" },
        0.4, // 400ms after mount (loader fade)
      );

      // Step 3: pause 900ms (float continues).
      tl.to({}, { duration: 0.9 });

      // Step 4: fly logo into the navbar brand position.
      const brand = document.querySelector<HTMLElement>(".db3__brand");
      let dx = 0,
        dy = 0,
        targetScale = 0.28;
      if (brand) {
        const lr = fly.getBoundingClientRect();
        const br = brand.getBoundingClientRect();
        dx = br.left + br.width / 2 - (lr.left + lr.width / 2);
        dy = br.top + br.height / 2 - (lr.top + lr.height / 2);
        targetScale = br.width / lr.width;
      }
      tl.addLabel("fly");
      // Clean camera pull-back: kill the float and re-center the inner text so
      // the fly starts from a pristine position (no residual y from the float).
      tl.add(() => {
        floatTween.kill();
        gsap.set(inner, { y: 0 });
      }, "fly");
      tl.to(
        fly,
        { x: dx, y: dy, scale: targetScale, duration: 1.3, ease: "power4.inOut" },
        "fly",
      );

      // Step 5: dashboard fade in (blur + scale) while logo travels.
      tl.to(
        dash,
        { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.7, ease: "power3.out" },
        "fly+=0.15",
      );
      // Step 6: stagger the dashboard regions.
      tl.to(
        "[data-boot]",
        { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.08 },
        "fly+=0.35",
      );
      // Step 7: ambient background comes alive.
      tl.to(bg, { autoAlpha: 1, duration: 2, ease: "power2.out" }, "fly");

      // Step 4 (end): hand off — reveal real brand, drop overlay logo.
      tl.to(".db3__brand", { autoAlpha: 1, duration: 0.2 }, "fly+=1.2");
      tl.to(fly, { autoAlpha: 0, duration: 0.2 }, "fly+=1.2");
      tl.to(overlay, { autoAlpha: 0, duration: 0.3 }, "fly+=1.25");
    }, rootRef);

    return () => ctx.revert();
  }, [isLoaded, isSignedIn, skip, sessionId]);

  return (
    <div ref={rootRef} className="boot-root">
      {/* Dashboard lives underneath, hidden until the boot completes. */}
      <div ref={dashRef} className="boot-dash">
        <DashboardV2 />
      </div>

      {/* Ambient background layer (grid + gradient + particles). */}
      <div ref={bgRef} className="boot-ambient" aria-hidden="true">
        <div className="boot-ambient__grid" />
        <div className="boot-ambient__glow" />
        <div className="boot-ambient__particles">
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className="boot-particle" style={{ ["--i" as any]: i }} />
          ))}
        </div>
      </div>

      {/* Boot overlay: loader + centered logo. */}
      {phase !== "ready" && (
        <div ref={overlayRef} className="boot-overlay" role="status" aria-live="polite">
          {!isLoaded || !isSignedIn ? (
            <div className="boot-loader">
              <span className="boot-loader__spinner" />
              <p>Preparing your workspace…</p>
            </div>
          ) : (
            <div ref={logoFlyRef} className="boot-logo">
              <div ref={logoInnerRef} className="boot-logo__text">
                <span className="boot-logo__career">Career</span>
                <span className="boot-logo__os">OS</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
