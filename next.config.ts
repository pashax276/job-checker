import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker runner stage.
  output: "standalone",
  // No next/image usage — keeps sharp's ~33MB of platform binaries out of the image.
  images: { unoptimized: true },
  // Document parsers must stay as runtime node_modules — bundling drops
  // their runtime assets and the standalone tracer loses them entirely.
  // pdfjs-dist must ship whole: its worker is imported dynamically at
  // runtime, invisible to the standalone tracer.
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "mammoth",
    "@napi-rs/canvas",
    "better-sqlite3",
  ],
};

export default nextConfig;
