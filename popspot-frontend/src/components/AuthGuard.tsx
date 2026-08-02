'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { apiFetch, AUTH_EXPIRED_EVENT } from '@/lib/api';
import { clearAuthToken, getAuthToken } from '@/lib/authStorage';
import { notifyWarning } from '@/lib/notify';
import { useLocale } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';

// 인증 불필요 공개 경로 — 정확 일치. (sitemap 포함 페이지 + 인증 흐름 페이지)
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/find-account',
  '/oauth/callback',
  '/feedback',
  '/about',
  '/terms',
  '/privacy',
  // v2.43 — /map(지도 전용 SEO 문서). 여기 빠뜨리면 검색로봇은 200 을 받아 색인하는데 실제 방문자는
  // 로그인으로 튕긴다 — 서버 렌더는 통과하고 이 가드는 클라이언트에서만 돌기 때문이다. 유입을 늘리려
  // 만든 페이지가 유입된 사람을 쫓아내는 조합이라, sitemap 에 페이지를 추가하면 이 목록도 함께 봐야 한다.
  '/map',
];

// slug 가 붙는 동적 공개 경로 — prefix 매칭.
// /popups/[slug] = SEO long-tail 랜딩(색인 O), /popup/[id] = 팝업 상세 — 비로그인 열람은
// 되지만 색인은 막혀 있다(회원 채팅이 같은 URL 에 있어 약관 §14. app/popup/[id]/layout.tsx).
const PUBLIC_PREFIXES = ['/popups/', '/popup/'];

/**
 * 언어별 주소({@code /en}, {@code /ja})는 <b>한국어판과 같은 규칙을 따른다.</b>
 *
 * <p>v2.49 — 위 경고("sitemap 에 페이지를 추가하면 이 목록도 함께 봐야 한다")를 그대로 반복했다.
 * /en · /ja 를 만들면서 여기에 넣지 않아, 검색로봇은 영어·일본어 페이지를 색인하는데 정작 그걸 보고
 * 들어온 사람은 로그인 화면으로 튕겼다. 외국인 유입을 늘리려 만든 페이지가 외국인을 쫓아냈다.
 *
 * <p>그래서 목록을 늘리는 대신 <b>접두어를 떼고 판정한다.</b> 새 공개 페이지를 추가할 때 언어별
 * 주소를 따로 챙길 필요가 없어진다 — 빠뜨릴 수 있는 자리를 없애는 편이 기억하는 것보다 낫다.
 */
const LOCALE_PREFIXES = ['/en', '/ja'];

/** {@code /ja/popups/seongsu} → {@code /popups/seongsu}. 언어 홈({@code /ja})은 루트로. */
function stripLocale(pathname: string): string {
  for (const p of LOCALE_PREFIXES) {
    if (pathname === p) return '/';
    if (pathname.startsWith(`${p}/`)) return pathname.slice(p.length);
  }
  return pathname;
}

const USER_KEY = 'user';

const EXPIRED_COPY = {
  ko: {
    title: '로그인이 만료되었습니다',
    text: '보안을 위해 일정 시간이 지나면 자동으로 로그아웃됩니다. 다시 로그인하시면 찜·저장한 코스·여권이 그대로 있습니다.',
    loading: '불러오는 중...',
  },
  en: {
    title: 'Your session has expired',
    text: 'For your security, POP-SPOT signs you out after a while. Log in again to find your saved pop-ups, routes, and passport unchanged.',
    loading: 'Loading…',
  },
  ja: {
    title: 'ログインの有効期限が切れました',
    text: '安全のため、一定時間が経つと自動的にログアウトします。再度ログインすると、保存したポップアップ・コース・パスポートをそのまま確認できます。',
    loading: '読み込み中…',
  },
} as const;

/**
 * 공개 경로 판정 — 정확 일치 또는 공개 prefix. pathname 불명 시 공개로 간주(막지 않음).
 *
 * <p>이 판정은 <b>강제 이동 여부만</b> 결정한다. 토큰 검증과 만료 이벤트 수신은 경로와 무관하게 항상
 * 수행한다 — 이유는 아래 컴포넌트 주석 참고.
 */
export function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return true;
  // 언어 접두어를 떼고 본다 — /ja/popups/seongsu 는 /popups/seongsu 와 같은 페이지다.
  const path = stripLocale(pathname);
  return PUBLIC_PATHS.includes(path) || PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function GuardFallback() {
  const { locale } = useLocale();
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-black text-white">
      <Loader2 className="w-10 h-10 animate-spin text-lime-500 mb-4" />
      <p className="text-gray-400 font-bold">{EXPIRED_COPY[locale].loading}</p>
    </div>
  );
}

