"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULES, ModuleDef } from "@/lib/nav";
import { AppAuth } from "@/components/AppAuth";

export function AppNav() {
  const pathname = usePathname();
  return (
    <aside className="app-nav" data-lenis-prevent>
      <div className="app-nav__brand">
        <Link href="/">CAREER OS</Link>
        <span className="app-nav__kicker">COMMAND CENTER</span>
      </div>
      <nav className="app-nav__list">
        {MODULES.map((m) => {
          const href = `/app/${m.slug}`;
          const active = pathname === href;
          return (
            <Link
              key={m.slug}
              href={href}
              className={`app-nav__item${active ? " is-active" : ""}`}
            >
              <span className="app-nav__idx">{m.index}</span>
              <span className="app-nav__txt">
                <span className="app-nav__title">{m.title}</span>
                <span className="app-nav__eyebrow">{m.eyebrow}</span>
              </span>
            </Link>
          );
        })}
      </nav>
      <AppAuth />
    </aside>
  );
}
