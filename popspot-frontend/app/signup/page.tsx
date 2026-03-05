"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Eye, EyeOff, CheckCircle2, XCircle, Check } from "lucide-react"; // 🔥 아이콘 추가

// 🔥 [수정 완료] TypeScript 경로 에러 해결 및 중앙 관리를 위해 상대 경로로 API 주소를 가져옵니다.
import { API_BASE_URL } from "../../src/lib/api"; 

export default function SignupPage() {
  const router = useRouter();
  
  // 입력 상태 관리 (🔥 passwordConfirm 추가)
  const [formData, setFormData] = useState({
    email: "",       
    password: "",
    passwordConfirm: "", // 추가됨
    name: "",
    birthdate: "",
    gender: "M", 
    phoneNumber: "", 
    authCode: "",    
  });

  // UI 상태 관리 (🔥 눈알 아이콘 토글용 상태 추가)
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  // 인증 상태 관리
  const [isAuthSent, setIsAuthSent] = useState(false);     
  const [isAuthVerified, setIsAuthVerified] = useState(false); 
  const [timer, setTimer] = useState(180); 

  // 🔥 [추가] 약관 동의 상태 관리
  const [agreements, setAgreements] = useState({
    terms: false,
    privacy: false
  });

  // ================= [🔥 실시간 유효성 검사 로직] =================
  
  // 1. 닉네임(이름) 검사: 특수문자 제외 2~8글자
  const isValidName = /^[a-zA-Z0-9가-힣]{2,8}$/.test(formData.name);
  
  // 2. 비밀번호 일치 검사
  const isPasswordMatch = formData.password !== "" && formData.password === formData.passwordConfirm;
  const isPasswordMismatch = formData.passwordConfirm !== "" && formData.password !== formData.passwordConfirm;

  // 3. 약관 전체 동의 여부
  const isAllAgreed = agreements.terms && agreements.privacy;

  // 4. 전체 폼 유효성 (가입 버튼 활성화 조건)
  const isFormValid = 
    isAuthVerified && 
    formData.password.length >= 4 && 
    isPasswordMatch && 
    isValidName && 
    formData.phoneNumber.length >= 10 && 
    isAllAgreed;

  // ==============================================================

  // 타이머 로직
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAuthSent && !isAuthVerified && timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isAuthSent, isAuthVerified, timer]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 🔥 [추가] 약관 동의 핸들러
  const handleAgreeAll = () => {
    const newValue = !isAllAgreed;
    setAgreements({ terms: newValue, privacy: newValue });
  };

  const handleAgreeItem = (name: 'terms' | 'privacy') => {
    setAgreements({ ...agreements, [name]: !agreements[name] });
  };

  // 이메일 인증번호 전송 로직
  const handleSendAuth = async () => {
    if (!formData.email) return alert("이메일을 입력해주세요.");
    if (!formData.email.includes("@")) return alert("올바른 이메일 형식이 아닙니다.");
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/email/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: formData.email }),
        });

        if (res.ok) {
            setIsAuthSent(true);
            setTimer(180);
            alert("인증번호가 메일로 발송되었습니다.\n이메일을 확인해주세요!");
        } else {
            alert("메일 전송 실패: 이미 가입된 이메일이거나 서버 오류입니다.");
        }
    } catch (e) {
        alert("서버 연결 오류 (GCP 서버 상태를 확인해주세요)");
    }
  };

  // 이메일 인증번호 확인 로직
  const handleVerifyAuth = async () => {
    if (!formData.authCode) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/email/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                email: formData.email,
                code: formData.authCode 
            }),
        });

        if (res.ok) {
            setIsAuthVerified(true);
            alert("이메일 인증이 완료되었습니다.");
        } else {
            alert("인증번호가 일치하지 않습니다.");
        }
    } catch (e) {
        alert("인증 오류 발생");
    }
  };

  // 최종 회원가입 요청 로직
  const handleSignup = async () => {
    if (!isFormValid) return alert("입력 정보와 약관 동의를 다시 확인해주세요.");

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            nickname: formData.name, // 백엔드 DTO에 맞게 name을 nickname으로 매핑
            phoneNumber: formData.phoneNumber
        }),
      });

      if (res.ok) {
        alert("환영합니다! POP-SPOT 회원가입이 완료되었습니다.");
        router.push("/login");
      } else {
        const msg = await res.text();
        alert("가입 실패: " + msg);
      }
    } catch (e) {
      alert("서버 오류가 발생했습니다.");
    }
  };

  // 시간 포맷 (03:00)
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center py-8 md:py-10 px-4">
      {/* 헤더 */}
      <div className="w-full max-w-[460px] flex items-center mb-8 md:mb-10 relative">
        <button onClick={() => router.back()} className="absolute left-0 p-1 md:p-2 text-gray-400 hover:text-white">
            <ChevronLeft className="w-6 h-6 md:w-7 md:h-7" />
        </button>
        <div className="w-full text-center cursor-pointer" onClick={() => router.push("/")}>
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter italic">
                POP<span className="text-indigo-500">-</span>SPOT
            </h1>
        </div>
      </div>

      <div className="w-full max-w-[460px] space-y-4 md:space-y-5 px-1 md:px-0">
        
        {/* 1. 이메일 (인증 기능 포함) */}
        <div className="flex flex-col gap-1.5 md:gap-2">
            <label className="text-[11px] md:text-sm font-bold text-gray-400">이메일 (아이디)</label>
            <div className="flex gap-2">
                <div className="flex-1 bg-gray-900 border border-gray-700 focus-within:border-indigo-500 rounded-md px-2.5 py-2.5 md:px-3 md:py-3 transition-colors">
                    <input 
                        name="email" 
                        type="email" 
                        onChange={handleChange} 
                        disabled={isAuthVerified}
                        className={`w-full bg-transparent outline-none text-white text-xs md:text-sm placeholder-gray-600 ${isAuthVerified ? 'text-gray-500' : ''}`}
                        placeholder="예: popspot@gmail.com"
                    />
                </div>
                <button 
                    onClick={handleSendAuth}
                    disabled={isAuthVerified}
                    className={`px-3 md:px-4 rounded-md text-xs md:text-sm font-bold whitespace-nowrap transition-colors ${
                        isAuthVerified 
                        ? 'bg-gray-800 text-indigo-400 border border-indigo-900' 
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                >
                    {isAuthVerified ? "인증완료" : "인증하기"}
                </button>
            </div>

            {/* 인증번호 입력칸 */}
            {isAuthSent && !isAuthVerified && (
                <div className="flex gap-2 mt-1 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex-1 bg-gray-900 border border-gray-700 px-2.5 py-2.5 md:px-3 md:py-3 flex justify-between items-center focus-within:border-indigo-500 rounded-md">
                        <input 
                            name="authCode" 
                            type="text" 
                            placeholder="인증번호 6자리" 
                            onChange={handleChange}
                            className="bg-transparent outline-none text-white text-xs md:text-sm w-full placeholder-gray-600"
                        />
                        <span className="text-indigo-400 text-[10px] md:text-xs ml-2 font-mono">{formatTime(timer)}</span>
                    </div>
                    <button 
                        onClick={handleVerifyAuth}
                        className="bg-white text-black px-4 md:px-6 rounded-md text-xs md:text-sm font-bold hover:bg-gray-200 transition-colors shrink-0"
                    >
                        확인
                    </button>
                </div>
            )}
        </div>

        {/* 2. 비밀번호 (🔥 눈알 아이콘 추가) */}
        <div className="flex flex-col gap-1.5 md:gap-2">
            <label className="text-[11px] md:text-sm font-bold text-gray-400">비밀번호</label>
            <div className="relative bg-gray-900 border border-gray-700 focus-within:border-indigo-500 rounded-md px-2.5 py-2.5 md:px-3 md:py-3">
                <input 
                    name="password" 
                    type={showPassword ? "text" : "password"} 
                    onChange={handleChange} 
                    className="w-full bg-transparent outline-none text-white text-xs md:text-sm placeholder-gray-600 pr-8"
                    placeholder="4자 이상 입력해주세요"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">
                    {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
            </div>
        </div>

        {/* 3. 비밀번호 확인 (🔥 실시간 일치 UI 추가) */}
        <div className="flex flex-col gap-1.5 md:gap-2">
            <label className="text-[11px] md:text-sm font-bold text-gray-400">비밀번호 확인</label>
            <div className={`relative bg-gray-900 border rounded-md px-2.5 py-2.5 md:px-3 md:py-3 transition-colors ${
                isPasswordMismatch ? "border-red-500" : isPasswordMatch ? "border-green-500" : "border-gray-700 focus-within:border-indigo-500"
            }`}>
                <input 
                    name="passwordConfirm" 
                    type={showPasswordConfirm ? "text" : "password"} 
                    onChange={handleChange} 
                    className="w-full bg-transparent outline-none text-white text-xs md:text-sm placeholder-gray-600 pr-8"
                    placeholder="비밀번호를 한 번 더 입력해주세요"
                />
                <button type="button" onClick={() => setShowPasswordConfirm(!showPasswordConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">
                    {showPasswordConfirm ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
            </div>
            {isPasswordMismatch && <p className="text-[10px] md:text-xs text-red-500 flex items-center gap-1"><XCircle size={12}/> 비밀번호가 일치하지 않습니다.</p>}
            {isPasswordMatch && <p className="text-[10px] md:text-xs text-green-500 flex items-center gap-1"><CheckCircle2 size={12}/> 비밀번호가 일치합니다.</p>}
        </div>

        {/* 4. 이름 (🔥 실시간 규칙 검사 UI 추가) */}
        <div className="flex flex-col gap-1.5 md:gap-2 pt-1 md:pt-2">
            <label className="text-[11px] md:text-sm font-bold text-gray-400">이름 (닉네임)</label>
            <div className={`bg-gray-900 border rounded-md px-2.5 py-2.5 md:px-3 md:py-3 transition-colors ${
                formData.name.length > 0 && !isValidName ? "border-red-500" : "border-gray-700 focus-within:border-indigo-500"
            }`}>
                <input 
                    name="name" 
                    type="text" 
                    maxLength={8}
                    onChange={handleChange} 
                    className="w-full bg-transparent outline-none text-white text-xs md:text-sm placeholder-gray-600"
                    placeholder="특수문자 제외 2~8글자"
                />
            </div>
            {formData.name.length > 0 && (
                isValidName 
                ? <p className="text-[10px] md:text-xs text-green-500 flex items-center gap-1"><CheckCircle2 size={12}/> 사용 가능한 이름입니다.</p>
                : <p className="text-[10px] md:text-xs text-red-500 flex items-center gap-1"><XCircle size={12}/> 한글, 영문, 숫자 2~8자리만 가능합니다.</p>
            )}
        </div>

        {/* 5. 생년월일 (기존 유지) */}
        <div className="flex flex-col gap-1.5 md:gap-2 pt-1 md:pt-2">
            <label className="text-[11px] md:text-sm font-bold text-gray-400">생년월일</label>
            <div className="flex gap-2">
                <div className="bg-gray-900 border border-gray-700 px-2.5 py-2.5 md:px-3 md:py-3 flex-[1.5] md:flex-1 focus-within:border-indigo-500 rounded-md">
                    <input name="birthdate" type="text" placeholder="년(4자)" maxLength={4} className="w-full bg-transparent outline-none text-white text-xs md:text-sm placeholder-gray-600" />
                </div>
                <div className="bg-gray-900 border border-gray-700 px-1 md:px-3 py-2.5 md:py-3 w-[72px] md:w-1/4 focus-within:border-indigo-500 rounded-md shrink-0">
                    <select className="w-full bg-gray-900 outline-none text-white text-xs md:text-sm appearance-none text-center">
                        <option>월</option>
                        {[...Array(12)].map((_, i) => <option key={i}>{i + 1}</option>)}
                    </select>
                </div>
                <div className="bg-gray-900 border border-gray-700 px-2.5 py-2.5 md:px-3 md:py-3 flex-1 focus-within:border-indigo-500 rounded-md">
                    <input type="text" placeholder="일" maxLength={2} className="w-full bg-transparent outline-none text-white text-xs md:text-sm placeholder-gray-600 text-center" />
                </div>
            </div>
        </div>

        {/* 6. 성별 (기존 유지) */}
        <div className="flex flex-col gap-1.5 md:gap-2">
            <label className="text-[11px] md:text-sm font-bold text-gray-400">성별</label>
            <div className="flex bg-gray-900 rounded-md overflow-hidden border border-gray-700">
                <button 
                    onClick={() => setFormData({...formData, gender: 'M'})}
                    className={`flex-1 py-2.5 md:py-3 text-xs md:text-sm font-medium transition-all ${
                        formData.gender === 'M' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-500 hover:text-gray-300'
                    }`}
                >
                    남자
                </button>
                <div className="w-[1px] bg-gray-700"></div>
                <button 
                    onClick={() => setFormData({...formData, gender: 'F'})}
                    className={`flex-1 py-2.5 md:py-3 text-xs md:text-sm font-medium transition-all ${
                        formData.gender === 'F' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-500 hover:text-gray-300'
                    }`}
                >
                    여자
                </button>
            </div>
        </div>

        {/* 7. 휴대전화 (기존 유지) */}
        <div className="flex flex-col gap-1.5 md:gap-2 pt-1 md:pt-2">
            <label className="text-[11px] md:text-sm font-bold text-gray-400">휴대전화</label>
            <div className="flex gap-2">
                <input 
                    name="phoneNumber" 
                    type="text" 
                    placeholder="전화번호 입력 (- 제외)" 
                    onChange={handleChange}
                    className="w-full bg-gray-900 border border-gray-700 px-2.5 py-2.5 md:px-3 md:py-3 text-white text-xs md:text-sm outline-none focus:border-indigo-500 rounded-md placeholder-gray-600" 
                />
            </div>
        </div>

        {/* 🔥 8. 필수 약관 동의 (신규 추가) */}
        <div className="bg-gray-900 p-4 rounded-md border border-gray-700 space-y-3 mt-6">
            <label className="flex items-center gap-3 cursor-pointer pb-3 border-b border-gray-800">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isAllAgreed ? "bg-indigo-600 border-indigo-600" : "border-gray-500"}`}>
                    {isAllAgreed && <Check size={12} className="text-white"/>}
                </div>
                <span className="font-bold text-sm text-white">전체 약관에 동의합니다.</span>
                <input type="checkbox" className="hidden" checked={isAllAgreed} onChange={handleAgreeAll}/>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${agreements.terms ? "bg-indigo-600 border-indigo-600" : "border-gray-500"}`}>
                    {agreements.terms && <Check size={10} className="text-white"/>}
                </div>
                <span className="text-xs text-gray-400">[필수] POP-SPOT 서비스 이용약관 동의</span>
                <input type="checkbox" className="hidden" checked={agreements.terms} onChange={() => handleAgreeItem('terms')}/>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${agreements.privacy ? "bg-indigo-600 border-indigo-600" : "border-gray-500"}`}>
                    {agreements.privacy && <Check size={10} className="text-white"/>}
                </div>
                <span className="text-xs text-gray-400">[필수] 개인정보 수집 및 이용 동의</span>
                <input type="checkbox" className="hidden" checked={agreements.privacy} onChange={() => handleAgreeItem('privacy')}/>
            </label>
        </div>

        {/* 9. 가입 버튼 (🔥 모든 조건 충족 시에만 활성화) */}
        <button 
            onClick={handleSignup}
            className={`w-full font-bold text-sm md:text-lg py-3.5 md:py-4 mt-6 rounded-md transition-all shadow-lg ${
                isFormValid
                ? "bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-900/20"
                : "bg-gray-800 text-gray-500 cursor-not-allowed"
            }`}
            disabled={!isFormValid}
        >
            POP-SPOT 시작하기
        </button>

      </div>
    </div>
  );
}