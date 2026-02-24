"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation"; // useRouter 추가
import { Loader2 } from "lucide-react";

// [로직 해석] 쿠키에서 특정 이름의 값을 추출하는 헬퍼 함수입니다.
function getCookie(name: string) {
  if (typeof document === "undefined") return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
}

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("로그인 처리 중...");

  useEffect(() => {
    // 1. [로직 수정] 백엔드가 URL 파라미터로 보낸 accessToken을 먼저 추출합니다.
    const tokenFromUrl = searchParams.get("accessToken");
    
    // 2. [기존 유지] 쿠키에서도 토큰을 확인합니다.
    const tokenFromCookie = getCookie("accessToken");
    
    // 3. [로직 핵심] URL에 토큰이 있다면 최우선으로 채택합니다. (도메인 차단 대비)
    const token = tokenFromUrl || tokenFromCookie;
    
    // 4. [기존 유지] URL 파라미터에서 유저 식별 정보 및 상태를 추출합니다.
    const userId = searchParams.get("userId");
    const nickname = searchParams.get("nickname");
    const isPremium = searchParams.get("isPremium");

    // [로직 분석] 유효한 토큰과 유저 ID가 확인되면 로그인 프로세스를 진행합니다.
    if (token && userId) {
      // 5. 로컬 스토리지 저장 (기존 로직 유지)
      localStorage.setItem("token", token);

      const realUser = {
        userId: userId,
        nickname: nickname ? decodeURIComponent(nickname) : "User",
        isPremium: isPremium === "true",
        isSocial: true
      };
      
      // [구조 해석] JSON 문자열로 변환하여 로컬스토리지에 저장, 전역에서 유저 정보를 사용하게 합니다.
      localStorage.setItem("user", JSON.stringify(realUser));

      // 6. 보안을 위해 쿠키 삭제 (선택 사항)
      document.cookie = "accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";

      setStatus("로그인 성공! 메인으로 이동합니다.");
      
      // 7. [구조 해석] router.push 대신 window.location.href를 사용하여 페이지 상태를 완전히 새로고침하며 이동합니다.
      setTimeout(() => {
        window.location.href = "/";
      }, 500); 
    } else {
      // [로직 분석] 인증 정보가 부족할 경우 에러 메시지를 출력하고 로그인 페이지로 돌려보냅니다.
      setStatus("로그인 정보가 없습니다. 다시 시도해주세요.");
      setTimeout(() => router.push("/login"), 2000);
    }
  }, [searchParams, router]);

  return (
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
      <h2 className="text-xl font-bold text-white">{status}</h2>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      {/* [구조 해석] useSearchParams를 사용하기 위해 Suspense로 감싸 클라이언트 사이드 렌더링을 보장합니다. */}
      <Suspense fallback={<div className="text-white">인증 정보를 확인 중입니다...</div>}>
        <CallbackContent />
      </Suspense>
    </div>
  );
}