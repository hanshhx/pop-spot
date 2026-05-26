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

  /**
   * v2.17 — 보안 헤더 (CSP / X-Frame-Options / Referrer-Policy / Permissions-Policy).
   *
   * <p>CSP 는 외부 OAuth (구글/카카오/네이버) + Kakao Map SDK + Algolia + Spotify embed +
   * YouTube IFrame 등 운영 중인 외부 리소스를 화이트리스트로 둔다. Next.js + React 의 inline
   * script 호환을 위해 'unsafe-inline' + 'unsafe-eval' 은 script-src 에 한해 임시 허용.
   * 추후 nonce 적용으로 강화 가능.
   */
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://dapi.kakao.com https://t1.daumcdn.net https://www.googletagmanager.com https://*.algolia.net https://*.algolianet.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https: http:",
      "media-src 'self' blob: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.algolia.net https://*.algolianet.com https://dapi.kakao.com https://accounts.kakao.com https://accounts.google.com https://nid.naver.com wss: ws:",
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://open.spotify.com https://accounts.kakao.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "geolocation=(self), microphone=(), camera=(), payment=()",
          },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
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
