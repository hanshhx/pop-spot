'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { BottomDock } from '@/components/layout/BottomDock';
import { Footer } from '@/components/layout/Footer';
import { Header, type HeaderUser } from '@/components/layout/Header';
import { useLocale } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';

/**
 * 홈 밖의 페이지가 입는 사이트 껍데기 — 헤더·푸터·하단독.
 *
 * <p><b>왜 필요한가.</b> 검색으로 들어오는 사람은 홈을 거치지 않는다. 그런데 헤더도 푸터도
 * {@code HomeClient} 안에만 있어서, {@code /popups/seongsu} 에 떨어진 사람은 사이트의 나머지를
 * 볼 방법이 없었다 — 맨 위 "돌아가기" 한 줄이 전부였다. 실측(2026-08-29) 방문자 1,561명 중
 * <b>514명(32.9%)이 랜딩 한 장만 보고 떠났다.</b>
 *
 * <p><b>탭은 여기서 상태가 아니라 이동이다.</b> 홈에서는 하단독이 같은 페이지 안에서 탭을 바꾸지만
 * (BottomDock 주석: "모든 탭은 같은 페이지 안에서 즉시 전환된다 — 외부 라우트 X"), 랜딩·상세에는
 * 바꿀 탭 상태가 없다. 그래서 여기서는 홈의 해당 탭으로 <b>이동</b>시킨다. 현재 탭은 비워 둔다 —
 * 어느 것도 "지금" 이 아니므로 아무것도 켜지 않는다.
 *
 * <p><b>넘기지 않는 손잡이들.</b> 제보·프로필 편집·알림은 전부 홈이 들고 있는 모달이다. 여기서
 * 열 수 없으므로 넘기지 않고, 그러면 헤더·푸터가 그 자리를 알아서 비운다(각 컴포넌트가 이미
 * 선택적 prop 으로 처리한다). 로고는 {@code onLogoClick} 이 없어도 홈으로 가는 진짜 링크다.
 */
export function SiteChrome({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  const router = useRouter();
  const [user, setUser] = useState<HeaderUser | null>(null);

  /*
   * 헤더에 보일 프로필. 홈·상세·관리자와 같은 자리에서 읽는다.
   *
   * <p>알려진 한계: 접근 토큰은 sessionStorage 라 탭을 닫으면 사라지는데 이 프로필 캐시는
   * localStorage 에 남는다. 그래서 다음 날 다시 온 사람은 <b>닉네임이 뜬 채로 로그인은 풀려</b>
   * 있다. 이 컴포넌트가 만든 문제가 아니라 기존 동작이고, 여기서만 다르게 읽으면 같은 사이트
   * 안에서 헤더가 화면마다 다른 말을 하게 된다. 고칠 때는 네 곳을 함께 고쳐야 한다.
   */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw) as HeaderUser);
    } catch {
      // 캐시가 깨져 있으면 비로그인으로 둔다 — 껍데기 때문에 페이지가 죽으면 안 된다.
    }
  }, []);

  // 헤더는 탭을 string 으로, 하단독은 DockTab 으로 넘긴다. 넓은 쪽으로 받으면 둘 다 맞는다.
  const goTab = (tab: string) => router.push(localizedPath(`/?tab=${tab}`, locale));

  return (
    <>
      {/*
        폭은 홈과 <b>같은 값</b>이어야 한다(HomeClient 의 Header 감싸개와 동일).
        좁게 잡았더니 데스크톱 상단 네비가 자리를 못 찾아 「지/도」, 「코/스」처럼 한 글자씩
        세로로 쪼개졌다 — 헤더는 그대로 재사용했는데 담는 그릇을 임의로 정해서 생긴 문제다.
      */}
      <div className="relative z-10 mx-auto max-w-[1600px] px-4 py-4 md:px-6 md:py-6">
        {/*
          언어 선택기는 넘기지 않는다. 랜딩(app/popups/[slug]/page.tsx)과 상세
          (PopupDetailClient.tsx)가 <b>이미 자기 것을 그린다</b> — 여기서 또 넘기면 모바일에서
          같은 것이 두 개 뜨고, 헤더가 두 줄로 접혀 세로 280px 를 먹는다. 검색으로 온 사람이
          찾는 답이 그만큼 화면 아래로 밀린다.
        */}
        <Header user={user} onNavChange={goTab} />
      </div>
      {children}
      <Footer />
      <BottomDock onTabChange={goTab} />
    </>
  );
}

export default SiteChrome;
