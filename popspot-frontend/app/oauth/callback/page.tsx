"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation"; // 🔥 [수정] useSearchParams 추가
import { Loader2 } from "lucide-react";
// 🔥 [수정] 이제 API_BASE_URL 대신, 우리가 방금 완벽하게 고친 apiFetch를 직접 가져옵니다.
import { apiFetch } from "../../../src/lib/api"; 

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams(); // 🔥 [추가] URL의 쿼리 파라미터를 읽기 위해 추가
  const [status, setStatus] = useState("로그인 처리 중...");
  const hasFetched = useRef(false); // React StrictMode 이중 호출 방지용

  useEffect(() => {
    // 이미 한 번 요청을 보냈다면 중복 실행 방지
    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetchUserInfo = async () => {
        try {
            // 1. 🔥 [핵심 추가] 주소창에서 토큰(?token=...)을 가져옵니다.
            const tokenFromUrl = searchParams.get("token");

            if (tokenFromUrl) {
                // 2. 🔥 [핵심 추가] 가져온 토큰을 로컬스토리지에 저장합니다.
                // 이제 apiFetch가 실행될 때 이 토큰을 헤더에 자동으로 실어 보냅니다.
                localStorage.setItem("token", tokenFromUrl);
                setStatus("인증 정보 저장 중...");
            } else {
                // 만약 토큰이 아예 없다면 에러 처리 후 로그인 페이지로 보냅니다.
                setStatus("인증 토큰을 찾을 수 없습니다.");
                setTimeout(() => router.push("/login"), 2000);
                return;
            }

            // 3. 🔥 [기존 로직 유지] 고친 apiFetch를 사용하여 내 정보를 요청합니다.
            const res = await apiFetch("/api/v1/auth/me", {
                method: "GET"
            });

            if (res.ok) {
                // 서버가 토큰을 검증하고 유저 정보를 반환합니다.
                const userInfo = await res.json();
                
                // 4. 유저 정보를 로컬 스토리지에 세팅
                const realUser = {
                    userId: userInfo.userId,
                    nickname: userInfo.nickname,
                    isPremium: userInfo.isPremium,
                    role: userInfo.role,
                    isSocial: true
                };
                localStorage.setItem("user", JSON.stringify(realUser));

                // 5. 로그인 성공 처리
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
  }, [router, searchParams]); // 🔥 searchParams 의존성 추가

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
      {/* [구조 해석] useSearchParams를 사용하기 위해 Suspense로 감싸는 기존 구조를 유지합니다. */}
      <Suspense fallback={<div className="text-white text-sm md:text-base font-medium">인증 정보를 확인 중입니다...</div>}>
        <CallbackContent />
      </Suspense>
    </div>
  );
}