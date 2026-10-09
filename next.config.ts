import type { NextConfig } from "next";

const NO_STORE =
  "private, no-store, no-cache, max-age=0, must-revalidate";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin"],
  async headers() {
    return [
      {
        // Everything except hashed Next build assets
        source: "/:path((?!_next/static/).*)*",
        headers: [
          { key: "Cache-Control", value: NO_STORE },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Surrogate-Control", value: "no-store" },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
