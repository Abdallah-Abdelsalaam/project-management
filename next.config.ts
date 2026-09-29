import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  typedRoutes: true,

  /**
   * Emits `.next/standalone` — a server with only the traced dependencies.
   *
   * Kept as the escape hatch for building somewhere other than the deploy
   * host. `next build` does **not** copy `public/` or `.next/static/` into it;
   * `docs/01-TECH-STACK.md` has the two `cp` lines that make it runnable.
   */
  output: "standalone",

  experimental: {
    // Server Actions are the write path; keep payloads small on purpose.
    serverActions: { bodySizeLimit: "2mb" },

    /**
     * One build worker, not thirty-nine.
     *
     * The app deploys to shared Hostinger hosting, where the account runs in a
     * CloudLinux container with a low process limit. Next sizes its worker pool
     * from the machine it can see — and inside the container that is the
     * *physical* host: 64 CPUs and ~39 GB free, which
     * `memoryBasedWorkersCount` turns into 39 workers. Spawning them fails at
     * the container boundary and the build dies mid-way through page-data
     * collection with
     *
     *     OS can't spawn worker thread: Resource temporarily unavailable
     *
     * Both options are needed: `memoryBasedWorkersCount: false` stops free
     * memory deciding the count, and `cpus` is the hard override that
     * `getNumberOfWorkers` honours above everything else.
     *
     * Set unconditionally rather than behind an environment check, because a
     * build setting that differs between local and deploy is how "it works on
     * my machine" happens. The cost is nil — 61 pages generate in about a
     * second with one worker.
     */
    cpus: 1,
    memoryBasedWorkersCount: false,
  },
};

export default withNextIntl(nextConfig);
