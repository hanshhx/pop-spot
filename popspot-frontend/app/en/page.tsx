import { Suspense } from 'react';
import type { Metadata } from 'next';

import HomeClient from '../HomeClient';
import { fetchHomePopups } from '../homeData';
import { REGIONS } from '@/lib/regions';
import { CATEGORIES, BRANDS, getPeriods } from '@/lib/popupSlices';
import { LOCALE_META, localeAlternates } from '@/lib/localeRoutes';

/**
 * 영어 홈 — 서울을 찾는 영어권 방문자용.
 *
 * <p>본문에 <b>서버가 그린 영어 소개글</b>을 둔다. 화면 조작 없이도 크롤러가 읽을 수 있어야 이 주소가
 * 영어 페이지로 인식된다. 팝업 이름은 한국어 원문 그대로다 — 기계 번역하면 고유명사가 망가지고,
 * 현지에서 간판·지도 앱과 대조할 때는 원문이 오히려 쓸모 있다(i18n.tsx 주석).
 */
export const metadata: Metadata = {
  title: LOCALE_META.en.title,
  description: LOCALE_META.en.description,
  keywords: [
    'Seoul pop-up stores',
    'Seoul pop-up map',
    'Seongsu pop-up stores',
    'Korea pop-up events',
    'things to do in Seoul',
  ],
  alternates: localeAlternates('en'),
  openGraph: {
    title: LOCALE_META.en.title,
    description: LOCALE_META.en.description,
    locale: 'en_US',
    type: 'website',
    url: 'https://popspot.co.kr/en',
    siteName: 'POP-SPOT',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: LOCALE_META.en.title,
    description: LOCALE_META.en.description,
    images: ['/og-image.png'],
  },
};

// 한국어 홈과 같은 이유로 목록을 서버에서 받아 넘긴다 — app/homeData.ts 주석 참고.
export default async function EnglishHome() {
  const initialPopups = await fetchHomePopups();
  const areas = REGIONS.map((r) => r.labelEn).join(' · ');

  return (
    <>
      {/* 크롤러가 읽는 영어 본문. 화면에는 보이지 않지만 이 주소가 무엇인지 설명한다. */}
      <section className="sr-only">
        <h1>Seoul Pop-up Stores — Map, Dates and What’s Open Today</h1>
        <p>
          POP-SPOT collects pop-up stores across Seoul onto a single map. Check what is open today,
          this week and this weekend, and see which ones are closing soon. Areas covered include{' '}
          {areas}, along with major department stores and malls such as The Hyundai Seoul, COEX and
          Yongsan I&apos;Park Mall.
        </p>
        <p>
          Browse by area, by date or by category — fashion, beauty, character, food and culture.
          Every listing shows the address, the opening period and how many days are left. Free to
          use, no sign-up required.
        </p>
        <p>
          Pop-up names and descriptions are shown in Korean as published by the original sources.
          This is intentional: the Korean name is what you will see on the shop sign and what you
          can paste into a map app once you are in Seoul.
        </p>
        {/*
          v2.53 — 영어·일본어 홈에는 내부 링크가 <b>하나도 없었다.</b> 한국어 홈에는 지역·시점·
          카테고리·브랜드 네 묶음이 있는데 이쪽은 본문만 있어서, 247개 영어 랜딩이 사이트맵으로만
          발견됐다. 사이트맵은 "이런 주소가 있다" 는 신고일 뿐이고 링크가 있어야 중요도가 전달된다.
        */}
        <nav aria-label="Pop-up stores by date">
          <h2>By date</h2>
          <ul>
            {getPeriods().map((p) => (
              <li key={p.slug}>
                <a href={`/en/popups/${p.slug}`}>{p.labelEn}</a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Pop-up stores by area">
          <h2>By area</h2>
          <ul>
            {REGIONS.map((r) => (
              <li key={r.slug}>
                <a href={`/en/popups/${r.slug}`}>{r.labelEn} pop-up stores</a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Pop-up stores by category">
          <h2>By category</h2>
          <ul>
            {CATEGORIES.map((c) => (
              <li key={c.slug}>
                <a href={`/en/popups/${c.slug}`}>{c.labelEn} pop-up stores</a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Pop-up stores by brand">
          <h2>By brand and venue</h2>
          <ul>
            {BRANDS.map((b) => (
              <li key={b.slug}>
                <a href={`/en/popups/${b.slug}`}>{b.labelEn} pop-up store</a>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      <Suspense fallback={null}>
        <HomeClient initialPopups={initialPopups} />
      </Suspense>
    </>
  );
}
