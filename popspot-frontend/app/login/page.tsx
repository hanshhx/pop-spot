'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Lock, MessageCircle, Eye, EyeOff, Check, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Logo } from '@/components/layout/Logo';

import { apiFetch, API_BASE_URL } from '@/lib/api';
import { setAuthToken } from '@/lib/authStorage';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { notify, notifyError, notifySuccess } from '@/lib/notify';
import { GUEST_GRACE_PERIOD_DAYS, startGuestMode } from '@/lib/guestMode';
import { useLocale } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';

export default function LoginPage() {
  const router = useRouter();
  const { t, locale } = useLocale();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [saveId, setSaveId] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 저장된 아이디 자동 입력
  useEffect(() => {
    const savedEmail = localStorage.getItem('savedEmail');
    if (savedEmail) {
      setFormData((prev) => ({ ...prev, email: savedEmail }));
      setSaveId(true);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleLogin();
  };

  const handleLogin = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();
        // 토큰은 localStorage 에 남기지 않는다 — setAuthToken 이 sessionStorage 로만 보관한다.
        // 응답을 통째로 저장하면 data.token 이 localStorage['user'] 안에 그대로 남아
        // v2.40 의 sessionStorage 이관이 이메일 로그인 경로에서만 무효가 된다(소셜 콜백은 이미 골라 저장).
        const { token, ...profile } = data;
        localStorage.setItem('user', JSON.stringify(profile));
        if (token) setAuthToken(token);
        if (saveId) localStorage.setItem('savedEmail', formData.email);
        else localStorage.removeItem('savedEmail');

        await notifySuccess(`${data.nickname}${t('login.welcomeSuffix')}`);
        // 인트로 미들웨어 우회 — 방금 인트로 거쳐서 로그인 왔으니 메인 직행
        router.push(localizedPath('/?entered=1', locale));
      } else {
        notifyError({ title: t('login.failedTitle'), text: t('login.failedText') });
      }
    } catch {
      notifyError({ title: t('login.serverTitle'), text: t('login.serverText') });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    localStorage.setItem('popspot:oauth-locale', locale);
    window.location.href = `${API_BASE_URL}/oauth2/authorization/${provider}`;
  };

  /**
   * 게스트로 둘러보기 시작 — 명시적 opt-in.
   *
   * <p>이 버튼을 눌러야만 7일 카운터가 돌기 시작한다. 인트로 자동 시작 (v2.6 까지) 폐기 후의 정상 진입점.
   * 안내 토스트로 사용자에게 D-{@link GUEST_GRACE_PERIOD_DAYS} 카운트다운이 시작됨을 알리고 메인으로 이동.
   */
  const handleGuestLogin = async () => {
    startGuestMode();
    await notify({
      icon: 'info',
      title: `${t('login.guestPrefix')} ${GUEST_GRACE_PERIOD_DAYS}${t('login.guestSuffix')}`,
      text: t('login.guestDesc'),
      timer: 1600,
    });
    router.push(localizedPath('/?entered=1', locale));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-ink-900">
      {/* 배경 비디오 */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover z-0 opacity-60 motion-reduce:hidden"
      >
        <source
          src="/login-bg-v2.mp4"
          type="video/mp4"
          media="(min-width: 768px) and (prefers-reduced-motion: no-preference)"
        />
      </video>

      {/* 어두운 막 */}
      <div className="absolute inset-0 bg-ink-900/60 z-0" aria-hidden />

      {/* 라임 글로우 */}
      <div
        aria-hidden
        className="absolute bottom-[-15%] left-[-10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-lime-300/15 rounded-full blur-[100px] z-0 pointer-events-none"
      />

      {/* 로그인 박스 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-ink-800/80 backdrop-blur-xl border border-cream-200/10 p-6 md:p-8 rounded-xl shadow-pop relative z-10"
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="absolute top-4 left-4 size-8 inline-flex items-center justify-center text-cream-200/60 hover:text-cream-200 transition-colors"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>

        <h1 className="flex justify-center mt-4 mb-1">
          <Logo className="h-7 md:h-8 text-cream-200" />
        </h1>
        <p className="text-center text-cream-200/60 text-sm mb-8">{t('login.welcome')}</p>

        <div className="space-y-4">
          <Field label={<span className="text-cream-200">{t('login.email')}</span>}>
            <Input
              name="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              iconLeft={<Mail className="size-4" aria-hidden />}
              autoComplete="email"
              className="bg-ink-900/60 border-cream-200/15 text-cream-200 placeholder:text-cream-200/30"
            />
          </Field>

          <Field label={<span className="text-cream-200">{t('login.password')}</span>}>
            <Input
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder={t('login.passwordPlaceholder')}
              value={formData.password}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              iconLeft={<Lock className="size-4" aria-hidden />}
              iconRight={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                  className="text-cream-200/50 hover:text-cream-200 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </button>
              }
              autoComplete="current-password"
              className="bg-ink-900/60 border-cream-200/15 text-cream-200 placeholder:text-cream-200/30"
            />
          </Field>
        </div>

        <div className="flex justify-between items-center mt-4 mb-6">
          <label className="flex items-center gap-2 cursor-pointer group select-none">
            <input
              type="checkbox"
              className="sr-only"
              checked={saveId}
              onChange={() => setSaveId(!saveId)}
            />
            <span
              aria-hidden
              className={`size-4 rounded border flex items-center justify-center transition-colors ${
                saveId
                  ? 'bg-lime-300 border-lime-300'
                  : 'border-cream-200/30 group-hover:border-cream-200/60 bg-ink-900/60'
              }`}
            >
              {saveId && <Check className="size-3 text-ink-900" aria-hidden />}
            </span>
            <span className="text-xs text-cream-200/60 group-hover:text-cream-200 transition-colors">
              {t('login.saveId')}
            </span>
          </label>

          <Link
            href={localizedPath('/find-account', locale)}
            className="text-xs text-cream-200/60 hover:text-cream-200 transition-colors"
          >
            {t('login.findAccount')}
          </Link>
        </div>

        <Button variant="primary" size="lg" block onClick={handleLogin} loading={submitting}>
          {t('login.submit')}
        </Button>

        <div className="relative flex py-4 items-center">
          <div className="flex-grow border-t border-cream-200/10" />
          <span className="flex-shrink-0 mx-4 text-cream-200/40 text-xs">{t('login.social')}</span>
          <div className="flex-grow border-t border-cream-200/10" />
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => handleSocialLogin('kakao')}
            className="w-full h-11 rounded-pill font-semibold bg-[#FEE500] text-ink-900 hover:bg-[#FDD835] transition-colors flex items-center justify-center gap-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FEE500] focus-visible:ring-offset-2 focus-visible:ring-offset-ink-800"
          >
            <MessageCircle className="size-4" fill="currentColor" aria-hidden />
            <span>{t('login.kakao')}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSocialLogin('naver')}
            className="w-full h-11 rounded-pill font-semibold bg-[#03C75A] text-white hover:bg-[#02b351] transition-colors flex items-center justify-center gap-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#03C75A] focus-visible:ring-offset-2 focus-visible:ring-offset-ink-800"
          >
            <span className="font-extrabold text-lg" aria-hidden>
              N
            </span>
            <span>{t('login.naver')}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSocialLogin('google')}
            className="w-full h-11 rounded-pill font-semibold bg-white text-ink-900 hover:bg-cream-300 transition-colors flex items-center justify-center gap-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream-200 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-800"
          >
            <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span>{t('login.google')}</span>
          </button>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleGuestLogin}
            className="w-full h-11 rounded-pill font-semibold bg-transparent text-cream-200 border border-cream-200/25 hover:bg-cream-200/8 hover:border-cream-200/45 transition-colors flex items-center justify-center gap-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-800"
            aria-label={`${t('login.guestPrefix')} ${GUEST_GRACE_PERIOD_DAYS}${t('login.guestSuffix')}`}
          >
            <Clock className="size-4" aria-hidden />
            <span>
              {t('login.guestPrefix')} {GUEST_GRACE_PERIOD_DAYS}
              {t('login.guestSuffix')}
            </span>
          </button>
          <p className="mt-2 text-center text-[11px] text-cream-200/45">{t('login.guestDesc')}</p>
        </div>

        <div className="mt-6 text-center text-sm">
          <span className="text-cream-200/50">{t('login.notMember')}</span>{' '}
          <Link
            href={localizedPath('/signup', locale)}
            className="font-semibold text-lime-300 hover:text-lime-400 transition-colors"
          >
            {t('auth.signup')}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
