import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Pin Turbopack's root to this project so it doesn't infer C:\Users\ABHIRAM
  // (which has a stray package-lock.json) as the workspace root — that mis-resolution
  // was causing GSAP chunk load failures in dev.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
