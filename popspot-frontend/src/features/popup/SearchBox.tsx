"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, MapPin, Store, ArrowRight } from "lucide-react";
import {
  InstantSearch,
  useSearchBox,
  useHits,
  type UseSearchBoxProps,
} from "react-instantsearch";
import { liteClient as algoliasearch } from "algoliasearch/lite";

interface AlgoliaHit {
  objectID: string;
  name: string;
  location?: string;
}

/* --------------------------------------------------------------------------
 * Algolia 환경변수가 비어있거나 잘못된 ID(예: 데모용 더미)면
 * 클라이언트 자체를 만들지 않고 fallback UI 를 표시한다.
 * -------------------------------------------------------------------------- */
const ALGOLIA_APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const ALGOLIA_SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;

// App ID 형식이 너무 짧거나 명백히 잘못된 값을 사전 차단
const isAlgoliaConfigured =
  !!ALGOLIA_APP_ID &&
  !!ALGOLIA_SEARCH_KEY &&
  ALGOLIA_APP_ID.length >= 6 &&
  ALGOLIA_SEARCH_KEY.length >= 10 &&
  // Algolia 정식 App ID 패턴(영문 대문자 + 숫자) 외 모양은 막음
  /^[A-Z0-9]+$/.test(ALGOLIA_APP_ID);

const searchClient = isAlgoliaConfigured
  ? algoliasearch(ALGOLIA_APP_ID!, ALGOLIA_SEARCH_KEY!)
  : null;

function CustomSearchBox(props: UseSearchBoxProps) {
  const { query, refine } = useSearchBox(props);
  const [inputValue, setInputValue] = useState(query);

  // Algolia 의 query 가 외부에서 바뀌면 input value 도 따라가게 한다.
  // inputValue 를 deps 에 넣으면 input → state → effect → setInputValue → input 무한루프가
  // 생기므로 의도적으로 query 만 dep 으로 둔다.
  useEffect(() => {
    if (query !== inputValue) setInputValue(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inputValue 는 의도적으로 deps 제외
  }, [query]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    refine(e.target.value);
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        placeholder="지역, 팝업 이름, 카테고리 검색..."
        aria-label="팝업 검색"
        className="w-full h-12 rounded-pill py-3 pl-12 pr-4 bg-cream-300 dark:bg-ink-800 border border-[var(--color-border)] text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-lime-400 transition-colors text-sm md:text-base"
      />
      <Search
        className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
        size={18}
        aria-hidden
      />
    </div>
  );
}

function CustomHits() {
  const { items: hits } = useHits<AlgoliaHit>();
  const { query } = useSearchBox();

  if (!query) return null;

  return (
    <div className="absolute top-full left-0 right-0 mt-3 bg-surface border border-[var(--color-border)] rounded-lg overflow-hidden z-50 shadow-pop max-h-[400px] overflow-y-auto custom-scrollbar">
      {hits.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground text-sm">
          검색 결과가 없습니다.
        </div>
      ) : (
        hits.map((hit) => (
          <Link key={hit.objectID} href={`/popup/${hit.objectID}`}>
            <article className="flex items-center gap-4 p-4 hover:bg-lime-300/10 transition-colors cursor-pointer border-b border-[var(--color-border)] last:border-none group">
              <div className="size-12 shrink-0 rounded-md bg-lime-300/15 flex items-center justify-center text-lime-500">
                <Store size={20} aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm truncate text-foreground group-hover:text-lime-500 transition-colors">
                  {hit.name}
                </h4>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                  <MapPin size={12} aria-hidden /> {hit.location || "위치 정보 없음"}
                </p>
              </div>
              <ArrowRight
                size={16}
                className="text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-lime-500 transition-all"
                aria-hidden
              />
            </article>
          </Link>
        ))
      )}
      <div className="px-4 py-2 bg-cream-300 dark:bg-ink-800 text-[10px] text-right text-muted-foreground">
        Search by <span className="font-bold text-lime-500">Algolia</span>
      </div>
    </div>
  );
}

/**
 * Algolia 키 미설정/잘못된 키일 때 보여주는 안전한 fallback.
 * 외부 호출을 일절 하지 않으므로 콘솔 에러 없음.
 */
function SearchZoneFallback() {
  return (
    <div className="rounded-xl p-6 md:p-8 flex flex-col justify-between border border-[var(--color-border)] bg-surface relative z-50 min-h-[260px]">
      <div>
        <h2 className="font-display-en text-3xl md:text-5xl font-extrabold tracking-tighter mb-4 text-foreground">
          Search <span className="text-lime-300">Zone.</span>
        </h2>
        <div className="mt-6 relative w-full">
          <input
            type="text"
            disabled
            placeholder="검색 기능 준비 중입니다..."
            aria-label="팝업 검색 (준비 중)"
            className="w-full h-12 rounded-pill py-3 pl-12 pr-4 bg-cream-300/50 dark:bg-ink-800/50 border border-[var(--color-border)] text-muted-foreground placeholder:text-muted-foreground/70 cursor-not-allowed text-sm md:text-base"
          />
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50"
            size={18}
            aria-hidden
          />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground/70 mt-4">
        곧 더 강력한 검색으로 찾아뵐게요.
      </p>
    </div>
  );
}

/**
 * Algolia 기반 검색존.
 * 메인 페이지 MAP 탭 좌측에 들어감. 결과는 입력창 아래 dropdown 으로.
 * Algolia 키가 없거나 잘못 설정됐으면 fallback UI 로 안전하게 대체.
 */
export function SearchZone() {
  if (!searchClient) {
    return <SearchZoneFallback />;
  }

  return (
    <div className="rounded-xl p-6 md:p-8 flex flex-col justify-between border border-[var(--color-border)] bg-surface relative z-50 min-h-[260px]">
      <InstantSearch searchClient={searchClient} indexName="popups">
        <div>
          <h2 className="font-display-en text-3xl md:text-5xl font-extrabold tracking-tighter mb-4 text-foreground">
            Search <span className="text-lime-300">Zone.</span>
          </h2>
          <div className="mt-6 relative w-full">
            <CustomSearchBox />
          </div>
        </div>
        <CustomHits />
      </InstantSearch>
    </div>
  );
}