/**
 * 경로별 인증 가드 (UX/리다이렉트 전용 — 실제 보안은 서버 API 토큰 검증이 담당).
 *
 * <p>v2.23.2 — SEO: 더 이상 인증 확인 동안 스피너로 본문을 가리지 않는다. 항상 children 을 렌더해
 * 서버 컴포넌트 페이지(예: {@code /popups/[slug]} SEO 랜딩, {@code /about})가 실제 본문 HTML 을
 * 내보내게 한다 — 크롤러(특히 JS 를 거의 안 돌리는 네이버 Yeti)가 색인할 수 있도록. 이전엔 모든
 * 페이지의 첫 HTML 이 "인증 확인 중" 스피너라 메인/SEO 랜딩이 색인되지 않았다.
 *
 * <p>{@code <Suspense>} 로 감싸는 이유: 일부 클라이언트 페이지(메인 등)가 {@code useSearchParams()}
 * 를 쓰는데, 정적 생성 시 Suspense 경계가 없으면 빌드가 실패한다. Suspense 가 있으면 그런 페이지는
 * 빌드 시 fallback 으로 떨어지고(빌드 통과), suspend 하지 않는 서버 컴포넌트 SEO 페이지는 실제
 * 본문을 그대로 SSR 한다.
 *
 * <p>보호 경로(공개 목록 밖)는 마운트 후 토큰을 검증해 미인증이면 /login 으로 보낸다. 보호 페이지는
 * noindex + 데이터가 토큰 게이트된 API 라 잠깐 빈 셸이 렌더돼도 유출 없음.
 *
 * <p><b>공개 경로에서도 검증은 한다 — 생략하는 것은 강제 이동뿐이다.</b> 여권 · 찜 · 코스 · 마이 ·
 * 동행은 별도 주소가 아니라 전부 {@code '/'} 안의 탭이다. 예전처럼 공개 경로에서 즉시 빠져나가면
 * 로그인 사용자의 세션 내내 토큰 검증이 단 한 번도 일어나지 않았고, 토큰이 만료돼도 헤더에는 이름과
 * 프로필이 그대로 남은 채 찜 0건 · 코스 0건 · 여권 0/12 만 조용히 표시됐다. 사용자에게는 "내 데이터가
 * 사라졌다"로 보인다. 이제는 만료를 감지해 안내를 띄우고, 공개 경로에서는 보던 페이지를 뺏지 않는다.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useLocale();
  const expiredCopy = EXPIRED_COPY[locale];

  useEffect(() => {
    // 공개 경로에서 생략하는 것은 '강제 이동'뿐이다. 검증과 이벤트 수신은 아래에서 그대로 수행한다.
    const publicPath = isPublicPath(pathname);

    let cancelled = false;

    /**
     * 만료 처리. 정리는 apiFetch 가 이미 했지만 멱등하게 한 번 더 — 다른 경로(수동 삭제 등)로 이벤트가
     * 와도 캐시가 남지 않게. 안내는 기존 notify 유틸 재사용(중복 방지는 apiFetch 가 이벤트 발행 단계에서
     * 이미 하므로 세션당 한 번만 뜬다).
     */
    const handleExpired = () => {
      clearAuthToken();
      localStorage.removeItem(USER_KEY);
      void notifyWarning({ title: expiredCopy.title, text: expiredCopy.text });
      if (!publicPath) router.replace(localizedPath('/login', locale));
    };

    const verify = async () => {
      const token = getAuthToken();
      if (!token) {
        // 비로그인 상태. 공개 경로는 그대로 두고, 보호 경로만 로그인으로 보낸다.
        if (!publicPath) router.replace(localizedPath('/login', locale));
        return;
      }
      try {
        const res = await apiFetch('/api/v1/auth/me');
        if (cancelled) return;
        // 401 은 apiFetch 가 AUTH_EXPIRED_EVENT 로 알려주고 handleExpired 가 처리한다 — 여기서 또
        // 정리·이동하면 안내가 두 번 뜬다.
        if (!res.ok) return; // 5xx / 네트워크 일시 장애 — stale 캐시 유지(UX 보호).
        const serverUser = await res.json();
        localStorage.setItem(USER_KEY, JSON.stringify(serverUser));
      } catch {
        // 네트워크 실패 → stale 캐시 fallback.
      }
    };

    // 리스너를 먼저 건다 — verify() 안의 401 이 이벤트를 쏠 때 이미 붙어 있어야 놓치지 않는다.
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    void verify();
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    };
  }, [pathname, router, locale, expiredCopy]);

  return <Suspense fallback={<GuardFallback />}>{children}</Suspense>;
}
