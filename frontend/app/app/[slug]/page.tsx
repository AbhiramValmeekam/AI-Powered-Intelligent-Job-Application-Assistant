import { redirect } from "next/navigation";

// The dashboard is now a single scrollable page; former per-module routes
// redirect to their section anchor so old links/bookmarks keep working.
export default async function ModuleRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/app#sec-${slug}`);
}
