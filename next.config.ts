import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

/** Lockfile in a parent folder (e.g. ~/Desktop) makes Turbopack pick the wrong root; pin it to this app. */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
