"use client";

import { useEffect, useRef, useState } from "react";
import {
  boundaryChecks,
  matchRoutes,
  navigation,
  operatingPrinciples,
  resumeSignals,
} from "@/lib/content";

type CinematicLandingProps = {
  getStartedHref: string;
};

const padProgress = (value: number) => String(value).padStart(3, "0");

export function CinematicLanding({ getStartedHref }: CinematicLandingProps) {
  const mainRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const loaderStatusRef = useRef<HTMLOutputElement>(null);
  const loaderLineRef = useRef<HTMLSpanElement>(null);
  const [activeScene, setActiveScene] = useState("00");
  const [loaderComplete, setLoaderComplete] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion) {
      return;
    }

    const duration = 920;
    const startedAt = performance.now();
    let animationFrame = 0;
    let completionTimer = 0;

    const updateLoader = (time: number) => {
      const elapsed = Math.min((time - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - elapsed, 4);
      const progress = Math.round(eased * 100);

      if (loaderStatusRef.current) {
        loaderStatusRef.current.textContent = `CALIBRATING ${padProgress(progress)}%`;
      }
      loaderLineRef.current?.style.setProperty(
        "transform",
        `scaleX(${progress / 100})`,
      );

      if (elapsed < 1) {
        animationFrame = requestAnimationFrame(updateLoader);
        return;
      }

      completionTimer = window.setTimeout(() => setLoaderComplete(true), 220);
    };

    animationFrame = requestAnimationFrame(updateLoader);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.clearTimeout(completionTimer);
    };
  }, []);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    const scenes = Array.from(
      main.querySelectorAll<HTMLElement>("[data-scene]"),
    );

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              Math.abs(a.boundingClientRect.top) -
              Math.abs(b.boundingClientRect.top),
          );

        const scene = visible[0]?.target as HTMLElement | undefined;
        if (scene?.dataset.scene) setActiveScene(scene.dataset.scene);
      },
      { rootMargin: "-46% 0px -46% 0px", threshold: 0 },
    );

    scenes.forEach((scene) => observer.observe(scene));

    let frame = 0;
    const updateProgress = () => {
      frame = 0;
      const maxScroll = Math.max(main.scrollHeight - window.innerHeight, 1);
      const mainTop = main.getBoundingClientRect().top + window.scrollY;
      const progress = Math.min(
        Math.max((window.scrollY - mainTop) / maxScroll, 0),
        1,
      );
      progressRef.current?.style.setProperty(
        "transform",
        `scaleY(${progress})`,
      );
    };

    const handleScroll = () => {
      if (!frame) frame = requestAnimationFrame(updateProgress);
    };

    updateProgress();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    let cancelled = false;
    let dispose = () => undefined;

    const initializeMotion = async () => {
      await document.fonts?.ready;

      const [{ gsap }, { ScrollTrigger }, { default: Lenis }] =
        await Promise.all([
          import("gsap"),
          import("gsap/ScrollTrigger"),
          import("lenis"),
        ]);

      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger);
      const media = gsap.matchMedia();

      const context = gsap.context(() => {
        media.add(
          {
            desktop: "(min-width: 769px)",
            mobile: "(max-width: 768px)",
            reduced: "(prefers-reduced-motion: reduce)",
            smooth:
              "(pointer: fine) and (prefers-reduced-motion: no-preference)",
          },
          (mediaContext) => {
            const conditions = mediaContext.conditions as {
              desktop: boolean;
              mobile: boolean;
              reduced: boolean;
              smooth: boolean;
            };

            if (conditions.reduced) return;

            let destroySmoothScroll = () => undefined;

            if (conditions.smooth) {
              const lenis = new Lenis({
                duration: 1.05,
                easing: (time: number) =>
                  Math.min(1, 1.001 - Math.pow(2, -10 * time)),
                smoothWheel: true,
                syncTouch: false,
                wheelMultiplier: 0.88,
                touchMultiplier: 1,
              });
              const updateScrollTrigger = () => ScrollTrigger.update();
              const tick = (time: number) => lenis.raf(time * 1000);

              lenis.on("scroll", updateScrollTrigger);
              gsap.ticker.add(tick);

              destroySmoothScroll = () => {
                gsap.ticker.remove(tick);
                lenis.destroy();
              };
            }

            const makePinnedTimeline = (
              sceneSelector: string,
              scrub = 0.85,
            ) => {
              const scene = main.querySelector<HTMLElement>(sceneSelector);
              const stage = scene?.querySelector<HTMLElement>(".scene__stage");
              if (!scene || !stage) return null;

              return gsap.timeline({
                defaults: { ease: "none" },
                scrollTrigger: {
                  trigger: scene,
                  start: "top top",
                  end: "bottom bottom",
                  scrub,
                  pin: stage,
                  pinSpacing: false,
                  anticipatePin: 1,
                  invalidateOnRefresh: true,
                },
              });
            };

            if (conditions.desktop) {
              const heroTimeline = makePinnedTimeline(".scene--hero", 0.95);
              heroTimeline
                ?.to(
                  ".hero__word--hero",
                  { xPercent: -54, autoAlpha: 0.16, scale: 0.84 },
                  0,
                )
                .to(
                  ".hero__word--cv",
                  {
                    scale: 7.8,
                    xPercent: -7,
                    yPercent: 8,
                    transformOrigin: "54% 54%",
                  },
                  0,
                )
                .to(
                  ".hero__resume-sheet",
                  { xPercent: 42, scale: 1.42, rotation: 0 },
                  0,
                )
                .to(
                  ".hero__intro, .hero__meta, .hero__scroll-cue",
                  { autoAlpha: 0, yPercent: -28 },
                  0,
                )
                .to(".hero__portal-line", { scaleX: 1 }, 0.08);

              const readTimeline = makePinnedTimeline(".scene--read", 0.8);
              readTimeline
                ?.fromTo(
                  ".read__document",
                  { clipPath: "inset(12% 38% 12% 38%)", scale: 1.36 },
                  { clipPath: "inset(0% 0% 0% 0%)", scale: 1 },
                  0,
                )
                .from(
                  ".read__headline-line",
                  { yPercent: 112, stagger: 0.08 },
                  0.05,
                )
                .fromTo(
                  ".read__scan",
                  { xPercent: -110 },
                  { xPercent: 110 },
                  0,
                )
                .from(
                  ".read__signal",
                  { xPercent: -16, autoAlpha: 0, stagger: 0.1 },
                  0.18,
                )
                .from(
                  ".read__teacher",
                  { yPercent: 55, autoAlpha: 0 },
                  0.48,
                );

              const matchTimeline = makePinnedTimeline(".scene--match", 0.92);
              const matchTrack =
                main.querySelector<HTMLElement>(".match__track");
              if (matchTimeline && matchTrack) {
                matchTimeline
                  .fromTo(
                    ".match__route-line",
                    { scaleX: 0 },
                    { scaleX: 1 },
                    0,
                  )
                  .to(
                    matchTrack,
                    {
                      x: () =>
                        -Math.max(
                          matchTrack.scrollWidth - window.innerWidth + 48,
                          0,
                        ),
                    },
                    0,
                  )
                  .to(
                    ".match__counter-word",
                    { letterSpacing: "0.02em", scale: 0.72 },
                    0,
                  );
              }

              const principlesTimeline = makePinnedTimeline(
                ".scene--principles",
                0.88,
              );
              const principles = gsap.utils.toArray<HTMLElement>(
                ".principle",
                main,
              );

              if (principlesTimeline && principles.length) {
                gsap.set(principles.slice(1), {
                  yPercent: 100,
                  autoAlpha: 0,
                });

                principles.slice(1).forEach((principle, index) => {
                  const previous = principles[index];
                  principlesTimeline
                    .to(
                      previous,
                      { yPercent: -74, autoAlpha: 0, duration: 0.8 },
                      index,
                    )
                    .fromTo(
                      principle,
                      { yPercent: 100, autoAlpha: 0 },
                      { yPercent: 0, autoAlpha: 1, duration: 0.8 },
                      index,
                    )
                    .to(
                      ".principles__meter-fill",
                      {
                        scaleY: (index + 1) / (principles.length - 1),
                        duration: 0.8,
                      },
                      index,
                    );
                });
              }

              const boundaryTimeline = makePinnedTimeline(".scene--move", 0.8);
              boundaryTimeline
                ?.from(
                  ".boundary__row",
                  { xPercent: -18, autoAlpha: 0.22, stagger: 0.13 },
                  0,
                )
                .fromTo(
                  ".boundary__gate",
                  { scaleX: 0 },
                  { scaleX: 1 },
                  0.1,
                )
                .from(
                  ".boundary__statement-word",
                  { yPercent: 108, stagger: 0.08 },
                  0.34,
                );

              const climaxTimeline = makePinnedTimeline(
                ".scene--climax",
                0.95,
              );
              climaxTimeline
                ?.fromTo(
                  ".climax__statement",
                  { scale: 3.6, xPercent: 22, transformOrigin: "50% 50%" },
                  { scale: 1, xPercent: 0 },
                  0,
                )
                .fromTo(
                  ".climax__cv",
                  { scale: 1.8, autoAlpha: 0.48 },
                  { scale: 0.62, autoAlpha: 0.12 },
                  0,
                )
                .to(".climax__rule", { scaleX: 1 }, 0.14);

              const finalTimeline = makePinnedTimeline(".scene--final", 0.72);
              finalTimeline
                ?.from(
                  ".final__eyebrow, .final__title-line, .final__copy, .final__action",
                  { yPercent: 42, autoAlpha: 0, stagger: 0.08 },
                  0,
                )
                .fromTo(
                  ".final__crop",
                  { yPercent: 58 },
                  { yPercent: 14 },
                  0,
                );
            }

            if (conditions.mobile) {
              const mobileScenes = [
                [".scene--hero", ".hero__intro, .hero__title, .hero__meta"],
                [".scene--read", ".read__headline, .read__signal, .read__teacher"],
                [".scene--match", ".match__intro, .match__stop"],
                [".scene--principles", ".principle"],
                [".scene--move", ".boundary__row, .boundary__statement"],
                [".scene--climax", ".climax__statement"],
                [".scene--final", ".final__content"],
              ] as const;

              mobileScenes.forEach(([sceneSelector, targets]) => {
                const scene = main.querySelector<HTMLElement>(sceneSelector);
                if (!scene) return;

                gsap
                  .timeline({
                    defaults: { ease: "none" },
                    scrollTrigger: {
                      trigger: scene,
                      start: "top 86%",
                      end: "bottom 34%",
                      scrub: 0.65,
                      invalidateOnRefresh: true,
                    },
                  })
                  .from(targets, {
                    y: 54,
                    autoAlpha: 0.28,
                    stagger: 0.07,
                  });
              });
            }

            const refreshFrame = requestAnimationFrame(() =>
              ScrollTrigger.refresh(),
            );

            return () => {
              cancelAnimationFrame(refreshFrame);
              destroySmoothScroll();
            };
          },
        );
      }, main);

      dispose = () => {
        media.revert();
        context.revert();
      };
    };

    void initializeMotion();

    return () => {
      cancelled = true;
      dispose();
    };
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    const nextTheme = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = nextTheme;
    root.style.colorScheme = nextTheme;

    try {
      localStorage.setItem("careeros-theme", nextTheme);
    } catch {
      // The selected theme still applies when storage is unavailable.
    }
  };

  return (
    <div className="landing-shell" data-active-scene={activeScene}>
      <a className="skip-link" href="#main-content">
        Skip to the story
      </a>

      <div
        className="loader"
        data-complete={loaderComplete ? "true" : "false"}
        aria-hidden="true"
      >
        <div className="loader__topline">
          <span>CAREEROS / FIELD NOTE 00</span>
          <span>BEYOND THE CV</span>
        </div>
        <div className="loader__mark" aria-hidden="true">
          <span>CAREER</span>
          <span>OS</span>
        </div>
        <output ref={loaderStatusRef} className="loader__status">
          CALIBRATING 000%
        </output>
        <span ref={loaderLineRef} className="loader__line" />
      </div>

      <header className="site-nav">
        <a className="wordmark" href="#top" aria-label="CareerOS, back to top">
          <span>CAREER</span>
          <span className="wordmark__cv">OS</span>
        </a>

        <nav className="site-nav__chapters" aria-label="Story chapters">
          {navigation.map((item) => (
            <a
              href={item.href}
              key={item.href}
              aria-current={activeScene === item.index ? "location" : undefined}
            >
              <span>{item.index}</span>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="site-nav__actions">
          <button
            className="theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle light and dark theme"
          >
            <span className="theme-toggle__light" aria-hidden="true">
              LIGHT
            </span>
            <span className="theme-toggle__dark" aria-hidden="true">
              DARK
            </span>
          </button>
          <a className="nav-cta" href={getStartedHref}>
            Start <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      <div className="story-progress" aria-hidden="true">
        <span className="story-progress__label">00</span>
        <span className="story-progress__track">
          <span ref={progressRef} className="story-progress__fill" />
        </span>
        <span className="story-progress__label">06</span>
      </div>

      <div className="scene-indicator" aria-hidden="true">
        <span>{activeScene}</span>
        <span> / 06</span>
      </div>

      <main id="main-content" ref={mainRef}>
        <section
          className="scene scene--hero"
          id="top"
          data-scene="00"
          aria-labelledby="hero-title"
        >
          <div className="scene__stage hero__stage">
            <div className="scene__coordinate scene__coordinate--top">
              <span>PUBLIC RELEASE / 01</span>
              <span>CAREER SYSTEM / GLOBAL</span>
            </div>

            <div className="hero__intro">
              <p className="eyebrow">The resume is only the beginning.</p>
              <p className="hero__intro-copy">
                One document becomes a clearer profile, a wider search, and a
                deliberate next move.
              </p>
            </div>

            <h1 className="hero__title" id="hero-title">
              <span className="hero__word hero__word--hero">CAREER</span>
              <span className="hero__word hero__word--cv">OS</span>
            </h1>

            <div className="hero__resume-sheet" aria-hidden="true">
              <div className="resume-sheet__head">
                <span>YOUR NAME</span>
                <span>01 / SOURCE</span>
              </div>
              <span className="resume-sheet__rule resume-sheet__rule--wide" />
              <span className="resume-sheet__rule" />
              <span className="resume-sheet__rule resume-sheet__rule--short" />
              <span className="resume-sheet__label">EXPERIENCE</span>
              <span className="resume-sheet__rule resume-sheet__rule--wide" />
              <span className="resume-sheet__rule" />
              <span className="resume-sheet__label">SKILLS / EVIDENCE</span>
              <span className="resume-sheet__rule resume-sheet__rule--short" />
            </div>

            <div className="hero__meta">
              <span>READ LIKE A RECRUITER</span>
              <span>EXPLAINED LIKE A TEACHER</span>
              <span>MOVED WITH YOU IN CONTROL</span>
            </div>

            <div className="hero__descriptor" aria-hidden="true">
              <span>BEYOND</span>
              <span>THE CV.</span>
            </div>

            <a className="hero__scroll-cue" href="#read">
              <span>Scroll to move beyond</span>
              <span aria-hidden="true">↓</span>
            </a>
            <span className="hero__portal-line" aria-hidden="true" />
          </div>
        </section>

        <section
          className="scene scene--read"
          id="read"
          data-scene="01"
          aria-labelledby="read-title"
        >
          <div className="scene__stage read__stage">
            <div className="read__document" aria-hidden="true">
              <span className="read__document-index">CV / 01</span>
              <div className="read__scan" />
              {resumeSignals.map((signal) => (
                <div className="read__signal" key={signal.code}>
                  <span>{signal.code}</span>
                  <span>{signal.label}</span>
                  <strong>{signal.value}</strong>
                </div>
              ))}
            </div>

            <div className="read__content">
              <p className="section-label">01 / UNDERSTAND</p>
              <h2 className="read__headline" id="read-title">
                <span className="headline-clip">
                  <span className="read__headline-line">READ LIKE</span>
                </span>
                <span className="headline-clip">
                  <span className="read__headline-line">A RECRUITER.</span>
                </span>
              </h2>
              <p className="read__copy">
                See what is present, what is unclear, and what the role is
                actually asking for. Every conclusion stays linked to evidence
                in your CV.
              </p>
            </div>

            <div className="read__teacher">
              <span className="read__teacher-index">THEN / 02</span>
              <p>EXPLAIN IT LIKE A TEACHER.</p>
              <span>
                Specific feedback. Nearby skills. A practical way to improve.
              </span>
            </div>
          </div>
        </section>

        <section
          className="scene scene--match"
          id="match"
          data-scene="02"
          aria-labelledby="match-title"
        >
          <div className="scene__stage match__stage">
            <div className="match__intro">
              <p className="section-label">02 / DISCOVER</p>
              <h2 id="match-title">
                ONE PROFILE.
                <br />
                MORE THAN ONE DIRECTION.
              </h2>
              <p>
                Search across remote, on-site, hybrid, and relocation paths.
                Relevance comes before volume.
              </p>
            </div>

            <div
              className="match__track"
              role="group"
              aria-label="Illustrative opportunity directions"
            >
              <div className="match__origin">
                <span className="match__counter-word">CV</span>
                <span>THE SOURCE</span>
              </div>
              {matchRoutes.map((route, index) => (
                <article className="match__stop" key={route.place}>
                  <span className="match__stop-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p>{route.place}</p>
                  <h3>{route.role}</h3>
                  <span>{route.fit}</span>
                </article>
              ))}
              <div className="match__destination">
                <span>ROLE</span>
                <strong>FIT, WITH CONTEXT.</strong>
              </div>
              <span className="match__route-line" aria-hidden="true" />
            </div>

            <div className="match__footerline">
              <span>WORLDWIDE DISCOVERY</span>
              <span>ELIGIBILITY BEFORE ACTION</span>
              <span>YOU SET THE DIRECTION</span>
            </div>
          </div>
        </section>

        <section
          className="scene scene--principles"
          id="tailor"
          data-scene="03"
          aria-labelledby="principles-title"
        >
          <div className="scene__stage principles__stage">
            <div className="principles__header">
              <p className="section-label">03 / THE OPERATING SYSTEM</p>
              <h2 id="principles-title" className="sr-only">
                How CareerOS works
              </h2>
              <span>ONE SOURCE / FOUR MOVEMENTS</span>
            </div>

            <div className="principles__stack">
              {operatingPrinciples.map((principle) => (
                <article className="principle" key={principle.number}>
                  <span className="principle__number">{principle.number}</span>
                  <h3>{principle.verb}</h3>
                  <div className="principle__copy">
                    <p>{principle.statement}</p>
                    <span>{principle.detail}</span>
                  </div>
                </article>
              ))}
            </div>

            <div className="principles__source" aria-hidden="true">
              <div>
                <span>SOURCE CV</span>
                <strong>FACT 01</strong>
                <strong>FACT 02</strong>
                <strong>FACT 03</strong>
              </div>
              <span className="principles__source-arrow">→</span>
              <div>
                <span>ROLE VERSION</span>
                <strong>SAME EVIDENCE</strong>
                <strong>NEW ORDER</strong>
                <strong>CLEARER EMPHASIS</strong>
              </div>
            </div>

            <div className="principles__meter" aria-hidden="true">
              <span className="principles__meter-fill" />
            </div>
          </div>
        </section>

        <section
          className="scene scene--move"
          id="move"
          data-scene="04"
          aria-labelledby="move-title"
        >
          <div className="scene__stage boundary__stage">
            <div className="boundary__header">
              <p className="section-label">04 / CONTROL</p>
              <h2 id="move-title">BEFORE ANYTHING MOVES.</h2>
              <p>
                Autonomous does not mean unchecked. The system stops when a
                required answer, permission, or eligibility condition is
                unknown.
              </p>
            </div>

            <div className="boundary__checks">
              {boundaryChecks.map(([label, status], index) => (
                <div className="boundary__row" key={label}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{label}</strong>
                  <span>{status}</span>
                </div>
              ))}
              <span className="boundary__gate" aria-hidden="true" />
            </div>

            <div className="boundary__statement">
              <span className="headline-clip">
                <span className="boundary__statement-word">UNKNOWN</span>
              </span>
              <span className="headline-clip">
                <span className="boundary__statement-word">IS NOT YES.</span>
              </span>
            </div>
          </div>
        </section>

        <section
          className="scene scene--climax"
          data-scene="05"
          aria-labelledby="climax-title"
        >
          <div className="scene__stage climax__stage">
            <div className="climax__cv" aria-hidden="true">
              CV
            </div>
            <p className="climax__label">FROM DOCUMENT / TO DIRECTION</p>
            <h2 className="climax__statement" id="climax-title">
              <span>YOUR CV.</span>
              <span>NO LONGER</span>
              <span>STANDING STILL.</span>
            </h2>
            <span className="climax__rule" aria-hidden="true" />
            <p className="climax__footnote">
              Prepared around your evidence. Moved around your choices.
            </p>
          </div>
        </section>

        <section
          className="scene scene--final"
          data-scene="06"
          aria-labelledby="final-title"
        >
          <div className="scene__stage final__stage">
            <div className="final__content">
              <p className="final__eyebrow">CareerOS / Your next move</p>
              <h2 className="final__title" id="final-title">
                <span className="final__title-line">BEYOND</span>
                <span className="final__title-line">THE CV.</span>
              </h2>
              <p className="final__copy">
                Start with the resume you have. See what it says, what it can
                become, and where it can take you next.
              </p>
              <div className="final__action">
                <a className="primary-cta" href={getStartedHref}>
                  <span>Start with your resume</span>
                  <span aria-hidden="true">↗</span>
                </a>
                <span>One source. No invented evidence.</span>
              </div>
            </div>

            <div className="final__crop" aria-hidden="true">
              CV
            </div>

            <footer className="site-footer">
              <a href="#top">CAREER OS / 2026</a>
              <span>GLOBAL BY DESIGN</span>
              <span>EVIDENCE BOUND</span>
              <span>CANDIDATE CONTROL</span>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}
