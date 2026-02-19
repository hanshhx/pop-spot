"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation"; // useRouter 추가
import { Loader2 } from "lucide-react";

// 쿠키에서 값 가져오는 헬퍼 함수
function getCookie(name: string) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
}

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("로그인 처리 중...");

  useEffect(() => {
    // 1. 쿠키에서 토큰 추출
    const token = getCookie("accessToken");
    
    // 2. URL 파라미터 추출 (비민감 정보)
    const userId = searchParams.get("userId");
    const nickname = searchParams.get("nickname");
    const isPremium = searchParams.get("isPremium");

    if (token && userId) {
      // 3. 로컬 스토리지 저장 (기존 로직 유지)
      localStorage.setItem("token", token);

      const realUser = {
        userId: userId,
        nickname: nickname ? decodeURIComponent(nickname) : "User",
        isPremium: isPremium === "true",
        isSocial: true
      };
      localStorage.setItem("user", JSON.stringify(realUser));

      // 4. 보안을 위해 쿠키 삭제 (선택 사항)
      document.cookie = "accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";

      setStatus("로그인 성공! 메인으로 이동합니다.");
      
      // 5. 이동
      setTimeout(() => window.location.href = "/", 500); 
    } else {
      setStatus("로그인 정보가 없습니다.");
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
      <Suspense fallback={<div className="text-white">Loading...</div>}>
        <CallbackContent />
      </Suspense>
    </div>
  );
}