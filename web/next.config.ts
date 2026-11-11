import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

/**
 * Production is a static export under /ui/ that pulp-nextui serves, on the same origin as
 * Pulp: the browser's Pulp session cookie goes with every API call. `next dev` has no such
 * origin, so it forwards the API and /ui/config.json to the server named by PULP_DEV (see the
 * README).
 */
const developmentBackend = process.env.PULP_DEV ?? "http://127.0.0.1:8080";

const nextConfig = (phase: string): NextConfig => ({
  basePath: "/ui",
  trailingSlash: true,
  ...(phase === PHASE_DEVELOPMENT_SERVER
    ? {
        agentRules: false,
        rewrites: async () => [
          { source: "/pulp/api/v3/:path*", destination: `${developmentBackend}/pulp/api/v3/:path*`, basePath: false },
          { source: "/config.json", destination: `${developmentBackend}/ui/config.json` },
        ],
      }
    : { output: "export", images: { unoptimized: true } }),
});

export default nextConfig;
