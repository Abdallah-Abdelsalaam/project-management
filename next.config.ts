import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  typedRoutes: true,
  /**
   * Emits `.next/standalone` — a self-contained server with only the
   * dependencies it actually uses traced into it.
   *
   * This exists because the app is deployed to shared Hostinger hosting, where
   * building on the host is unreliable: Turbopack spawns worker processes for
   * the PostCSS transform and the plan's process and memory caps kill them
   * ("node process exited before we could connect to it"). Standalone lets the
   * build happen anywhere and only the output be shipped, so the host never
   * needs a toolchain or a `node_modules` install at all.
   *
   * Additive — the normal `.next` output and `next start` are unaffected.
   */
  output: "standalone",
  experimental: {
    // Server Actions are the write path; keep payloads small on purpose.
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default withNextIntl(nextConfig);
