"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Lock, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

// 🔥 [수정 완료] TypeScript 경로 에러 해결을 위해 상대 경로를 정확히 잡았습니다.
// (app/login/page.tsx 기준으로 두 단계 위로 올라가서 src/lib/api를 찾음)
import { API_BASE_URL } from "../../src/lib/api"; 

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: "", password: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async () => {
    try {
      // 🔥 [핵심 수정] "http://localhost:8080" 부분을 변수로 완벽히 교체했습니다.
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("user", JSON.stringify(data));
        alert(`${data.nickname}님 환영합니다!`);
        router.push("/");
      } else {
        alert("로그인 실패: 아이디나 비밀번호를 확인해주세요.");
      }
    } catch (e) {
      alert("서버 연결 실패 (GCP 서버 상태를 확인해주세요)");
    }
  };

  const handleSocialLogin = (provider: string) => {
    // 🔥 [핵심 수정] 소셜 로그인 주소도 localhost를 지우고 변수로 교체했습니다.
    window.location.href = `${API_BASE_URL}/oauth2/authorization/${provider}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-black">
      
      {/* 🎥 배경 비디오 */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source src="/login-bg.mp4" type="video/mp4" />
      </video>

      {/* 🌑 비디오 위 어두운 막 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-0" />

      {/* ✨ 보라색 빛 효과 (모바일 반응형 크기 조절) */}
      <div className="absolute bottom-[-10%] left-[-10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-violet-600/30 rounded-full blur-[80px] md:blur-[120px] z-0 pointer-events-none" />

      {/* 📦 로그인 박스 (모바일 반응형 패딩, 마진 조절) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-black/40 backdrop-blur-xl border border-white/10 p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-2xl relative z-10 mx-2 md:mx-0"
      >
        <button onClick={() => router.back()} className="absolute top-4 left-4 md:top-6 md:left-6 text-white/50 hover:text-white transition-colors p-1">
          <ArrowLeft size={20} className="md:w-6 md:h-6" />
        </button>
        
        <h1 className="text-2xl md:text-3xl font-black text-center mb-1 md:mb-2 text-white tracking-tighter italic mt-4 md:mt-0">
            LOGIN
        </h1>
        <p className="text-center text-white/60 text-xs md:text-sm mb-6 md:mb-8">POP SPOT에 오신 것을 환영합니다</p>

        <div className="space-y-3 md:space-y-4">
          <div className="relative">
            <input name="email" type="email" placeholder="이메일" onChange={handleChange}
              className="w-full bg-white/5 border border-white/10 rounded-lg md:rounded-xl p-3 md:p-4 pl-10 md:pl-12 text-sm md:text-base text-white focus:border-indigo-500 outline-none transition-colors placeholder:text-white/30" />
            <Mail className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-white/50 w-4 h-4 md:w-5 md:h-5"/>
          </div>
          <div className="relative">
            <input name="password" type="password" placeholder="비밀번호" onChange={handleChange}
              className="w-full bg-white/5 border border-white/10 rounded-lg md:rounded-xl p-3 md:p-4 pl-10 md:pl-12 text-sm md:text-base text-white focus:border-indigo-500 outline-none transition-colors placeholder:text-white/30" />
            <Lock className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-white/50 w-4 h-4 md:w-5 md:h-5"/>
          </div>
        </div>

        <div className="flex justify-end mt-2 md:mt-3 mb-5 md:mb-6">
          <Link href="/find-account" className="text-[10px] md:text-xs text-white/50 hover:text-white transition-colors">
            아이디 / 비밀번호 찾기
          </Link>
        </div>

        <button onClick={handleLogin} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 md:py-4 rounded-lg md:rounded-xl transition-all shadow-lg mb-5 md:mb-6 shadow-indigo-500/20 text-sm md:text-base">
          로그인
        </button>

        <div className="relative flex py-1 md:py-2 items-center">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="flex-shrink-0 mx-3 md:mx-4 text-white/30 text-[10px] md:text-xs">또는 소셜 로그인</span>
            <div className="flex-grow border-t border-white/10"></div>
        </div>

        <div className="space-y-2.5 md:space-y-3 mt-4 md:mt-6">
            <button 
                onClick={() => handleSocialLogin("kakao")}
                className="w-full py-2.5 md:py-3 rounded-lg md:rounded-xl font-bold bg-[#FEE500] text-[#000000] hover:bg-[#FDD835] transition-transform hover:scale-[1.02] flex items-center justify-center gap-2 md:gap-3 text-xs md:text-base"
            >
                <MessageCircle size={16} className="md:w-5 md:h-5" fill="black" />
                <span>카카오로 시작하기</span>
            </button>

            <button 
                onClick={() => handleSocialLogin("naver")}
                className="w-full py-2.5 md:py-3 rounded-lg md:rounded-xl font-bold bg-[#03C75A] text-white hover:bg-[#02b351] transition-transform hover:scale-[1.02] flex items-center justify-center gap-2 md:gap-3 text-xs md:text-base"
            >
                <span className="font-black text-base md:text-lg">N</span>
                <span>네이버로 시작하기</span>
            </button>

            <button 
                onClick={() => handleSocialLogin("google")}
                className="w-full py-2.5 md:py-3 rounded-lg md:rounded-xl font-bold bg-white text-black border border-white/20 hover:bg-gray-100 transition-transform hover:scale-[1.02] flex items-center justify-center gap-2 md:gap-3 text-xs md:text-base"
            >
                <svg className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>Google로 시작하기</span>
            </button>
        </div>

        <div className="mt-6 md:mt-8 text-center">
            <p className="text-white/40 text-xs md:text-sm">아직 회원이 아니신가요?</p>
            <Link href="/signup">
                <button className="mt-2 md:mt-3 w-full border border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 md:py-3 rounded-lg md:rounded-xl transition-all text-xs md:text-sm">
                    이메일로 회원가입 하기
                </button>
            </Link>
        </div>
      </motion.div>
    </div>
  );
}