import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 640, 768, 1024, 1280, 1536, 1920, 2048, 2560, 3840],
    imageSizes: [16, 24, 32, 48, 64, 96, 128, 256],
    qualities: [60, 75, 85, 90, 95],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "commons.wikimedia.org",
      },
    ],
  },
  serverExternalPackages: ["pdfmake"],
};

export default nextConfig;
