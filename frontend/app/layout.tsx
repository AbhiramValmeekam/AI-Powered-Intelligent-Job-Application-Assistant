import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const themeBootScript = `
  (() => {
    try {
      const stored = localStorage.getItem('careeros-theme');
      const preferred = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      document.documentElement.dataset.theme = stored === 'light' || stored === 'dark' ? stored : preferred;
    } catch (_) {
      document.documentElement.dataset.theme = 'dark';
    }
  })();
`;

export const metadata: Metadata = {
  title: "CareerOS — Beyond the CV",
  description:
    "CareerOS reads your resume like a recruiter, explains the gaps like a teacher, and prepares truthful applications around the direction you choose.",
  applicationName: "CareerOS",
  icons: { icon: "/favicon.svg" },
  authors: [{ name: "CareerOS" }],
  keywords: [
    "resume analysis",
    "job matching",
    "tailored resume",
    "career guidance",
    "job application assistant",
    "scam shield",
  ],
  openGraph: {
    title: "CareerOS — Beyond the CV",
    description:
      "From the resume you have to the opportunities it can reach—without changing the facts.",
    type: "website",
    siteName: "CareerOS",
  },
  twitter: {
    card: "summary",
    title: "CareerOS — Beyond the CV",
    description:
      "Read like a recruiter. Explained like a teacher. Moved forward with you in control.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e1211" },
    { media: "(prefers-color-scheme: light)", color: "#f2efe6" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <noscript>
          <style>{`.loader { display: none !important; }`}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
