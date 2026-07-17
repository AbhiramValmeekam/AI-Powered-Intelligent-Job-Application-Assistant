import { CinematicLanding } from "@/components/CinematicLanding";

export default function HomePage() {
  const getStartedHref =
    process.env.NEXT_PUBLIC_GET_STARTED_URL?.trim() || "/get-started";

  return <CinematicLanding getStartedHref={getStartedHref} />;
}
