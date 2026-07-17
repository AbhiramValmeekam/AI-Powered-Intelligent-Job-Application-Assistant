import Link from "next/link";
import { MODULES } from "@/lib/nav";

export default function AppHome() {
  return (
    <div className="cc-home">
      <p className="section-label">COMMAND CENTER</p>
      <h1 className="cc-home__title">Your career, in one place.</h1>
      <p className="cc-home__copy">
        Every tool wired to your backend — pick a module to begin.
      </p>
      <div className="cc-home__grid">
        {MODULES.map((m) => (
          <Link key={m.slug} href={`/app/${m.slug}`} className="cc-card">
            <span className="cc-card__idx">{m.index}</span>
            <span className="cc-card__title">{m.title}</span>
            <span className="cc-card__eyebrow">{m.eyebrow}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
