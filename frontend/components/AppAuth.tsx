"use client";

import Link from "next/link";
import { useAuth, UserButton } from "@clerk/nextjs";

// Renders Clerk auth controls in the sidebar, but only when Clerk is
// configured — otherwise nothing (app runs keyless during local dev).
const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function AppAuth() {
  if (!clerkEnabled) return null;
  return <AppAuthInner />;
}

function AppAuthInner() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  return (
    <div className="app-nav__auth">
      {isSignedIn ? (
        <>
          <UserButton />
          <span className="app-nav__auth-label">Account</span>
        </>
      ) : (
        <Link href="/sign-in" className="app-nav__auth-link">Sign in</Link>
      )}
    </div>
  );
}
