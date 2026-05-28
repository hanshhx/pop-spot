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
    /**
     * v2.17.3 — CSP 화이트리스트 보강.
     *
     * <p>v2.17 의 초기 CSP 가 너무 strict 해서 운영에서 실제 사용 중인 두 호스트가 차단됐다:
     *
     * <ul>
     *   <li>{@code cdn.jsdelivr.net} — Pretendard 폰트 (style-src + font-src)
     *   <li>{@code *.ts.net} — Tailscale Funnel 운영 백엔드 도메인 (connect-src)
     * </ul>
     *
     * <p>그 외 외부 OAuth / Kakao Map SDK / Algolia / YouTube / Spotify embed 는 v2.17 그대로.
     */
    const csp = [
      "default-src 'self'",
      // v2.21-S8 — script-src 에 YouTube IFrame API (www.youtube.com + s.ytimg.com) 추가.
      // 이전엔 frame-src 에만 있어 IFrame embed 는 가능했지만 iframe_api.js 자체가 CSP 에
      // 막혀서 useYouTubePlayer 가 player 인스턴스를 생성 못함 → 검은 화면. 음악 재생
      // "수두룩한 실패" 의 진짜 원인. v2.17 CSP 도입 시 누락된 도메인.
      // v2.21-S14 — script-src 에 Spotify Web Playback SDK (sdk.scdn.co) 추가.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://dapi.kakao.com https://t1.daumcdn.net https://www.googletagmanager.com https://*.algolia.net https://*.algolianet.com https://www.youtube.com https://s.ytimg.com https://sdk.scdn.co",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
      "img-src 'self' data: blob: https: http:",
      // v2.21-S14 — media-src 에 Spotify preview CDN (p.scdn.co — preview mp3 호스트).
      "media-src 'self' blob: https: https://p.scdn.co https://*.scdn.co",
      "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
      // v2.21-S8/S14 — connect-src 에 YouTube + Spotify API / SDK / CDN 추가.
      // api.spotify.com (Web API play call), *.spotify.com (SDK websocket), *.scdn.co (CDN).
      "connect-src 'self' https://*.algolia.net https://*.algolianet.com https://dapi.kakao.com https://accounts.kakao.com https://accounts.google.com https://nid.naver.com https://*.ts.net https://www.youtube.com https://s.ytimg.com https://api.spotify.com https://*.spotify.com https://*.scdn.co wss://*.spotify.com wss: ws:",
      // v2.21-S14 — frame-src / media: Spotify SDK iframe (sdk.scdn.co) + open.spotify.com.
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://open.spotify.com https://sdk.scdn.co https://accounts.kakao.com",
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
