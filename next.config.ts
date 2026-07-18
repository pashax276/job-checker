import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker runner stage.
  output: "standalone",
  // No next/image usage — keeps sharp's ~33MB of platform binaries out of the image.
  images: { unoptimized: true },
};

export default nextConfig;
