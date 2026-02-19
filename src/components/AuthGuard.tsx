"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

// 🔥 [수정] "/oauth/callback" 경로를 반드시 추가해야 소셜 로그인 처리가 가능합니다!
const PUBLIC_PATHS = ["/login", "/signup", "/", "/find-account", "/oauth/callback"]; 

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // 1. 공개 페이지면 검사 통과
    if (PUBLIC_PATHS.includes(pathname)) {
      setIsAuthorized(true);
      return;
    }

    // 2. 로그인 여부 확인
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      router.replace("/login"); 
    } else {
      setIsAuthorized(true);
    }
  }, [pathname, router]);

  if (!isAuthorized) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-black text-white">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-gray-400 font-bold">인증 확인 중...</p>
      </div>
    );
  }

  return <>{children}</>;
}