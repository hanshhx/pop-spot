import { Suspense } from 'react';
import type { Metadata } from 'next';

import HomeClient from '../HomeClient';
import { REGIONS } from '@/lib/regions';
import { LOCALE_META, localeAlternates } from '@/lib/localeRoutes';

/**
 * 일본어 홈 — 서울 여행을 준비하는 일본어권 방문자용.
 *
 * <p>본문에 <b>서버가 그린 일본어 소개글</b>을 둔다. 화면 조작 없이도 크롤러가 읽을 수 있어야 이
 * 주소가 일본어 페이지로 인식된다. 팝업 이름은 한국어 원문 그대로다(경위는 i18n.tsx 주석).
 */
export const metadata: Metadata = {
  title: LOCALE_META.ja.title,
  description: LOCALE_META.ja.description,
  alternates: localeAlternates('ja'),
  openGraph: {
    title: LOCALE_META.ja.title,
    description: LOCALE_META.ja.description,
    locale: 'ja_JP',
    type: 'website',
    url: 'https://popspot.co.kr/ja',
    siteName: 'POP-SPOT',
  },
};

export default function JapaneseHome() {
  const areas = REGIONS.map((r) => r.labelJa).join('・');

  return (
    <>
      {/* クローラーが読む日本語本文。画面には出ないが、この住所が何かを説明する。 */}
      <section className="sr-only">
        <h1>ソウルのポップアップストア — マップ・開催日程・本日オープン</h1>
        <p>
          POP-SPOT
          はソウル各地のポップアップストアを一つのマップにまとめています。本日・今週・週末に
          オープンするもの、終了間近のものをまとめて確認できます。対象エリアは{areas}
          ほか、ザ・現代ソウル、COEX、龍山アイパークモールなどの百貨店・モールも含みます。
        </p>
        <p>
          エリア別・日程別・カテゴリ別（ファッション、ビューティー、キャラクター、フード、カルチャー）
          に探せます。住所、開催期間、終了までの残り日数を一覧で表示。登録不要・無料でご利用いただけます。
        </p>
        <p>
          ポップアップの名称と説明は、出典元の韓国語表記のまま掲載しています。現地では看板もこの表記で、
          地図アプリにそのまま貼り付けて検索できるためです。
        </p>
      </section>

      <Suspense fallback={null}>
        <HomeClient />
      </Suspense>
    </>
  );
}
