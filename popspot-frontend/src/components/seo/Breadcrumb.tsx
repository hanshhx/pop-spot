import Link from 'next/link';

import { serializeJsonLd } from '@/lib/popupEventJsonLd';

const SITE = 'https://popspot.co.kr';

export interface Crumb {
  /** 화면에 보이는 이름. */
  name: string;
  /**
   * 이 칸이 가리키는 주소. <b>마지막 칸에는 주지 않는다</b> — 지금 보고 있는 페이지라
   * 자기 자신으로 가는 링크는 사용자에게도 검색엔진에도 뜻이 없다.
   */
  href?: string;
}

/**
 * 위로 올라가는 길.
 *
 * <p><b>왜 필요한가.</b> 상세 페이지에서 랜딩으로 가는 링크가 <b>0개</b>였다. 검색으로 들어온
 * 사람은 팝업 하나를 보고 나면 "성수에 다른 것도 있나" 로 갈 방법이 없었고, 크롤러도 마찬가지라
 * 상세가 링크 그래프의 막다른 골목이었다.
 *
 * <p><b>보이는 것과 구조화 데이터를 함께 낸다.</b> 둘 중 하나만 있으면 안 된다 — 구조화 데이터만
 * 있으면 사람이 못 쓰고, 검색엔진도 화면에 없는 경로를 신뢰하지 않는다. 보이는 것만 있으면 검색
 * 결과에 경로가 표시되지 않는다. 같은 배열에서 둘 다 만들어 어긋날 수 없게 한다.
 *
 * <p>서버 컴포넌트다. 구조화 데이터가 첫 HTML 에 들어가야 크롤러가 자바스크립트 없이 읽는다.
 */
export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length < 2) return null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      // 마지막 칸(현재 페이지)에는 item 을 넣지 않는다 — 구글 문서가 그렇게 안내한다.
      ...(item.href ? { item: `${SITE}${item.href}` } : {}),
    })),
  };

  return (
    <>
      <nav
        aria-label="현재 위치"
        className={className ?? 'mx-auto max-w-[1600px] px-4 pb-2 md:px-6'}
      >
        <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground md:text-sm">
          {items.map((item, index) => (
            <li key={`${item.name}-${index}`} className="flex items-center gap-1">
              {index > 0 && (
                <span aria-hidden="true" className="text-muted-foreground/50">
                  ›
                </span>
              )}
              {item.href ? (
                <Link
                  href={item.href}
                  // 글자만 두면 손가락으로 누르기 어렵다. 크기는 그대로 두고 누를 면적만 넓힌다.
                  className="inline-flex min-h-9 items-center py-1 transition hover:text-foreground"
                >
                  {item.name}
                </Link>
              ) : (
                <span
                  aria-current="page"
                  className="inline-flex min-h-9 items-center py-1 truncate"
                >
                  {item.name}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
    </>
  );
}

export default Breadcrumb;
