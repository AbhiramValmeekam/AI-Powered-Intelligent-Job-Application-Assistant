import { AppNav } from "@/components/AppNav";
import { AppMotion } from "@/components/AppMotion";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <AppNav />
      <AppMotion>
        <main className="app-main">{children}</main>
      </AppMotion>
    </div>
  );
}
