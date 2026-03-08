"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Eye, EyeOff, CheckCircle2, XCircle, Check } from "lucide-react";

import { API_BASE_URL } from "../../src/lib/api"; 

export default function SignupPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    email: "",       
    password: "",
    passwordConfirm: "",
    name: "",
    birthdate: "",
    gender: "M", 
    phoneNumber: "", 
    authCode: "",    
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const [isAuthSent, setIsAuthSent] = useState(false);     
  const [isAuthVerified, setIsAuthVerified] = useState(false);
  const [timer, setTimer] = useState(180); 

  const [agreements, setAgreements] = useState({
    terms: false,
    privacy: false
  });

  // ================= [🔥 실시간 유효성 검사 로직 (백엔드 동기화)] =================
  
  // 🔥 [83번 임의 수정] 이메일 정규식 검사 추가
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);

  // 🔥 [84번 임의 수정] 백엔드 규칙과 동일하게 영문, 숫자, 특수문자 조합 8~20자 강제
  const isValidPassword = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,20}$/.test(formData.password);

  // 2. 비밀번호 일치 검사
  const isPasswordMatch = formData.password !== "" && formData.password === formData.passwordConfirm;
  const isPasswordMismatch = formData.passwordConfirm !== "" && formData.password !== formData.passwordConfirm;

  // 1. 닉네임(이름) 검사
  const isValidName = /^[a-zA-Z0-9가-힣]{2,8}$/.test(formData.name);

  // 🔥 [82번 임의 수정] 010으로 시작하는 11자리 숫자 강제
  const isValidPhone = /^010\d{8}$/.test(formData.phoneNumber);

  // 3. 약관 전체 동의 여부
  const isAllAgreed = agreements.terms && agreements.privacy;

  // 4. 전체 폼 유효성 (모든 조건이 true여야만 가입 버튼 활성화)
  const isFormValid = 
    isAuthVerified && 
    isValidPassword && 
    isPasswordMatch && 
    isValidName && 
    isValidPhone && 
    isAllAgreed;

  // ==============================================================

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

  const handleAgreeAll = () => {
    const newValue = !isAllAgreed;
    setAgreements({ terms: newValue, privacy: newValue });
  };

  const handleAgreeItem = (name: 'terms' | 'privacy') => {
    setAgreements({ ...agreements, [name]: !agreements[name] });
  };

  const handleSendAuth = async () => {
    if (!formData.email) return alert("이메일을 입력해주세요.");
    // 🔥 [83번 임의 수정] 정규식을 통과하지 못한 이메일은 전송 시도조차 막습니다.
    if (!isValidEmail) return alert("올바른 이메일 형식이 아닙니다.");
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/email/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: formData.email }),
        });

        if (res.ok) {
            setIsAuthSent(true);
            setTimer(300); // 🔥 [백엔드 동기화] 백엔드의 Redis 5분(300초)과 타이머를 맞춥니다.
            alert("인증번호가 메일로 발송되었습니다.\n이메일을 확인해주세요!");
        } else {
            alert("메일 전송 실패: 이미 가입된 이메일이거나 서버 오류입니다.");
        }
    } catch (e) {
        alert("서버 연결 오류 (GCP 서버 상태를 확인해주세요)");
    }
  };

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

  const handleSignup = async () => {
    if (!isFormValid) return alert("입력 정보와 약관 동의를 다시 확인해주세요.");

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            nickname: formData.name, 
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
        
        {/* 1. 이메일 */}
        <div className="flex flex-col gap-1.5 md:gap-2">
            <label className="text-[11px] md:text-sm font-bold text-gray-400">이메일 (아이디)</label>
            <div className="flex gap-2">
                {/* 🔥 [83번 임의 수정] 이메일 형식이 틀리면 테두리가 빨갛게 변하도록 UI 피드백 추가 */}
                <div className={`flex-1 bg-gray-900 border transition-colors rounded-md px-2.5 py-2.5 md:px-3 md:py-3 ${
                    formData.email.length > 0 && !isValidEmail && !isAuthVerified ? "border-red-500" : "border-gray-700 focus-within:border-indigo-500"
                }`}>
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
            {/* 이메일 에러 메시지 */}
            {formData.email.length > 0 && !isValidEmail && !isAuthVerified && (
                <p className="text-[10px] md:text-xs text-red-500 flex items-center gap-1"><XCircle size={12}/> 올바른 이메일 형식이 아닙니다.</p>
            )}

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

        {/* 2. 비밀번호 */}
        <div className="flex flex-col gap-1.5 md:gap-2">
            <label className="text-[11px] md:text-sm font-bold text-gray-400">비밀번호</label>
            {/* 🔥 [84번 임의 수정] 강도 조건 미달 시 빨간 테두리 피드백 */}
            <div className={`relative bg-gray-900 border rounded-md px-2.5 py-2.5 md:px-3 md:py-3 transition-colors ${
                formData.password.length > 0 && !isValidPassword ? "border-red-500" : "border-gray-700 focus-within:border-indigo-500"
            }`}>
                <input 
                    name="password" 
                    type={showPassword ? "text" : "password"} 
                    onChange={handleChange} 
                    className="w-full bg-transparent outline-none text-white text-xs md:text-sm placeholder-gray-600 pr-8"
                    placeholder="영문, 숫자, 특수문자 포함 8~20자"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">
                    {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
            </div>
            {/* 🔥 [84번 임의 수정] 조건 불충족 시 에러 메시지 렌더링 */}
            {formData.password.length > 0 && (
                isValidPassword 
                ? <p className="text-[10px] md:text-xs text-green-500 flex items-center gap-1"><CheckCircle2 size={12}/> 안전한 비밀번호입니다.</p>
                : <p className="text-[10px] md:text-xs text-red-500 flex items-center gap-1"><XCircle size={12}/> 영문, 숫자, 특수문자를 포함해 8~20자로 입력해주세요.</p>
            )}
        </div>

        {/* 3. 비밀번호 확인 */}
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

        {/* 4. 이름 (닉네임) */}
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

        {/* 5. 생년월일 */}
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

        {/* 6. 성별 */}
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

        {/* 7. 휴대전화 */}
        <div className="flex flex-col gap-1.5 md:gap-2 pt-1 md:pt-2">
            <label className="text-[11px] md:text-sm font-bold text-gray-400">휴대전화</label>
            {/* 🔥 [82번 임의 수정] 전화번호 형식 불일치 시 UI 피드백 적용 */}
            <div className={`flex gap-2 bg-gray-900 border rounded-md px-2.5 py-2.5 md:px-3 md:py-3 transition-colors ${
                formData.phoneNumber.length > 0 && !isValidPhone ? "border-red-500" : "border-gray-700 focus-within:border-indigo-500"
            }`}>
                <input 
                    name="phoneNumber" 
                    type="text" 
                    placeholder="01012345678 (- 제외)" 
                    onChange={handleChange}
                    className="w-full bg-transparent text-white text-xs md:text-sm outline-none placeholder-gray-600" 
                />
            </div>
            {/* 전화번호 에러 메시지 */}
            {formData.phoneNumber.length > 0 && (
                isValidPhone 
                ? <p className="text-[10px] md:text-xs text-green-500 flex items-center gap-1"><CheckCircle2 size={12}/> 올바른 전화번호 형식입니다.</p>
                : <p className="text-[10px] md:text-xs text-red-500 flex items-center gap-1"><XCircle size={12}/> 010으로 시작하는 11자리 숫자만 입력 가능합니다.</p>
            )}
        </div>

        {/* 8. 약관 동기화 */}
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

        {/* 9. 가입 버튼 */}
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