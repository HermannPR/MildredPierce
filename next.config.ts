import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            // blob: required by Spline's Web Worker bootstrap
            value: [
              "default-src 'self'",
              "script-src 'self' blob: 'wasm-unsafe-eval' 'inline-speculation-rules'",
              "worker-src blob:",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self' prod.spline.design blob:",
              "media-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
