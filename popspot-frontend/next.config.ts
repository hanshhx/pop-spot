import type { NextConfig } from "next";
import path from "node:path";

const projectRoot = path.resolve(__dirname);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

let backendHostname = "localhost";
try {
  backendHostname = new URL(API_URL).hostname;
} catch {
  console.warn("API_URL 형식이 올바르지 않아 이미지 호스트를 localhost로 설정합니다.");
}

const nextConfig: NextConfig = {
  // 워크스페이스 루트 명시 (부모 폴더의 yarn.lock/package.json 무시)
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "k.kakaocdn.net" },
      { protocol: "https", hostname: "ssl.pstatic.net" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: backendHostname },
      { protocol: "http", hostname: backendHostname },
    ],
  },

  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
    ];
  },

  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
};

export default nextConfig;
