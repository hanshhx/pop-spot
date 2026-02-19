"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, User, Phone, Mail, KeyRound, ChevronRight, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
// 🔥 [수정] API 헬퍼 함수 import
import { apiFetch } from "../../src/lib/api";

export default function FindAccountPage() {
  const router = useRouter();

  // 탭: 'id'(아이디찾기) / 'pw'(비번찾기)
  const [activeTab, setActiveTab] = useState<'id' | 'pw'>('id');
  
  // 상태 관리
  const [pwStep, setPwStep] = useState(1);

  // 입력값
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // 결과값
  const [foundEmail, setFoundEmail] = useState("");
  const [providerInfo, setProviderInfo] = useState(""); // 소셜 정보 저장
  const [loading, setLoading] = useState(false);

  // 탭 변경 시 초기화
  const handleTabChange = (tab: 'id' | 'pw') => {
    setActiveTab(tab);
    setPwStep(1);
    setName(""); setPhone(""); setEmail(""); setAuthCode(""); setNewPassword("");
    setFoundEmail("");
    setProviderInfo("");
  };

  // 🟢 [아이디 찾기] JSON 파싱 수정 완료
  const handleFindId = async () => {
    if (!name || !phone) return alert("이름과 휴대폰 번호를 입력해주세요.");
    
    setLoading(true);
    try {
      // 🔥 [수정] apiFetch 사용
      const res = await apiFetch(`/api/v1/auth/find-email?nickname=${name}&phoneNumber=${phone}`);
      
      if (res.ok) {
        // 🔥 [수정 핵심] text()가 아니라 json()으로 받아야 합니다!
        const data = await res.json(); 
        
        console.log("받은 데이터:", data); // 디버깅용

        setFoundEmail(data.email); // 이메일만 설정
        
        // 소셜 정보가 있으면 저장 (LOCAL이 아니면)
        if (data.provider && data.provider !== "LOCAL") {
            setProviderInfo(data.provider);
        } else {
            setProviderInfo("");
        }
      } else {
        alert("일치하는 회원 정보가 없습니다.");
      }
    } catch (e) {
      console.error(e);
      alert("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 🔵 [비번 찾기 1] 소셜 회원 차단 로직
  const handleSendEmailCode = async () => {
    if (!email || !name) return alert("이메일과 이름을 입력해주세요.");

    setLoading(true);
    try {
      // 🔥 [수정] apiFetch 사용
      const res = await apiFetch("/api/v1/auth/email/send-for-pw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, nickname: name })
      });

      if (res.ok) {
        alert("인증번호가 메일로 발송되었습니다!");
        setPwStep(2);
      } else {
        // 🔥 [수정] 400 에러(소셜회원)도 여기서 처리됩니다.
        const msg = await res.text();
        
        if (msg.includes("SOCIAL_USER")) {
            // 예: "SOCIAL_USER:google" -> "GOOGLE" 추출
            const provider = msg.split(":")[1].toUpperCase();
            alert(`[안내] 해당 계정은 ${provider} 간편 로그인 회원입니다.\n비밀번호 찾기 대신 소셜 로그인을 이용해주세요.`);
        } else {
            alert("정보가 일치하지 않거나 존재하지 않습니다.");
        }
      }
    } catch (e) {
      alert("서버 연결 실패");
    } finally {
      setLoading(false);
    }
  };

  // 🔵 [비번 찾기 2] 인증번호 검증
  const handleVerifyCode = async () => {
    if (!authCode) return alert("인증번호를 입력해주세요.");

    setLoading(true);
    try {
      // 🔥 [수정] apiFetch 사용
      const res = await apiFetch("/api/v1/auth/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: authCode })
      });

      if (res.ok) {
        setPwStep(3); 
      } else {
        alert("인증번호가 올바르지 않습니다.");
      }
    } catch (e) {
      alert("인증 오류");
    } finally {
      setLoading(false);
    }
  };

  // 🔵 [비번 찾기 3] 비밀번호 변경
  const handleChangePassword = async () => {
    if (!newPassword) return alert("새 비밀번호를 입력해주세요.");

    setLoading(true);
    try {
      // 🔥 [수정] apiFetch 사용
      const res = await apiFetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword })
      });

      if (res.ok) {
        alert("비밀번호가 변경되었습니다! 로그인해주세요.");
        router.push("/login");
      } else {
        alert("변경 실패");
      }
    } catch (e) {
      alert("서버 오류");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[120px]" />

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-[#111] border border-white/10 p-8 rounded-3xl shadow-2xl relative z-10">
        
        <div className="flex items-center justify-between mb-8">
            <button onClick={() => router.back()} className="text-white/50 hover:text-white transition-colors"><ArrowLeft size={24} /></button>
            <h1 className="text-2xl font-black tracking-tight">계정 찾기</h1>
            <div className="w-6" />
        </div>

        {/* 탭 버튼 */}
        <div className="flex bg-white/5 rounded-xl p-1 mb-8">
            <button onClick={() => handleTabChange('id')} className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'id' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/50 hover:text-white'}`}>
                <User size={16}/> 아이디 찾기
            </button>
            <button onClick={() => handleTabChange('pw')} className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'pw' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/50 hover:text-white'}`}>
                <KeyRound size={16}/> 비밀번호 찾기
            </button>
        </div>

        <AnimatePresence mode="wait">
            {/* 🟢 아이디 찾기 폼 */}
            {activeTab === 'id' && !foundEmail && (
                <motion.div key="find-id-form" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs text-white/50 pl-1 font-bold">이름 (닉네임)</label>
                        <div className="relative"><input type="text" placeholder="가입한 이름" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-[#222] border border-white/10 rounded-xl p-4 pl-12 text-white outline-none focus:border-indigo-500 transition-colors"/><User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={20}/></div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-white/50 pl-1 font-bold">휴대폰 번호</label>
                        <div className="relative"><input type="text" placeholder="01012345678" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-[#222] border border-white/10 rounded-xl p-4 pl-12 text-white outline-none focus:border-indigo-500 transition-colors"/><Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={20}/></div>
                    </div>
                    <button onClick={handleFindId} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 mt-4">
                        {loading ? "찾는 중..." : "내 아이디 찾기"}
                    </button>
                </motion.div>
            )}

            {/* 🟢 아이디 찾기 결과 (JSON 파싱 후 깔끔하게 표시) */}
            {activeTab === 'id' && foundEmail && (
                <motion.div key="find-id-result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6 space-y-6">
                    <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto text-green-500 border border-green-500/20"><Mail size={40}/></div>
                    <div>
                        <p className="text-white/50 text-sm mb-2">회원님의 아이디는</p>
                        <h2 className="text-2xl font-black text-white">{foundEmail}</h2>
                        
                        {/* 소셜 회원이면 뱃지 표시 */}
                        {providerInfo && (
                            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/20">
                                <span className="text-xs text-indigo-400 font-bold uppercase">{providerInfo}</span>
                                <span className="text-xs text-white/60">가입 계정</span>
                            </div>
                        )}
                        
                        <p className="text-white/50 text-sm mt-4">입니다.</p>
                    </div>
                    <button onClick={() => router.push("/login")} className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-white/90 transition-colors">
                        로그인하러 가기
                    </button>
                </motion.div>
            )}

            {/* 🔵 비밀번호 찾기 (이하 동일) */}
            {activeTab === 'pw' && pwStep === 1 && (
                <motion.div key="pw-step1" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs text-white/50 pl-1 font-bold">이메일 (아이디)</label>
                        <div className="relative"><input type="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#222] border border-white/10 rounded-xl p-4 pl-12 text-white outline-none focus:border-indigo-500"/><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={20}/></div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-white/50 pl-1 font-bold">이름 (닉네임)</label>
                        <div className="relative"><input type="text" placeholder="가입한 이름" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-[#222] border border-white/10 rounded-xl p-4 pl-12 text-white outline-none focus:border-indigo-500"/><User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={20}/></div>
                    </div>
                    <button onClick={handleSendEmailCode} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl mt-4 flex items-center justify-center gap-2">
                        {loading ? "확인 중..." : "인증메일 발송"} <ChevronRight size={18}/>
                    </button>
                </motion.div>
            )}

            {activeTab === 'pw' && pwStep === 2 && (
                <motion.div key="pw-step2" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                    <div className="text-center mb-4"><p className="text-white/70 text-sm">이메일로 전송된 인증번호를 입력하세요.</p><p className="text-indigo-400 font-bold mt-1">{email}</p></div>
                    <div className="relative"><input type="text" placeholder="123456" value={authCode} onChange={(e) => setAuthCode(e.target.value)} className="w-full bg-[#222] border border-white/10 rounded-xl p-4 text-center text-white outline-none focus:border-indigo-500 tracking-[0.5em] font-bold text-lg"/></div>
                    <button onClick={handleVerifyCode} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl mt-2">{loading ? "확인 중..." : "인증번호 확인"}</button>
                </motion.div>
            )}

            {activeTab === 'pw' && pwStep === 3 && (
                <motion.div key="pw-step3" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs text-white/50 pl-1 font-bold">새 비밀번호</label>
                        <div className="relative"><input type="password" placeholder="새 비밀번호 입력" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-[#222] border border-white/10 rounded-xl p-4 pl-12 text-white outline-none focus:border-indigo-500"/><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={20}/></div>
                    </div>
                    <button onClick={handleChangePassword} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl mt-4">{loading ? "변경 중..." : "비밀번호 변경 완료"}</button>
                </motion.div>
            )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}