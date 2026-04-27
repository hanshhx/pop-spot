"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Check,
} from "lucide-react";
import Swal from "sweetalert2";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";

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
    privacy: false,
  });

  // 실시간 유효성 검사
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
  const isValidPassword =
    /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,20}$/.test(
      formData.password
    );
  const isPasswordMatch =
    formData.password !== "" &&
    formData.password === formData.passwordConfirm;
  const isPasswordMismatch =
    formData.passwordConfirm !== "" &&
    formData.password !== formData.passwordConfirm;
  const isValidName = /^[a-zA-Z0-9가-힣]{2,8}$/.test(formData.name);
  const isValidPhone = /^010\d{8}$/.test(formData.phoneNumber);
  const isAllAgreed = agreements.terms && agreements.privacy;

  const isFormValid =
    isAuthVerified &&
    isValidPassword &&
    isPasswordMatch &&
    isValidName &&
    isValidPhone &&
    isAllAgreed;

  // 인증번호 카운트다운
  useEffect(() => {
    if (!isAuthSent || isAuthVerified || timer <= 0) return;
    const interval = setInterval(() => setTimer((p) => p - 1), 1000);
    return () => clearInterval(interval);
  }, [isAuthSent, isAuthVerified, timer]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAgreeAll = () => {
    const v = !isAllAgreed;
    setAgreements({ terms: v, privacy: v });
  };

  const handleAgreeItem = (name: "terms" | "privacy") => {
    setAgreements({ ...agreements, [name]: !agreements[name] });
  };

  const handleSendAuth = async () => {
    if (!formData.email) {
      Swal.fire({ icon: "warning", title: "이메일을 입력해주세요" });
      return;
    }
    if (!isValidEmail) {
      Swal.fire({ icon: "warning", title: "이메일 형식이 올바르지 않습니다" });
      return;
    }

    try {
      const res = await apiFetch("/api/v1/auth/email/send", {
        method: "POST",
        body: JSON.stringify({ email: formData.email }),
      });
      if (res.ok) {
        setIsAuthSent(true);
        setTimer(300); // Redis 5분
        Swal.fire({
          icon: "success",
          title: "인증번호 발송 완료",
          text: "메일함을 확인해주세요.",
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "메일 전송 실패",
          text: "이미 가입된 이메일이거나 서버 오류입니다.",
        });
      }
    } catch {
      Swal.fire({ icon: "error", title: "서버 연결 오류" });
    }
  };

  const handleVerifyAuth = async () => {
    if (!formData.authCode) return;
    try {
      const res = await apiFetch("/api/v1/auth/email/verify", {
        method: "POST",
        body: JSON.stringify({
          email: formData.email,
          code: formData.authCode,
        }),
      });
      if (res.ok) {
        setIsAuthVerified(true);
        Swal.fire({
          icon: "success",
          title: "이메일 인증 완료",
          showConfirmButton: false,
          timer: 1200,
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "인증 실패",
          text: "인증번호가 일치하지 않습니다.",
        });
      }
    } catch {
      Swal.fire({ icon: "error", title: "인증 오류" });
    }
  };

  const handleSignup = async () => {
    if (!isFormValid) {
      Swal.fire({
        icon: "warning",
        title: "입력 정보를 확인해주세요",
        text: "필수 약관 동의와 인증을 완료해주세요.",
      });
      return;
    }
    try {
      const res = await apiFetch("/api/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          nickname: formData.name,
          phoneNumber: formData.phoneNumber,
        }),
      });
      if (res.ok) {
        await Swal.fire({
          icon: "success",
          title: "환영합니다",
          text: "회원가입이 완료되었습니다.",
          confirmButtonText: "로그인하러 가기",
        });
        router.push("/login");
      } else {
        const msg = await res.text();
        Swal.fire({ icon: "error", title: "가입 실패", text: msg });
      }
    } catch {
      Swal.fire({ icon: "error", title: "서버 오류가 발생했습니다" });
    }
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${m}:${s < 10 ? `0${s}` : s}`;
  };

  return (
    <div className="min-h-screen bg-ink-900 text-cream-200 flex flex-col items-center py-8 md:py-10 px-4">
      {/* 헤더 */}
      <div className="w-full max-w-[460px] flex items-center mb-10 relative">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="뒤로가기"
          className="absolute left-0 size-8 inline-flex items-center justify-center text-cream-200/60 hover:text-cream-200 transition-colors"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="w-full text-center"
        >
          <h1 className="font-display-en text-2xl md:text-3xl font-extrabold tracking-tighter">
            POP-SPOT<span className="text-lime-300">.</span>
          </h1>
        </button>
      </div>

      <div className="w-full max-w-[460px] space-y-5">
        {/* 이메일 */}
        <Field
          label={<span className="text-cream-200/70">이메일 (아이디)</span>}
          error={
            formData.email.length > 0 && !isValidEmail && !isAuthVerified ? (
              <span className="flex items-center gap-1">
                <XCircle className="size-3" /> 올바른 이메일 형식이 아닙니다.
              </span>
            ) : undefined
          }
        >
          <div className="flex gap-2">
            <Input
              name="email"
              type="email"
              placeholder="popspot@gmail.com"
              value={formData.email}
              onChange={handleChange}
              disabled={isAuthVerified}
              invalid={
                formData.email.length > 0 && !isValidEmail && !isAuthVerified
              }
              autoComplete="email"
              className="flex-1 bg-ink-800 border-cream-200/15 text-cream-200 placeholder:text-cream-200/30"
            />
            <Button
              type="button"
              variant={isAuthVerified ? "outline" : "primary"}
              size="md"
              onClick={handleSendAuth}
              disabled={isAuthVerified}
              className="shrink-0"
            >
              {isAuthVerified ? "인증완료" : "인증하기"}
            </Button>
          </div>
        </Field>

        {/* 인증번호 입력 */}
        {isAuthSent && !isAuthVerified && (
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                name="authCode"
                type="text"
                placeholder="인증번호 6자리"
                onChange={handleChange}
                inputMode="numeric"
                maxLength={6}
                className="bg-ink-800 border-cream-200/15 text-cream-200 placeholder:text-cream-200/30 pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-lime-300">
                {formatTime(timer)}
              </span>
            </div>
            <Button
              type="button"
              variant="ink"
              size="md"
              onClick={handleVerifyAuth}
              className="shrink-0"
            >
              확인
            </Button>
          </div>
        )}

        {/* 비밀번호 */}
        <Field
          label={<span className="text-cream-200/70">비밀번호</span>}
          error={
            formData.password.length > 0 && !isValidPassword ? (
              <span className="flex items-center gap-1">
                <XCircle className="size-3" /> 영문, 숫자, 특수문자를 포함해 8~20자로 입력해주세요.
              </span>
            ) : undefined
          }
          helper={
            formData.password.length > 0 && isValidPassword ? (
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 className="size-3" /> 안전한 비밀번호입니다.
              </span>
            ) : undefined
          }
        >
          <Input
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="영문, 숫자, 특수문자 포함 8~20자"
            value={formData.password}
            onChange={handleChange}
            invalid={formData.password.length > 0 && !isValidPassword}
            autoComplete="new-password"
            className="bg-ink-800 border-cream-200/15 text-cream-200 placeholder:text-cream-200/30"
            iconRight={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                className="text-cream-200/50 hover:text-cream-200 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            }
          />
        </Field>

        {/* 비밀번호 확인 */}
        <Field
          label={<span className="text-cream-200/70">비밀번호 확인</span>}
          error={
            isPasswordMismatch ? (
              <span className="flex items-center gap-1">
                <XCircle className="size-3" /> 비밀번호가 일치하지 않습니다.
              </span>
            ) : undefined
          }
          helper={
            isPasswordMatch ? (
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 className="size-3" /> 비밀번호가 일치합니다.
              </span>
            ) : undefined
          }
        >
          <Input
            name="passwordConfirm"
            type={showPasswordConfirm ? "text" : "password"}
            placeholder="비밀번호를 한 번 더 입력해주세요"
            value={formData.passwordConfirm}
            onChange={handleChange}
            invalid={isPasswordMismatch}
            autoComplete="new-password"
            className="bg-ink-800 border-cream-200/15 text-cream-200 placeholder:text-cream-200/30"
            iconRight={
              <button
                type="button"
                onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                aria-label={
                  showPasswordConfirm ? "비밀번호 숨기기" : "비밀번호 보기"
                }
                className="text-cream-200/50 hover:text-cream-200 transition-colors"
              >
                {showPasswordConfirm ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            }
          />
        </Field>

        {/* 이름 (닉네임) */}
        <Field
          label={<span className="text-cream-200/70">이름 (닉네임)</span>}
          error={
            formData.name.length > 0 && !isValidName ? (
              <span className="flex items-center gap-1">
                <XCircle className="size-3" /> 한글, 영문, 숫자 2~8자리만 가능합니다.
              </span>
            ) : undefined
          }
          helper={
            formData.name.length > 0 && isValidName ? (
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 className="size-3" /> 사용 가능한 이름입니다.
              </span>
            ) : undefined
          }
        >
          <Input
            name="name"
            type="text"
            maxLength={8}
            placeholder="특수문자 제외 2~8글자"
            value={formData.name}
            onChange={handleChange}
            invalid={formData.name.length > 0 && !isValidName}
            className="bg-ink-800 border-cream-200/15 text-cream-200 placeholder:text-cream-200/30"
          />
        </Field>

        {/* 생년월일 */}
        <Field label={<span className="text-cream-200/70">생년월일</span>}>
          <div className="flex gap-2">
            <Input
              name="birthdate"
              type="text"
              placeholder="2000"
              maxLength={4}
              inputMode="numeric"
              className="flex-[1.5] bg-ink-800 border-cream-200/15 text-cream-200 placeholder:text-cream-200/30"
            />
            <select
              aria-label="월"
              className="h-11 w-20 rounded-md px-2 bg-ink-800 border border-cream-200/15 text-cream-200 text-sm text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option className="bg-ink-800 text-cream-200">월</option>
              {[...Array(12)].map((_, i) => (
                <option key={i} className="bg-ink-800 text-cream-200">
                  {i + 1}
                </option>
              ))}
            </select>
            <Input
              type="text"
              placeholder="일"
              maxLength={2}
              inputMode="numeric"
              className="flex-1 text-center bg-ink-800 border-cream-200/15 text-cream-200 placeholder:text-cream-200/30"
            />
          </div>
        </Field>

        {/* 성별 — 토글 */}
        <Field label={<span className="text-cream-200/70">성별</span>}>
          <div
            className="inline-flex w-full rounded-md overflow-hidden border border-cream-200/15 bg-ink-800"
            role="radiogroup"
            aria-label="성별"
          >
            {[
              { v: "M", label: "남자" },
              { v: "F", label: "여자" },
            ].map((g) => {
              const active = formData.gender === g.v;
              return (
                <button
                  key={g.v}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setFormData({ ...formData, gender: g.v })}
                  className={`flex-1 h-11 text-sm font-medium transition-colors ${
                    active
                      ? "bg-lime-300 text-ink-900 font-semibold"
                      : "text-cream-200/60 hover:text-cream-200"
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </Field>

        {/* 휴대전화 */}
        <Field
          label={<span className="text-cream-200/70">휴대전화</span>}
          error={
            formData.phoneNumber.length > 0 && !isValidPhone ? (
              <span className="flex items-center gap-1">
                <XCircle className="size-3" /> 010으로 시작하는 11자리 숫자만 입력 가능합니다.
              </span>
            ) : undefined
          }
          helper={
            formData.phoneNumber.length > 0 && isValidPhone ? (
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 className="size-3" /> 올바른 전화번호 형식입니다.
              </span>
            ) : undefined
          }
        >
          <Input
            name="phoneNumber"
            type="text"
            placeholder="01012345678 (- 제외)"
            value={formData.phoneNumber}
            onChange={handleChange}
            invalid={formData.phoneNumber.length > 0 && !isValidPhone}
            inputMode="numeric"
            maxLength={11}
            autoComplete="tel"
            className="bg-ink-800 border-cream-200/15 text-cream-200 placeholder:text-cream-200/30"
          />
        </Field>

        {/* 약관 동의 */}
        <div className="bg-ink-800 p-4 rounded-md border border-cream-200/15 space-y-3 mt-6">
          <label className="flex items-center gap-3 cursor-pointer pb-3 border-b border-cream-200/10 select-none">
            <input
              type="checkbox"
              className="sr-only"
              checked={isAllAgreed}
              onChange={handleAgreeAll}
            />
            <span
              aria-hidden
              className={`size-5 rounded-pill border flex items-center justify-center transition-colors ${
                isAllAgreed
                  ? "bg-lime-300 border-lime-300"
                  : "border-cream-200/30 bg-ink-900"
              }`}
            >
              {isAllAgreed && <Check className="size-3 text-ink-900" />}
            </span>
            <span className="font-bold text-sm text-cream-200">
              전체 약관에 동의합니다
            </span>
          </label>

          {[
            { key: "terms" as const, label: "[필수] POP-SPOT 서비스 이용약관" },
            { key: "privacy" as const, label: "[필수] 개인정보 수집 및 이용" },
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-center gap-3 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={agreements[item.key]}
                onChange={() => handleAgreeItem(item.key)}
              />
              <span
                aria-hidden
                className={`size-4 rounded border flex items-center justify-center transition-colors ${
                  agreements[item.key]
                    ? "bg-lime-300 border-lime-300"
                    : "border-cream-200/30"
                }`}
              >
                {agreements[item.key] && (
                  <Check className="size-2.5 text-ink-900" />
                )}
              </span>
              <span className="text-xs text-cream-200/60">{item.label}</span>
            </label>
          ))}
        </div>

        {/* 가입 버튼 */}
        <Button
          variant="primary"
          size="lg"
          block
          onClick={handleSignup}
          disabled={!isFormValid}
          className="mt-6"
        >
          POP-SPOT 시작하기
        </Button>
      </div>
    </div>
  );
}
