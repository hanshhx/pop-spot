"use client";

import { Suspense, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

import { apiFetch } from "@/lib/api";

// 인증 불필요 공개 경로 — 정확 일치. (sitemap 포함 페이지 + 인증 흐름 페이지)
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/find-account",
  "/oauth/callback",
  "/feedback",
  "/about",
  "/terms",
  "/privacy",
];

// slug 가 붙는 동적 공개 경로 — prefix 매칭.
// /popups/[slug] = SEO long-tail 랜딩, /popup/[id] = 팝업 상세(공유/색인 대상).
const PUBLIC_PREFIXES = ["/popups/", "/popup/"];

const TOKEN_KEY = "token";
const USER_KEY = "user";

/** 공개 경로 판정 — 정확 일치 또는 공개 prefix. pathname 불명 시 공개로 간주(막지 않음). */
function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return true;
  return (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function GuardFallback() {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-black text-white">
      <Loader2 className="w-10 h-10 animate-spin text-lime-500 mb-4" />
      <p className="text-gray-400 font-bold">불러오는 중...</p>
    </div>
  );
}

/**
 * 경로별 인증 가드 (UX/리다이렉트 전용 — 실제 보안은 서버 API 토큰 검증이 담당).
 *
 * <p>v2.23.2 — SEO: 더 이상 인증 확인 동안 스피너로 본문을 가리지 않는다. 항상 children 을 렌더해
 * 서버 컴포넌트 페이지(예: {@code /popups/[slug]} SEO 랜딩, {@code /about})가 실제 본문 HTML 을
 * 내보내게 한다 — 크롤러(특히 JS 를 거의 안 돌리는 네이버 Yeti)가 색인할 수 있도록. 이전엔 모든
 * 페이지의 첫 HTML 이 "인증 확인 중" 스피너라 메인/SEO 랜딩이 색인되지 않았다.
 *
 * <p>{@code <Suspense>} 로 감싸는 이유: 일부 클라이언트 페이지(메인 등)가 {@code useSearchParams()}
 * 를 쓰는데, 정적 생성 시 Suspense 경계가 없으면 빌드가 실패한다. Suspense 가 있으면 그런 페이지는
 * 빌드 시 fallback 으로 떨어지고(빌드 통과), suspend 하지 않는 서버 컴포넌트 SEO 페이지는 실제
 * 본문을 그대로 SSR 한다.
 *
 * <p>보호 경로(공개 목록 밖)는 마운트 후 토큰을 검증해 미인증이면 /login 으로 보낸다. 보호 페이지는
 * noindex + 데이터가 토큰 게이트된 API 라 잠깐 빈 셸이 렌더돼도 유출 없음.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 공개 경로는 아무 검사도 하지 않는다.
    if (isPublicPath(pathname)) return;

    // [redesign/test] 로컬(localhost) 미리보기에서는 보호 경로도 막지 않는다 — 백엔드/토큰 없이
    // 관리자 등 보호 페이지를 확인하기 위함. 프로덕션(실도메인)에서는 이 우회가 동작하지 않는다.
    if (
      typeof window !== "undefined" &&
      ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ) {
      return;
    }

    let cancelled = false;

    const clearAuthAndRedirect = () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      router.replace("/login");
    };

    const verify = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        router.replace("/login");
        return;
      }
      try {
        const res = await apiFetch("/api/v1/auth/me");
        if (cancelled) return;
        if (res.status === 401) {
          clearAuthAndRedirect();
          return;
        }
        if (!res.ok) return; // 5xx / 네트워크 일시 장애 — stale 캐시 유지(UX 보호).
        const serverUser = await res.json();
        localStorage.setItem(USER_KEY, JSON.stringify(serverUser));
      } catch {
        // 네트워크 실패 → stale 캐시 fallback.
      }
    };

    verify();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return <Suspense fallback={<GuardFallback />}>{children}</Suspense>;
}
