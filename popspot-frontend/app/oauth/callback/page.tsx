"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter } from "next/navigation"; 
import { Loader2 } from "lucide-react";
// 🔥 [수정] 이제 API_BASE_URL 대신, 우리가 방금 완벽하게 고친 apiFetch를 직접 가져옵니다.
import { apiFetch } from "../../../src/lib/api"; 

function CallbackContent() {
  const router = useRouter();
  const [status, setStatus] = useState("로그인 처리 중...");
  const hasFetched = useRef(false); // React StrictMode 이중 호출 방지용

  useEffect(() => {
    // 이미 한 번 요청을 보냈다면 중복 실행 방지
    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetchUserInfo = async () => {
        try {
            // 🔥 [핵심 수정] 우리가 고친 apiFetch를 사용합니다. 
            // 내부에 이미 credentials: "include"가 들어있으므로 알아서 쿠키를 들고 갑니다!
            const res = await apiFetch("/api/v1/auth/me", {
                method: "GET"
            });

            if (res.ok) {
                // 1. 서버가 쿠키를 까보고 이상이 없으면 유저 정보를 JSON으로 돌려줍니다.
                const userInfo = await res.json();
                
                // 2. 프론트엔드 전역에서 쓸 수 있도록 로컬 스토리지에 세팅 (토큰이 아닌 유저 정보만!)
                const realUser = {
                    userId: userInfo.userId,
                    nickname: userInfo.nickname,
                    isPremium: userInfo.isPremium,
                    role: userInfo.role,
                    isSocial: true
                };
                localStorage.setItem("user", JSON.stringify(realUser));

                // 3. 로그인 성공 처리
                setStatus("로그인 성공! 메인으로 이동합니다.");
                setTimeout(() => {
                    window.location.href = "/";
                }, 500);
            } else {
                // 백엔드가 401 에러 등을 보내면, 에러 메시지를 까서 보여줍니다.
                const errorText = await res.text();
                setStatus(`인증 거부됨: ${res.status} - ${errorText}`);
                setTimeout(() => router.push("/login"), 3000);
            }
        } catch (error: any) {
            console.error("Fetch API 에러:", error);
            setStatus(`서버 연결 차단됨: ${error.message}`);
            setTimeout(() => router.push("/login"), 3000);
        }
    };

    fetchUserInfo();
  }, [router]);

  return (
    <div className="flex flex-col items-center gap-3 md:gap-4 px-4 text-center">
      <Loader2 className="w-8 h-8 md:w-12 md:h-12 text-indigo-500 animate-spin" />
      <h2 className="text-lg md:text-xl font-bold text-white">{status}</h2>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <Suspense fallback={<div className="text-white text-sm md:text-base font-medium">인증 정보를 확인 중입니다...</div>}>
        <CallbackContent />
      </Suspense>
    </div>
  );
}