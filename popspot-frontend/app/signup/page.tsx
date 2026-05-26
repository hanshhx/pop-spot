"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Check,
  ExternalLink,
} from "lucide-react";
import Swal from "sweetalert2";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";

// 이메일 인증번호 유효 시간 카운트다운의 틱 주기 (1초).
const COUNTDOWN_TICK_MS = 1000;

// 생년월일 select 옵션 — 만 14세 이상 가입 정책에 맞춰 현재 연도 - 14 까지만 노출.
const CURRENT_YEAR = new Date().getFullYear();
const MIN_BIRTH_YEAR = 1930;
const MAX_BIRTH_YEAR = CURRENT_YEAR - 14;
const BIRTH_YEAR_OPTIONS: number[] = Array.from(
  { length: MAX_BIRTH_YEAR - MIN_BIRTH_YEAR + 1 },
  (_, i) => MAX_BIRTH_YEAR - i,
);
const BIRTH_MONTH_OPTIONS: number[] = Array.from({ length: 12 }, (_, i) => i + 1);
const BIRTH_DAY_OPTIONS: number[] = Array.from({ length: 31 }, (_, i) => i + 1);

interface BirthSelectProps {
  ariaLabel: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  options: number[];
  suffix: string;
}

/** 생년월일 연/월/일 공용 select — 다크 테마 + suffix 부착. */
function BirthSelect({
  ariaLabel,
  placeholder,
  value,
  onChange,
  options,
  suffix,
}: BirthSelectProps) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-md px-2 bg-ink-800 border border-cream-200/15 text-cream-200 text-sm text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <option value="" className="bg-ink-800 text-cream-200/60">
        {placeholder}
      </option>
      {options.map((n) => (
        <option key={n} value={n} className="bg-ink-800 text-cream-200">
          {n}
          {suffix}
        </option>
      ))}
    </select>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  /** 인트로/메인에서 게스트 7일 만료 후 강제 리다이렉트된 경우 안내 배너를 띄운다. */
  const guestExpired = searchParams.get("reason") === "guest_expired";

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

  /**
   * v2.20 — 봇 차단 honeypot.
   *
   * <p>가벼운 봇은 모든 input 을 채워서 제출한다. 시각적으로 숨긴 honeypot 필드 (실제 사용자는
   * 채울 수 없음) 가 비어 있으면 사람, 채워져 있으면 봇으로 간주. 외부 reCAPTCHA 없이도 일반
   * 봇 90% 차단 가능. 정교한 봇은 못 막지만 외부 의존성 0 으로 가장 가벼운 트레이드오프.
   */
  const [honeypot, setHoneypot] = useState("");
  const formMountAtRef = useRef<number>(Date.now());

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  // 생년월일 — 세 개의 select 를 분리 보관했다가 제출 직전 ISO 문자열로 합친다.
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");

  // 셋 다 선택되면 YYYY-MM-DD 형태로 formData.birthdate 동기화.
  useEffect(() => {
    if (birthYear && birthMonth && birthDay) {
      const mm = String(birthMonth).padStart(2, "0");
      const dd = String(birthDay).padStart(2, "0");
      setFormData((prev) => ({ ...prev, birthdate: `${birthYear}-${mm}-${dd}` }));
    } else {
      setFormData((prev) => ({ ...prev, birthdate: "" }));
    }
  }, [birthYear, birthMonth, birthDay]);

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
  const isValidBirthdate = formData.birthdate !== "";
  const isAllAgreed = agreements.terms && agreements.privacy;

  const isFormValid =
    isAuthVerified &&
    isValidPassword &&
    isPasswordMatch &&
    isValidName &&
    isValidBirthdate &&
    isValidPhone &&
    isAllAgreed;

  // 인증번호 카운트다운 — 1초 단위로 timer 감소.
  useEffect(() => {
    if (!isAuthSent || isAuthVerified || timer <= 0) return;
    const interval = setInterval(() => setTimer((p) => p - 1), COUNTDOWN_TICK_MS);
    return () => clearInterval(interval);
  }, [isAuthSent, isAuthVerified, timer]);

  /**
   * 입력 필드별 sanitization.
   *
   * <p>이메일은 ASCII 만 (한글 입력 차단), 휴대전화는 숫자만 (붙여넣기 시에도 다른 문자 strip).
   * 사용자 입장에선 "잘못된 키를 누르면 무시" 처럼 자연스럽게 동작.
   */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    let sanitized = value;
    if (name === "email") {
      // 이메일은 ASCII 외 문자 (한글 등) 제거 — 유효성 검사 이전에 입력 단에서 막음.
      sanitized = value.replace(/[^\x20-\x7E]/g, "");
    } else if (name === "phoneNumber") {
      // 휴대전화는 숫자만 — 붙여넣기로 들어온 하이픈/공백도 제거.
      sanitized = value.replace(/\D/g, "");
    }
    setFormData({ ...formData, [name]: sanitized });
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
    // v2.20 — 봇 차단 honeypot.
    //  1. 숨김 필드가 채워져 있으면 봇 (사람은 못 봄)
    //  2. 폼 mount 부터 3초 미만이면 봇 (사람은 입력에 최소 수십 초)
    if (honeypot.length > 0 || Date.now() - formMountAtRef.current < 3000) {
      // 메시지 노출 없이 조용히 실패 처리 — 진짜 봇이면 실패 사실 자체를 숨김.
      await Swal.fire({
        icon: "info",
        title: "잠시 후 다시 시도해 주세요",
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
          text:
            "회원가입이 완료되었습니다. 로그인 후 헤더의 프로필을 눌러" +
            " 닉네임과 프로필 사진을 변경하실 수 있습니다.",
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
    <div className="min-h-screen bg-ink-900 dark:bg-ink-900 text-cream-200 flex flex-col items-center py-8 md:py-10 px-4">
      {/* v2.17 — 폼 내부 색상 클래스는 다크 디자인 의도 유지 (login 과 일관). 향후 v2.18 라운드에서
          시스템 테마 토큰화 검토. */}
      {/* 헤더 */}
      <div className="w-full max-w-[460px] md:max-w-[540px] flex items-center mb-10 relative">
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

      {guestExpired && (
        <div className="w-full max-w-[460px] md:max-w-[540px] mb-6 rounded-2xl bg-lime-300/15 ring-1 ring-lime-300/40 px-5 py-4">
          <p className="font-bold text-lime-300 mb-1">7일 무료 체험이 끝났어요</p>
          <p className="text-sm leading-relaxed text-cream-200/85">
            계속 POP-SPOT 을 이용하시려면 회원가입을 해주세요. 30초면 끝나요.
          </p>
        </div>
      )}

      <div className="w-full max-w-[460px] md:max-w-[540px] space-y-5">
        {/* v2.20 — Honeypot 봇 차단 필드 (시각적으로 숨김, autocomplete 차단). 사람은 못 채움. */}
        <input
          type="text"
          name="company-website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="absolute -left-[9999px] w-0 h-0 opacity-0 pointer-events-none"
          aria-hidden="true"
        />

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
                {/* state-icon 컨벤션 — 눈 뜸 = 현재 보이는 상태, 눈 감김 = 현재 가려진 상태. */}
                {showPassword ? (
                  <Eye className="size-4" aria-hidden />
                ) : (
                  <EyeOff className="size-4" aria-hidden />
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
                {/* state-icon — 눈 뜸 = 현재 보이는 상태, 눈 감김 = 현재 가려진 상태. */}
                {showPasswordConfirm ? (
                  <Eye className="size-4" aria-hidden />
                ) : (
                  <EyeOff className="size-4" aria-hidden />
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

        {/* 생년월일 — 연 / 월 / 일 모두 select 로 통일 (유효성 사전 차단 + 입력 일관성). */}
        <Field label={<span className="text-cream-200/70">생년월일</span>}>
          <div className="grid grid-cols-3 gap-2">
            <BirthSelect
              ariaLabel="연도"
              placeholder="연도"
              value={birthYear}
              onChange={setBirthYear}
              options={BIRTH_YEAR_OPTIONS}
              suffix="년"
            />
            <BirthSelect
              ariaLabel="월"
              placeholder="월"
              value={birthMonth}
              onChange={setBirthMonth}
              options={BIRTH_MONTH_OPTIONS}
              suffix="월"
            />
            <BirthSelect
              ariaLabel="일"
              placeholder="일"
              value={birthDay}
              onChange={setBirthDay}
              options={BIRTH_DAY_OPTIONS}
              suffix="일"
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
          <p className="text-xs text-cream-200/60 pb-2 leading-relaxed">
            POP-SPOT 은 <strong className="text-cream-200">만 14세 이상</strong>만 가입할 수 있습니다.
            가입을 진행하면 본인이 만 14세 이상임을 확인한 것으로 봅니다.
          </p>
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
            {
              key: "terms" as const,
              label: "[필수] POP-SPOT 서비스 이용약관",
              href: "/terms",
            },
            {
              key: "privacy" as const,
              label: "[필수] 개인정보 수집 및 이용 (만 14세 이상)",
              href: "/privacy",
            },
          ].map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-3"
            >
              {/* 체크박스 + 라벨은 클릭 시 동의 토글 */}
              <label className="flex items-center gap-3 cursor-pointer select-none flex-1 min-w-0">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={agreements[item.key]}
                  onChange={() => handleAgreeItem(item.key)}
                />
                <span
                  aria-hidden
                  className={`size-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                    agreements[item.key]
                      ? "bg-lime-300 border-lime-300"
                      : "border-cream-200/30"
                  }`}
                >
                  {agreements[item.key] && (
                    <Check className="size-2.5 text-ink-900" />
                  )}
                </span>
                <span className="text-xs text-cream-200/60 truncate">
                  {item.label}
                </span>
              </label>

              {/* 약관 본문 새 탭으로 — "동의 전 열람" 절차 보장 */}
              <Link
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 text-[11px] text-cream-200/50 hover:text-lime-300 transition-colors underline underline-offset-2"
                aria-label={`${item.label} 보기 (새 탭)`}
              >
                보기
                <ExternalLink className="size-2.5" aria-hidden />
              </Link>
            </div>
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
