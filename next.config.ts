import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["desktop-dp248g4.tail809f67.ts.net"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
