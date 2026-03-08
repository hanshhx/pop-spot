"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation"; 
import { Loader2 } from "lucide-react";
// 🔥 [임의 추가] 백엔드와 통신하기 위해 전역 API 주소를 가져옵니다.
import { API_BASE_URL } from "../../../src/lib/api"; 

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
    // =========================================================================
    // ❌ [기존 코드 보존] 보안 업데이트로 인해 주소창에 더 이상 토큰이 들어오지 않습니다.
    // 기존의 이 부분은 주석 처리하여 히스토리로 남겨둡니다.
    // =========================================================================
    /*
    const tokenFromUrl = searchParams.get("accessToken");
    const tokenFromCookie = getCookie("accessToken");
    const token = tokenFromUrl || tokenFromCookie;
    const userId = searchParams.get("userId");
    const nickname = searchParams.get("nickname");
    const isPremium = searchParams.get("isPremium");
    const roleFromUrl = searchParams.get("role");

    if (token && userId) {
      localStorage.setItem("token", token);

      const realUser = {
        userId: userId,
        nickname: nickname ? decodeURIComponent(nickname) : "User",
        isPremium: isPremium === "true",
        role: roleFromUrl || "USER",
        isSocial: true
      };
      
      localStorage.setItem("user", JSON.stringify(realUser));
      document.cookie = "accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";

      setStatus("로그인 성공! 메인으로 이동합니다.");
      setTimeout(() => {
        window.location.href = "/";
      }, 500); 
    } else {
      setStatus("로그인 정보가 없습니다. 다시 시도해주세요.");
      setTimeout(() => router.push("/login"), 2000);
    }
    */
    
    // =========================================================================
    // ✅ [신규 코드] HttpOnly 보안 쿠키를 기반으로 백엔드에서 직접 유저 정보를 긁어옵니다.
    // =========================================================================
    const fetchUserInfo = async () => {
        try {
            // credentials: "include" 옵션이 핵심입니다. 이 옵션을 켜야 브라우저가
            // 자신만의 비밀 금고에 넣어둔 HttpOnly 쿠키(accessToken)를 꺼내서 서버로 전송합니다.
            const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
                method: "GET",
                credentials: "include" 
            });

            if (res.ok) {
                // 1. 서버가 쿠키를 까보고 이상이 없으면 유저 정보를 JSON으로 돌려줍니다.
                const userInfo = await res.json();
                
                // 2. 프론트엔드 전역에서 쓸 수 있도록 로컬 스토리지에 세팅합니다.
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
                // 🔥 [문제 해결 핵심 1] 백엔드가 401 에러 등을 보내면, 에러 메시지를 까서 보여줍니다.
                const errorText = await res.text();
                setStatus(`인증 거부됨: ${res.status} - ${errorText}`);
                
                // 에러를 화면에서 5초간 보여준 뒤 로그인 창으로 돌려보냅니다.
                setTimeout(() => router.push("/login"), 5000);
            }
        } catch (error: any) {
            // 🔥 [문제 해결 핵심 2] CORS 때문에 아예 연결조차 못하고 터진 에러를 잡아냅니다.
            console.error("Fetch API 에러:", error);
            setStatus(`서버 연결 차단됨 (CORS 또는 네트워크 문제): ${error.message}`);
            
            // 에러를 화면에서 5초간 보여준 뒤 로그인 창으로 돌려보냅니다.
            setTimeout(() => router.push("/login"), 5000);
        }
    };

    fetchUserInfo();
  }, [searchParams, router]);

  return (
    // 🚀 반응형 적용: gap 크기 조절, px-4 및 text-center 추가로 모바일 가독성 확보
    <div className="flex flex-col items-center gap-3 md:gap-4 px-4 text-center">
      <Loader2 className="w-8 h-8 md:w-12 md:h-12 text-indigo-500 animate-spin" />
      <h2 className="text-lg md:text-xl font-bold text-white">{status}</h2>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      {/* [구조 해석] useSearchParams를 사용하기 위해 Suspense로 감싸 클라이언트 사이드 렌더링을 보장합니다. */}
      {/* 🚀 반응형 텍스트 사이즈 추가 */}
      <Suspense fallback={<div className="text-white text-sm md:text-base font-medium">인증 정보를 확인 중입니다...</div>}>
        <CallbackContent />
      </Suspense>
    </div>
  );
}