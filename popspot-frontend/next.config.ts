import type { NextConfig } from 'next';
import path from 'node:path';

const projectRoot = path.resolve(__dirname);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

let backendHostname = 'localhost';
let backendOrigin = 'http://localhost:8080';
let backendWsOrigin = 'ws://localhost:8080';
try {
  const backendUrl = new URL(API_URL);
  backendHostname = backendUrl.hostname;
  backendOrigin = backendUrl.origin;
  backendWsOrigin = `${backendUrl.protocol === 'https:' ? 'wss:' : 'ws:'}//${backendUrl.host}`;
} catch {
  console.warn('API_URL 형식이 올바르지 않아 이미지 호스트를 localhost로 설정합니다.');
}

const nextConfig: NextConfig = {
  // 워크스페이스 루트 명시 (부모 폴더의 yarn.lock/package.json 무시)
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,

  images: {
    /**
     * v2.41 — remotePatterns 에 경로 제한을 건다.
     *
     * <p>이전엔 호스트만 열어 둬서(pathname 생략 = 사실상 {@code '**'}) 우리 DB 에 없는 임의의
     * 스톡 사진까지 전부 /_next/image 로 변환됐다. 실측: 코드에 존재하지 않는 사진이 200 으로
     * 변환됐고, 같은 사진에 쿼리 한 글자만 바꾸면 매번 새 변환이 생성됐다 — 외부인이 스크립트
     * 한 줄로 Vercel 이미지 변환 쿼터·대역폭을 무한히 태울 수 있는 구조였다.
     *
     * <p>팝업 이미지 1,174건(pexels 789 / unsplash 385)이 두 호스트를 실제로 쓰므로 호스트를
     * 지우면 안 된다. 대신 실제 URL 형태만 남긴다 — Pexels 는
     * {@code /photos/<id>/pexels-photo-<id>.jpeg}, Unsplash 는 {@code /photo-<id>}
     * (유료 사진은 {@code /premium_photo-<id>}).
     */
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/photo-*' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/premium_photo-*' },
      { protocol: 'https', hostname: 'images.pexels.com', pathname: '/photos/**' },
      // localhost 는 개발 백엔드가 서빙하는 업로드 이미지 전용이라 운영 번들엔 있을 이유가 없다.
      // (운영 백엔드는 아래 backendHostname 항목이 이미 커버한다.)
      ...(process.env.NODE_ENV === 'production'
        ? []
        : [{ protocol: 'http' as const, hostname: 'localhost' }]),
      { protocol: 'https', hostname: 'k.kakaocdn.net' },
      { protocol: 'https', hostname: 'ssl.pstatic.net' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: backendHostname },
      { protocol: 'http', hostname: backendHostname },
    ],
  },

  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },

  async redirects() {
    return [
      {
        // 네이버에 예전 /intro 주소가 아직 노출되고 있다. 없는 페이지로 버리지 않고 현재 소개 문서로
        // 영구 이전해 기존 검색 신호와 방문자를 /about 으로 모은다.
        source: '/intro',
        destination: '/about',
        permanent: true,
      },
    ];
  },

  /**
   * v2.17 — 보안 헤더 (CSP / X-Frame-Options / Referrer-Policy / Permissions-Policy).
   *
   * <p>CSP 는 외부 OAuth (구글/카카오/네이버) + Spotify SDK + YouTube IFrame 등 운영 중인
   * 외부 리소스를 화이트리스트로 둔다. Next.js + React 의 inline script 호환을 위해
   * 'unsafe-inline' 은 남기되, 'unsafe-eval' 은 개발 환경에서만 허용한다.
   * 운영 nonce 적용은 Next.js 동적 렌더링 전환과 함께 별도 진행한다.
   */
  async headers() {
    /**
     * v2.17.3 — CSP 화이트리스트 보강.
     *
     * <p>외부 폰트 요청은 제거했고, 실제 기능이 사용하는 OAuth / YouTube / Spotify / Tailscale
     * 호스트만 허용한다.
     */
    const csp = [
      "default-src 'self'",
      // v2.21-S8 — script-src 에 YouTube IFrame API (www.youtube.com + s.ytimg.com) 추가.
      // 이전엔 frame-src 에만 있어 IFrame embed 는 가능했지만 iframe_api.js 자체가 CSP 에
      // 막혀서 useYouTubePlayer 가 player 인스턴스를 생성 못함 → 검은 화면. 음악 재생
      // "수두룩한 실패" 의 진짜 원인. v2.17 CSP 도입 시 누락된 도메인.
      // v2.21-S14 — script-src 에 Spotify Web Playback SDK (sdk.scdn.co) 추가.
      // v2.41 — 실사용 0건이던 잔재 4개 제거. dapi.kakao.com 은 app/layout.tsx 가 로드하던
      // Kakao Map SDK 전용이었는데 지도는 v2.36 에 MapLibre 로 교체돼 로더째 제거했다.
      // 채팅 알림음도 외부 파일 대신 브라우저 안에서 생성하므로 t1.daumcdn.net 허용이 필요 없다.
      // www.googletagmanager.com 은 gtag 참조 0건, *.algolia* 는 AI 검색으로 대체돼 클라이언트 0건.
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"} https://www.youtube.com https://s.ytimg.com https://sdk.scdn.co`,
      // 브랜드 폰트 CSS 를 두 CDN 에서 받는다(globals.css 상단 주석 참고). self-host 로 옮기면
      // 이 두 줄과 font-src 의 예외를 함께 지울 수 있다.
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
      // *.scdn.co / *.mzstatic.com — 음악 앨범아트. next/image 화이트리스트 대신 raw <img> 로
      // 렌더하므로(GlobalMusicPlayer·MusicForPopup·MusicTab) img-src 에 반드시 있어야 한다.
      // 빠뜨리면 음악 화면 커버가 전부 깨진다(실측: /api/music/popular 이미지 전건이 i.scdn.co).
      `img-src 'self' data: blob: ${backendOrigin} https://images.unsplash.com https://images.pexels.com https://*.kakaocdn.net https://*.pstatic.net https://lh3.googleusercontent.com https://*.scdn.co https://*.mzstatic.com https://i.ytimg.com`,
      // v2.21-S14/S15 — media-src 에 Spotify(p.scdn.co) + iTunes preview CDN.
      // iTunes preview 는 audio-ssl.itunes.apple.com / *.mzstatic.com 에서 m4a 제공.
      "media-src 'self' blob: https: https://p.scdn.co https://*.scdn.co https://audio-ssl.itunes.apple.com https://*.mzstatic.com",
      "font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com",
      // v2.21-S8/S14 — connect-src 에 YouTube + Spotify API / SDK / CDN 추가.
      // api.spotify.com (Web API play call), *.spotify.com (SDK websocket), *.scdn.co (CDN).
      // v2.32 — MapLibre 지도용: protomaps.github.io(라틴/숫자 글리프 fetch). 타일은 same-origin
      // /basemap 프록시로 받으므로 build.protomaps.com 은 서버측 fetch(브라우저 CSP 무관).
      // v2.41 — *.algolia* (AI 검색으로 대체, fetch 0건) 와 dapi.kakao.com (Kakao Map SDK 전용,
      // 로더 제거) 을 뺀다. accounts.kakao.com 은 소셜 로그인이 아직 쓰므로 남긴다.
      `connect-src 'self' ${backendOrigin} ${backendWsOrigin} https://accounts.kakao.com https://accounts.google.com https://nid.naver.com https://*.ts.net wss://*.ts.net https://www.youtube.com https://s.ytimg.com https://api.spotify.com https://*.spotify.com https://*.scdn.co https://protomaps.github.io https://router.project-osrm.org wss://*.spotify.com${process.env.NODE_ENV === 'production' ? '' : ' ws://localhost:* http://localhost:*'}`,
      // v2.32 — MapLibre GL JS 는 타일 파싱을 blob URL 웹워커에서 한다. worker-src 미지정 시
      // default-src 'self' 로 폴백돼 blob: 워커가 차단된다 → 지도 렌더 실패.
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      // v2.21-S14 — frame-src / media: Spotify SDK iframe (sdk.scdn.co) + open.spotify.com.
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://open.spotify.com https://sdk.scdn.co https://accounts.kakao.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      // upgrade-insecure-requests 는 운영(https)에서만. 로컬 dev(http://localhost)에서 켜면
      // same-origin /basemap 요청까지 https 로 올려버려 지도 타일이 깨진다.
      ...(process.env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(self), microphone=(), camera=(), payment=()',
          },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
      {
        /**
         * v2.41 — 배경 영상에 1년 불변 캐시.
         *
         * <p>기본값은 max-age=0 이라 홈/로그인에 들어올 때마다 영상을 다시 받았고, 홈은
         * 크로스페이드용으로 video 요소를 2개 렌더해서 같은 파일을 두 번 받는 일까지 있었다.
         * 파일 내용이 바뀌면 파일명을 바꾸는 방식(login-bg-v2.mp4)으로 운영하므로 immutable 이 안전하다.
         */
        source: '/:all*(mp4|webm)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
};

export default nextConfig;
