import type { NextConfig } from "next";

/*
 * Static export for GitHub Pages.
 * DEPLOY_BASE_PATH is set only in CI (project site → "/motorsport-calendar").
 * Locally it stays unset → no basePath, dev server behaves normally.
 */
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  ...(process.env.DEPLOY_BASE_PATH
    ? { basePath: process.env.DEPLOY_BASE_PATH }
    : {}),
};

export default nextConfig;
