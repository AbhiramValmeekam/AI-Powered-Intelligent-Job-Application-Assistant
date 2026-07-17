"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { profiles } from "@/lib/api";
import { Onboarding } from "@/components/Onboarding";

// Shows the onboarding wizard exactly once: when a signed-in user has no
// stored master profile yet. Mounted inside the authenticated app shell.
export function OnboardingGate() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) {
      setChecked(true);
      return;
    }
    const email = user.primaryEmailAddress?.emailAddress || "";
    if (!email) {
      setChecked(true);
      return;
    }
    let cancelled = false;
    profiles
      .get(email)
      .then(() => {
        if (!cancelled) {
          setShow(false);
          setChecked(true);
        }
      })
      .catch((e) => {
        // 404 => no profile yet => onboard
        if (!cancelled && (e?.status === 404 || /not found/i.test(String(e?.message || "")))) {
          setShow(true);
        }
        setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, user]);

  if (!checked || !isSignedIn || !show) return null;
  return <Onboarding onDone={() => setShow(false)} />;
}
