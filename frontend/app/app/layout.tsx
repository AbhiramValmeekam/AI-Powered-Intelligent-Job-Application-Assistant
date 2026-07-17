import { AppMotion } from "@/components/AppMotion";
import { OnboardingGate } from "@/components/OnboardingGate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppMotion>
      {children}
      <OnboardingGate />
    </AppMotion>
  );
}
