'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Eye, EyeOff, CheckCircle2, XCircle, Check, ExternalLink } from 'lucide-react';
import Swal from 'sweetalert2';

import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { useLocale } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';
import { fetchPolicyVersions } from '@/lib/policyVersions';

// 이메일 인증번호 유효 시간 카운트다운의 틱 주기 (1초).
const COUNTDOWN_TICK_MS = 1000;

export default function SignupPage() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const searchParams = useSearchParams();
  /** 인트로/메인에서 게스트 7일 만료 후 강제 리다이렉트된 경우 안내 배너를 띄운다. */
  const guestExpired = searchParams.get('reason') === 'guest_expired';

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    name: '',
    phoneNumber: '',
    authCode: '',
  });

  /**
   * v2.20 — 봇 차단 honeypot.
   *
   * <p>가벼운 봇은 모든 input 을 채워서 제출한다. 시각적으로 숨긴 honeypot 필드 (실제 사용자는
   * 채울 수 없음) 가 비어 있으면 사람, 채워져 있으면 봇으로 간주. 외부 reCAPTCHA 없이도 일반
   * 봇 90% 차단 가능. 정교한 봇은 못 막지만 외부 의존성 0 으로 가장 가벼운 트레이드오프.
   */
  const [honeypot, setHoneypot] = useState('');
  const formMountAtRef = useRef<number>(Date.now());

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const [isAuthSent, setIsAuthSent] = useState(false);
  const [isAuthVerified, setIsAuthVerified] = useState(false);
  const [timer, setTimer] = useState(180);

  const [agreements, setAgreements] = useState({
    age: false,
    terms: false,
    privacy: false,
  });

  // 실시간 유효성 검사
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
  const isValidPassword = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,20}$/.test(
    formData.password,
  );
  const isPasswordMatch =
    formData.password !== '' && formData.password === formData.passwordConfirm;
  const isPasswordMismatch =
    formData.passwordConfirm !== '' && formData.password !== formData.passwordConfirm;
  const isValidName = /^[a-zA-Z0-9가-힣]{2,8}$/.test(formData.name);
  const isValidPhone = /^010\d{8}$/.test(formData.phoneNumber);
  const isAllAgreed = agreements.age && agreements.terms && agreements.privacy;

  const isFormValid =
    isAuthVerified &&
    isValidPassword &&
    isPasswordMatch &&
    isValidName &&
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
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let sanitized = value;
    if (name === 'email') {
      // 이메일은 ASCII 외 문자 (한글 등) 제거 — 유효성 검사 이전에 입력 단에서 막음.
      sanitized = value.replace(/[^\x20-\x7E]/g, '');
    } else if (name === 'phoneNumber') {
      // 휴대전화는 숫자만 — 붙여넣기로 들어온 하이픈/공백도 제거.
      sanitized = value.replace(/\D/g, '');
    }
    setFormData({ ...formData, [name]: sanitized });
  };

  const handleAgreeAll = () => {
    const v = !isAllAgreed;
    setAgreements({ age: v, terms: v, privacy: v });
  };

  const handleAgreeItem = (name: 'age' | 'terms' | 'privacy') => {
    setAgreements({ ...agreements, [name]: !agreements[name] });
  };

  const handleSendAuth = async () => {
    if (!formData.email) {
      Swal.fire({ icon: 'warning', title: t('signup.enterEmail') });
      return;
    }
    if (!isValidEmail) {
      Swal.fire({ icon: 'warning', title: t('signup.invalidEmail') });
      return;
    }

    try {
      const res = await apiFetch('/api/v1/auth/email/send', {
        method: 'POST',
        body: JSON.stringify({ email: formData.email }),
      });
      if (res.ok) {
        setIsAuthSent(true);
        setTimer(300); // Redis 5분
        Swal.fire({
          icon: 'success',
          title: t('signup.sentTitle'),
          text: t('signup.checkInbox'),
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: t('signup.sendFailed'),
          text: t('signup.sendFailedText'),
        });
      }
    } catch {
      Swal.fire({ icon: 'error', title: t('signup.connectionError') });
    }
  };

  const handleVerifyAuth = async () => {
    if (!formData.authCode) return;
    try {
      const res = await apiFetch('/api/v1/auth/email/verify', {
        method: 'POST',
        body: JSON.stringify({
          email: formData.email,
          code: formData.authCode,
          purpose: 'SIGNUP',
        }),
      });
      if (res.ok) {
        setIsAuthVerified(true);
        Swal.fire({
          icon: 'success',
          title: t('signup.verifiedTitle'),
          showConfirmButton: false,
          timer: 1200,
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: t('signup.verifyFailed'),
          text: t('signup.codeMismatch'),
        });
      }
    } catch {
      Swal.fire({ icon: 'error', title: t('signup.verifyError') });
    }
  };

  const handleSignup = async () => {
    if (!isFormValid) {
      Swal.fire({
        icon: 'warning',
        title: t('signup.checkForm'),
        text: t('signup.checkFormText'),
      });
      return;
    }
    // v2.20 — 봇 차단 honeypot.
    //  1. 숨김 필드가 채워져 있으면 봇 (사람은 못 봄)
    //  2. 폼 mount 부터 3초 미만이면 봇 (사람은 입력에 최소 수십 초)
    if (honeypot.length > 0 || Date.now() - formMountAtRef.current < 3000) {
      // 메시지 노출 없이 조용히 실패 처리 — 진짜 봇이면 실패 사실 자체를 숨김.
      await Swal.fire({
        icon: 'info',
        title: t('signup.retry'),
      });
      return;
    }
    // 지금 공개된 정책 버전을 서버에 물어 그대로 되돌려 보낸다. 화면에 버전을 박아 두면
    // 배포 순서가 어긋나는 순간 신규 가입이 전부 실패한다 — 서버가 자기 버전과 정확히
    // 일치할 때만 통과시키기 때문이다.
    const versions = await fetchPolicyVersions();
    if (!versions) {
      await Swal.fire({
        icon: 'error',
        title: t('signup.retry'),
        text: '약관 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
      });
      return;
    }

    try {
      const res = await apiFetch('/api/v1/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          nickname: formData.name,
          phoneNumber: formData.phoneNumber,
          age14OrOlder: agreements.age,
          termsAccepted: agreements.terms,
          privacyAccepted: agreements.privacy,
          termsVersion: versions.termsVersion,
          privacyVersion: versions.privacyVersion,
        }),
      });
      if (res.ok) {
        await Swal.fire({
          icon: 'success',
          title: t('signup.welcome'),
          text: t('signup.completeText'),
          confirmButtonText: t('signup.goLogin'),
        });
        router.push(localizedPath('/login', locale));
      } else {
        const msg = await res.text();
        Swal.fire({ icon: 'error', title: t('signup.failed'), text: msg });
      }
    } catch {
      Swal.fire({ icon: 'error', title: t('signup.serverError') });
    }
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${m}:${s < 10 ? `0${s}` : s}`;
  };

  return (
    <div className="min-h-screen bg-background dark:bg-background text-foreground flex flex-col items-center py-8 md:py-10 px-4">
      {/* v2.17 — 폼 내부 색상 클래스는 다크 디자인 의도 유지 (login 과 일관). 향후 v2.18 라운드에서
          시스템 테마 토큰화 검토. */}
      {/* 헤더 */}
      <div className="w-full max-w-[460px] md:max-w-[540px] flex items-center mb-10 relative">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="absolute left-0 size-8 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => router.push(localizedPath('/', locale))}
          className="w-full text-center"
        >
          <h1 className="font-display-en text-2xl md:text-3xl font-extrabold tracking-tighter">
            POP-SPOT<span className="text-lime-300">.</span>
          </h1>
        </button>
      </div>

      {guestExpired && (
        <div className="w-full max-w-[460px] md:max-w-[540px] mb-6 rounded-2xl bg-lime-300/15 ring-1 ring-lime-300/40 px-5 py-4">
          <p className="font-bold text-lime-300 mb-1">{t('signup.guestExpiredTitle')}</p>
          <p className="text-sm leading-relaxed text-foreground">{t('signup.guestExpiredText')}</p>
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
          label={<span className="text-muted-foreground">{t('signup.email')}</span>}
          error={
            formData.email.length > 0 && !isValidEmail && !isAuthVerified ? (
              <span className="flex items-center gap-1">
                <XCircle className="size-3" /> {t('signup.emailInvalid')}
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
              invalid={formData.email.length > 0 && !isValidEmail && !isAuthVerified}
              autoComplete="email"
              className="flex-1 bg-surface border-[var(--color-border)] text-foreground placeholder:text-subtle-foreground"
            />
            <Button
              type="button"
              variant={isAuthVerified ? 'outline' : 'primary'}
              size="md"
              onClick={handleSendAuth}
              disabled={isAuthVerified}
              className="shrink-0"
            >
              {isAuthVerified ? t('signup.verified') : t('signup.verify')}
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
                placeholder={t('signup.codePlaceholder')}
                onChange={handleChange}
                inputMode="numeric"
                maxLength={6}
                className="bg-surface border-[var(--color-border)] text-foreground placeholder:text-subtle-foreground pr-16"
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
              {t('signup.confirm')}
            </Button>
          </div>
        )}

        {/* 비밀번호 */}
        <Field
          label={<span className="text-muted-foreground">{t('signup.password')}</span>}
          error={
            formData.password.length > 0 && !isValidPassword ? (
              <span className="flex items-center gap-1">
                <XCircle className="size-3" /> {t('signup.passwordRule')}
              </span>
            ) : undefined
          }
          helper={
            formData.password.length > 0 && isValidPassword ? (
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 className="size-3" /> {t('signup.passwordSafe')}
              </span>
            ) : undefined
          }
        >
          <Input
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder={t('signup.passwordPlaceholder')}
            value={formData.password}
            onChange={handleChange}
            invalid={formData.password.length > 0 && !isValidPassword}
            autoComplete="new-password"
            className="bg-surface border-[var(--color-border)] text-foreground placeholder:text-subtle-foreground"
            iconRight={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                className="text-muted-foreground hover:text-foreground transition-colors"
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
          label={<span className="text-muted-foreground">{t('signup.passwordConfirm')}</span>}
          error={
            isPasswordMismatch ? (
              <span className="flex items-center gap-1">
                <XCircle className="size-3" /> {t('signup.passwordMismatch')}
              </span>
            ) : undefined
          }
          helper={
            isPasswordMatch ? (
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 className="size-3" /> {t('signup.passwordMatch')}
              </span>
            ) : undefined
          }
        >
          <Input
            name="passwordConfirm"
            type={showPasswordConfirm ? 'text' : 'password'}
            placeholder={t('signup.passwordConfirmPlaceholder')}
            value={formData.passwordConfirm}
            onChange={handleChange}
            invalid={isPasswordMismatch}
            autoComplete="new-password"
            className="bg-surface border-[var(--color-border)] text-foreground placeholder:text-subtle-foreground"
            iconRight={
              <button
                type="button"
                onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                aria-label={showPasswordConfirm ? t('login.hidePassword') : t('login.showPassword')}
                className="text-muted-foreground hover:text-foreground transition-colors"
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
          label={<span className="text-muted-foreground">{t('signup.name')}</span>}
          error={
            formData.name.length > 0 && !isValidName ? (
              <span className="flex items-center gap-1">
                <XCircle className="size-3" /> {t('signup.nameRule')}
              </span>
            ) : undefined
          }
          helper={
            formData.name.length > 0 && isValidName ? (
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 className="size-3" /> {t('signup.nameAvailable')}
              </span>
            ) : undefined
          }
        >
          <Input
            name="name"
            type="text"
            maxLength={8}
            placeholder={t('signup.namePlaceholder')}
            value={formData.name}
            onChange={handleChange}
            invalid={formData.name.length > 0 && !isValidName}
            className="bg-surface border-[var(--color-border)] text-foreground placeholder:text-subtle-foreground"
          />
        </Field>

        {/* 휴대전화 */}
        <Field
          label={<span className="text-muted-foreground">{t('signup.phone')}</span>}
          error={
            formData.phoneNumber.length > 0 && !isValidPhone ? (
              <span className="flex items-center gap-1">
                <XCircle className="size-3" /> {t('signup.phoneRule')}
              </span>
            ) : undefined
          }
          helper={
            formData.phoneNumber.length > 0 && isValidPhone ? (
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 className="size-3" /> {t('signup.phoneValid')}
              </span>
            ) : undefined
          }
        >
          <Input
            name="phoneNumber"
            type="text"
            placeholder="01012345678"
            value={formData.phoneNumber}
            onChange={handleChange}
            invalid={formData.phoneNumber.length > 0 && !isValidPhone}
            inputMode="numeric"
            maxLength={11}
            autoComplete="tel"
            className="bg-surface border-[var(--color-border)] text-foreground placeholder:text-subtle-foreground"
          />
        </Field>

        {/* 약관 동의 */}
        <div className="bg-surface p-4 rounded-md border border-[var(--color-border)] space-y-3 mt-6">
          <label className="flex items-center gap-3 cursor-pointer pb-3 border-b border-[var(--color-border)] select-none">
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
                  ? 'bg-lime-300 border-lime-300'
                  : 'border-[var(--color-border)] bg-background'
              }`}
            >
              {isAllAgreed && <Check className="size-3 text-ink-900" />}
            </span>
            <span className="font-bold text-sm text-foreground">{t('signup.agreeAll')}</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              className="sr-only"
              checked={agreements.age}
              onChange={() => handleAgreeItem('age')}
            />
            <span
              aria-hidden
              className={`size-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                agreements.age ? 'bg-lime-300 border-lime-300' : 'border-[var(--color-border)]'
              }`}
            >
              {agreements.age && <Check className="size-2.5 text-ink-900" />}
            </span>
            <span className="text-xs text-muted-foreground">{t('signup.ageNotice')}</span>
          </label>

          {[
            {
              key: 'terms' as const,
              label: t('signup.termsRequired'),
              href: localizedPath('/terms', locale),
            },
            {
              key: 'privacy' as const,
              label: t('signup.privacyRequired'),
              href: localizedPath('/privacy', locale),
            },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-3">
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
                      ? 'bg-lime-300 border-lime-300'
                      : 'border-[var(--color-border)]'
                  }`}
                >
                  {agreements[item.key] && <Check className="size-2.5 text-ink-900" />}
                </span>
                <span className="text-xs text-muted-foreground truncate">{item.label}</span>
              </label>

              {/* 약관 본문 새 탭으로 — "동의 전 열람" 절차 보장 */}
              <Link
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-lime-300 transition-colors underline underline-offset-2"
                aria-label={`${item.label} — ${t('signup.viewNewTab')}`}
              >
                {t('signup.view')}
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
          {t('signup.start')}
        </Button>
      </div>
    </div>
  );
}
