import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @annotated/shared ships raw TypeScript (src/index.ts) — let Next transpile it.
  transpilePackages: ["@annotated/shared"],
};

export default nextConfig;
