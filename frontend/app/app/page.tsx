import BootController from "@/components/BootController";

// /app uses Clerk client hooks (useUser/useClerk). Force dynamic rendering so it
// is NOT statically prerendered at build time (prerender fails: "useUser can only
// be used within <ClerkProvider />"). Rendering per-request keeps Clerk context live.
export const dynamic = "force-dynamic";

export default function AppHome() {
  return <BootController />;
}
