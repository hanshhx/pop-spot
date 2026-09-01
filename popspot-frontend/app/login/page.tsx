'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Lock, MessageCircle, Eye, EyeOff, Check, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Logo } from '@/components/layout/Logo';

import { apiFetch, API_BASE_URL } from '@/lib/api';
import { setAuthToken, setRefreshToken } from '@/lib/authStorage';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { notify, notifyError, notifySuccess } from '@/lib/notify';
import { GUEST_GRACE_PERIOD_DAYS, startGuestMode } from '@/lib/guestMode';
import { useLocale } from '@/lib/i18n';
import { appReturnUrl, clearAppFlowCookie, startedByApp } from '@/lib/oauthAppFlow';
import { localizedPath } from '@/lib/localePath';
import { TotpChallenge } from '@/features/auth/TotpChallenge';
import { useTheme } from 'next-themes';
import { useSeason } from '@/lib/seasonContext';
import { seasonBackground } from '@/lib/seasonVideo';

export default function LoginPage() {
  const router = useRouter();
  const { t, locale } = useLocale();

  /* 배경 영상은 홈과 같은 규칙을 따른다 — 계절 × 라이트/다크.
     resolvedTheme 은 마운트 전 undefined 라 그때는 다크로 본다. 여기서는 홈처럼 게이트를 두지
     않는데, 이 영상은 opacity 0.6 로 베일 아래 깔리는 장식이라 잠깐 어긋나도 눈에 띄지 않고,
     로그인 화면은 첫 페인트가 늦어지는 편이 더 나쁘기 때문이다. */
  const { resolvedTheme } = useTheme();
  const season = useSeason();
  const bg = seasonBackground(season, resolvedTheme !== 'light');

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [saveId, setSaveId] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /**
   * 앱에서 시작한 소셜 로그인이 <b>실패해서</b> 여기로 온 경우 — 앱에 알려 주고 끝낸다.
   *
   * <p>백엔드는 성공만 {@code /oauth/callback} 으로 보낸다. 사용자가 카카오 동의 화면에서 취소하거나
   * 토큰 교환이 실패하면 스프링의 {@code failureUrl} 이 <b>이 페이지</b>로 보낸다
   * ({@code SecurityConfig.buildOAuthFailureUrl} → {@code /login?error}). 그러면 앱은 브라우저를
   * 열어 둔 채 영영 아무 소식도 못 듣는다 — 화면에 "로그인 중" 만 돈다.
   *
   * <p>앱 표시가 없으면 <b>아무 일도 하지 않는다.</b> 웹 로그인은 한 글자도 달라지지 않는다.
   */
  useEffect(() => {
    if (!startedByApp()) return;
    clearAppFlowCookie();
    window.location.replace(appReturnUrl({ error: 'denied' }));
  }, []);

  // 저장된 아이디 자동 입력
  useEffect(() => {
    const savedEmail = localStorage.getItem('savedEmail');
    if (savedEmail) {
      setFormData((prev) => ({ ...prev, email: savedEmail }));
      setSaveId(true);
    }
  }, []);

  /** 2단계 인증이 남았을 때 받은 단기 표. 값이 있으면 6자리 화면을 띄운다. */
  const [totpChallenge, setTotpChallenge] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleLogin();
  };

  /*
   * 장애 판정을 이유로 <b>미리 막지 않는다.</b> 눌렀으면 보낸다.
   *
   * <p>예전에는 여기서 시도 자체를 거부했다. 그런데 그 판정은 502 한 번으로 걸리고, 그 502 의 원인은
   * 서버가 아니라 Vercel 함수가 백엔드 주소를 못 푸는 몇 분짜리 구간이었다. 그 사이 사용자는
   * 서버에 닿아 보지도 못한 채 "지금은 안 됩니다" 만 받았다 — 실제로 "인증 거부가 자꾸 뜬다" 는
   * 신고가 이것이었다.
   *
   * <p>보내 보면 셋 중 하나로 끝난다. 성공하거나, 진짜 인증 실패를 받거나, 게이트웨이 오류를 받는다.
   * 셋 다 지금 상태를 근거로 미리 단정하는 것보다 정확하다. 끊긴 구간이라면 api.ts 가 즉시 끊어
   * 주므로 오래 기다리지도 않는다.
   */
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

        // 2단계 인증이 남았으면 토큰이 없다. 6자리 화면으로 넘어간다.
        if (data.totpRequired) {
          setTotpChallenge(data.challengeToken);
          return;
        }
        // 토큰은 localStorage 에 남기지 않는다 — setAuthToken 이 sessionStorage 로만 보관한다.
        // 응답을 통째로 저장하면 data.token 이 localStorage['user'] 안에 그대로 남아
        // v2.40 의 sessionStorage 이관이 이메일 로그인 경로에서만 무효가 된다(소셜 콜백은 이미 골라 저장).
        const { token, refreshToken, ...profile } = data;
        localStorage.setItem('user', JSON.stringify(profile));
        if (token) setAuthToken(token);
        // 관리자 접근 토큰은 30분짜리다. 이게 없으면 30분마다 튕긴다.
        if (refreshToken) setRefreshToken(refreshToken);
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

  /**
   * 소셜 로그인 시작.
   *
   * <p><b>왜 먼저 두드려 보는가.</b> 이 흐름은 {@code window.location.href} 로 <b>브라우저를 통째로
   * 백엔드에 넘긴다.</b> 그래서 백엔드가 안 떠 있으면 사용자는 우리 화면이 아니라 게이트웨이가 뱉는
   * 날것의 <b>502 Bad Gateway</b> 페이지에 착지한다 — 무엇이 잘못됐는지도, 어디로 돌아가야 할지도
   * 알 수 없고 우리 쪽엔 기록도 남지 않는다.
   *
   * <p>{@link apiFetch} 는 게이트웨이 오류를 두 번까지 다시 보내므로, 순간 장애면 여기서 조용히
   * 흡수되고 그대로 진행된다. 진짜로 내려가 있으면 우리 화면에서 한국어로 알린다.
   *
   * <p>확인에 쓰는 것은 <b>공개 엔드포인트</b>다. 인증이 필요한 곳을 두드리면 401 이 정상 응답이라
   * "살아 있음" 과 구분되지 않는다.
   */
  const handleSocialLogin = async (provider: string) => {
    // 여기도 장애 판정으로 미리 막지 않는다(근거는 handleLogin 주석). 바로 아래에서 공개
    // 엔드포인트를 한 번 두드려 보므로, 정말 못 닿는 상태면 그 결과로 알게 된다 — 추측이 아니라.
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/popups/trending');
      if (!res.ok && res.status >= 500) throw new Error(`backend ${res.status}`);
    } catch {
      setSubmitting(false);
      notifyError({ title: t('login.serverTitle'), text: t('login.serverText') });
      return;
    }
    localStorage.setItem('popspot:oauth-locale', locale);
    /* 앱에서 시작하다 만 흐름의 표시가 남아 있으면 이 웹 로그인이 앱으로 튕긴다. 여기서 지운다
       (콜백도 읽자마자 지우지만, 콜백까지 못 간 채 끝난 경우가 있다). */
    clearAppFlowCookie();
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      {/* 배경 — 홈과 같은 계절 자료를 쓴다.
          예전에는 야경 한 편이 박혀 있어서, 라이트로 바꿔도 이 화면만 한밤중이었다.
          계절에 따라 영상일 수도 정지 화면일 수도 있다(가름은 lib/seasonVideo.ts 의 STILL_PATTERN).
          key 를 주는 이유: src 만 갈아 끼우면 브라우저가 다시 읽지 않는다. */}
      {bg.still ? (
        // eslint-disable-next-line @next/next/no-img-element -- 화면을 채우는 장식 배경이라 next/image 의 레이아웃·최적화가 필요 없다
        <img
          key={bg.src}
          src={bg.src}
          alt=""
          aria-hidden
          className="absolute inset-0 z-0 hidden h-full w-full object-cover opacity-60 md:block"
        />
      ) : (
        <video
          key={bg.src}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-60 motion-reduce:hidden"
        >
          <source
            src={bg.src}
            type="video/mp4"
            media="(min-width: 768px) and (prefers-reduced-motion: no-preference)"
          />
        </video>
      )}

      {/* 영상 위 베일. 색이 계절 바탕색이라 라이트에서는 밝게, 다크에서는 어둡게 덮인다 —
          한 값으로 두면 라이트 화면에 검은 막이 씌워진다. */}
      <div
        className="absolute inset-0 z-0 bg-[color-mix(in_srgb,var(--color-background)_62%,transparent)]"
        aria-hidden
      />

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
        className="w-full max-w-md bg-surface/85 backdrop-blur-xl border border-[var(--color-border)] p-6 md:p-8 rounded-xl shadow-pop relative z-10"
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="absolute top-4 left-4 size-8 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>

        <h1 className="flex justify-center mt-4 mb-1">
          <Logo className="h-7 md:h-8 text-foreground" />
        </h1>
        <p className="text-center text-muted-foreground text-sm mb-8">{t('login.welcome')}</p>

        {/* 2단계 인증이 남았으면 카드 안을 6자리 화면으로 바꾼다 — 페이지를 옮기지 않는 이유는
            표가 5분짜리라 뒤로가기·새로고침으로 잃기 쉽기 때문이다. */}
        {totpChallenge ? (
          <TotpChallenge
            challengeToken={totpChallenge}
            onSuccess={async (profile) => {
              localStorage.setItem('user', JSON.stringify(profile));
              if (saveId) localStorage.setItem('savedEmail', formData.email);
              else localStorage.removeItem('savedEmail');
              await notifySuccess(`${profile.nickname ?? ''}${t('login.welcomeSuffix')}`);
              router.push(localizedPath('/?entered=1', locale));
            }}
          />
        ) : (
          <>
            <div className="space-y-4">
              <Field label={<span className="text-foreground">{t('login.email')}</span>}>
                <Input
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  iconLeft={<Mail className="size-4" aria-hidden />}
                  autoComplete="email"
                  className="bg-background/60 border-[var(--color-border)] text-foreground placeholder:text-subtle-foreground"
                />
              </Field>

              <Field label={<span className="text-foreground">{t('login.password')}</span>}>
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
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" aria-hidden />
                      ) : (
                        <Eye className="size-4" aria-hidden />
                      )}
                    </button>
                  }
                  autoComplete="current-password"
                  className="bg-background/60 border-[var(--color-border)] text-foreground placeholder:text-subtle-foreground"
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
                      : 'border-[var(--color-border)] group-hover:border-[var(--color-border-strong)] bg-background/60'
                  }`}
                >
                  {saveId && <Check className="size-3 text-ink-900" aria-hidden />}
                </span>
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                  {t('login.saveId')}
                </span>
              </label>

              <Link
                href={localizedPath('/find-account', locale)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('login.findAccount')}
              </Link>
            </div>

            <Button variant="primary" size="lg" block onClick={handleLogin} loading={submitting}>
              {t('login.submit')}
            </Button>

            <div className="relative flex py-4 items-center">
              <div className="flex-grow border-t border-[var(--color-border)]" />
              <span className="flex-shrink-0 mx-4 text-subtle-foreground text-xs">
                {t('login.social')}
              </span>
              <div className="flex-grow border-t border-[var(--color-border)]" />
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleSocialLogin('kakao')}
                className="w-full h-11 rounded-pill font-semibold bg-[#FEE500] text-ink-900 hover:bg-[#FDD835] transition-colors flex items-center justify-center gap-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FEE500] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <MessageCircle className="size-4" fill="currentColor" aria-hidden />
                <span>{t('login.kakao')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSocialLogin('naver')}
                className="w-full h-11 rounded-pill font-semibold bg-[#03C75A] text-white hover:bg-[#02b351] transition-colors flex items-center justify-center gap-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#03C75A] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="font-extrabold text-lg" aria-hidden>
                  N
                </span>
                <span>{t('login.naver')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSocialLogin('google')}
                className="w-full h-11 rounded-pill font-semibold bg-white text-ink-900 hover:bg-cream-300 transition-colors flex items-center justify-center gap-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-45"
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
                className="w-full h-11 rounded-pill font-semibold bg-transparent text-foreground border border-[var(--color-border)] hover:bg-foreground/5 hover:border-[var(--color-border-strong)] transition-colors flex items-center justify-center gap-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
                aria-label={`${t('login.guestPrefix')} ${GUEST_GRACE_PERIOD_DAYS}${t('login.guestSuffix')}`}
              >
                <Clock className="size-4" aria-hidden />
                <span>
                  {t('login.guestPrefix')} {GUEST_GRACE_PERIOD_DAYS}
                  {t('login.guestSuffix')}
                </span>
              </button>
              <p className="mt-2 text-center text-[11px] text-subtle-foreground">
                {t('login.guestDesc')}
              </p>
            </div>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">{t('login.notMember')}</span>{' '}
              <Link
                href={localizedPath('/signup', locale)}
                className="font-semibold text-lime-300 hover:text-lime-400 transition-colors"
              >
                {t('auth.signup')}
              </Link>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
