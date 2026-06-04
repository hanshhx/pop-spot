"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

import { apiFetch } from "@/lib/api";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/",
  "/find-account",
  "/oauth/callback",
  "/feedback",
];

// SEO 랜딩 등 slug 가 붙는 동적 경로는 prefix 로 공개 처리.
// (/popups/[slug] = 지역/시점/카테고리 long-tail 랜딩 — 비로그인·크롤러가 봐야 한다.)
const PUBLIC_PREFIXES = ["/popups/"];

/** 공개 경로 판정 — 정확 일치 또는 공개 prefix 로 시작. (정적 빌드 시 pathname 이 null 일 수 있음) */
function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

const TOKEN_KEY = "token";
const USER_KEY = "user";

/**
 * 경로별 인증 가드.
 *
 * <p>v2.9 보안: 비공개 페이지 진입 시 단순히 localStorage 의 user 존재 여부만 보지 않고
 * {@code GET /api/v1/auth/me} 로 서버 재검증을 거친다. 이전 구현은 localStorage 의 user 객체를
 * devtools 로 수정해 isPremium / role 을 위조할 수 있었지만, 이제 매 진입마다 서버가 검증한
 * 값으로 덮어써서 위조가 즉시 정정된다.
 *
 * <ul>
 *   <li>토큰 없음 → /login 리다이렉트</li>
 *   <li>/me 401 → 토큰/유저 정리 + /login</li>
 *   <li>/me 200 → 서버 응답으로 localStorage user 덮어쓰기 → 통과</li>
 *   <li>네트워크 실패 → stale 캐시(localStorage) 로 graceful fallback (오프라인 / 백엔드 일시 장애)</li>
 * </ul>
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // 초기값은 false 로 둬야 SSR/hydration 이 일치한다(정적 빌드 시 pathname 이 null). 공개 경로는
  // 아래 useEffect 가 첫 마운트에서 즉시 통과시킨다 — 보호 경로만 토큰 검증 + 리다이렉트.
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      // 1. 공개 페이지는 검사 없이 통과 (정확 일치 + SEO 랜딩 prefix)
      if (isPublicPath(pathname)) {
        if (!cancelled) setIsAuthorized(true);
        return;
      }

      // 2. 토큰이 없으면 로그인 페이지로
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        router.replace("/login");
        return;
      }

      // 3. 서버에서 진짜 사용자 정보 재검증 — role / isPremium 위조 방지
      try {
        const res = await apiFetch("/api/v1/auth/me");
        if (cancelled) return;

        if (res.status === 401) {
          clearAuthAndRedirect();
          return;
        }
        if (!res.ok) {
          // 5xx / 네트워크 일시 장애 — stale 캐시로 통과 (UX 보호).
          // 진짜 권한이 필요한 액션은 서버가 다시 토큰 검증하므로 위조 위험 없음.
          if (!cancelled) setIsAuthorized(true);
          return;
        }

        const serverUser = await res.json();
        // localStorage 의 stale isPremium / role 을 서버 응답으로 덮어씀.
        // userId / nickname 도 동기화해 닉네임 변경 등 즉시 반영.
        localStorage.setItem(USER_KEY, JSON.stringify(serverUser));
        if (!cancelled) setIsAuthorized(true);
      } catch {
        // 네트워크 실패 → stale 캐시 fallback
        if (!cancelled) setIsAuthorized(true);
      }
    };

    const clearAuthAndRedirect = () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      router.replace("/login");
    };

    verify();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!isAuthorized) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-black text-white">
        <Loader2 className="w-10 h-10 animate-spin text-lime-500 mb-4" />
        <p className="text-gray-400 font-bold">인증 확인 중...</p>
      </div>
    );
  }

  return <>{children}</>;
}
