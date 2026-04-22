import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Instagram CDN hosts — thumbnails come from these.
    remotePatterns: [
      { protocol: "https", hostname: "**.cdninstagram.com" },
      { protocol: "https", hostname: "**.fbcdn.net" },
      { protocol: "https", hostname: "scontent.cdninstagram.com" },
    ],
  },
};

export default nextConfig;
