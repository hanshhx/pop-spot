import type { NextConfig } from "next";

// 1. 환경 변수에서 백엔드 주소를 가져옵니다. (설정된 게 없으면 로컬 사용)
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// 2. [추가 로직] API_URL에서 '도메인 이름'만 추출합니다.
// 예: https://pop-spot-api.duckdns.org -> pop-spot-api.duckdns.org
// 이렇게 하면 나중에 주소가 바뀌어도 이미지 설정이 자동으로 따라갑니다.
let backendHostname = "localhost";
try {
  const urlObj = new URL(API_URL);
  backendHostname = urlObj.hostname;
} catch (e) {
  console.warn("⚠️ API_URL 형식이 올바르지 않아 이미지 호스트를 localhost로 설정합니다.");
}

const nextConfig: NextConfig = {
  // 3. [필수] 외부 이미지 도메인 허용 목록
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" }, // 샘플 이미지용
      { protocol: "http", hostname: "localhost" },            // 로컬 개발용
      { protocol: "https", hostname: "k.kakaocdn.net" },      // 카카오 프로필 이미지
      { protocol: "https", hostname: "ssl.pstatic.net" },     // 네이버 프로필 이미지
      { protocol: "https", hostname: "lh3.googleusercontent.com" }, // 구글 프로필 이미지
      
      // 🔥 [핵심 추가] 환경변수에 설정된 백엔드 도메인(DuckDNS 등)을 자동으로 허용
      { protocol: "https", hostname: backendHostname },
      { protocol: "http", hostname: backendHostname }, 
    ],
  },

  // 4. [해결 로직] API 리라이트 (기존 로직 유지 + 환경변수 적용)
  // 프론트에서 /api/... 로 요청하면 -> 실제 백엔드 주소/api/... 로 연결해줍니다.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/api/:path*`, // 🔥 하드코딩 제거 -> 환경변수 연결
      },
    ];
  },
};

export default nextConfig;