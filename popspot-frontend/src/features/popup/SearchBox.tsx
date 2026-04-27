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

const searchClient = algoliasearch(
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
  process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY!
);

function CustomSearchBox(props: UseSearchBoxProps) {
  const { query, refine } = useSearchBox(props);
  const [inputValue, setInputValue] = useState(query);

  useEffect(() => {
    if (query !== inputValue) setInputValue(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
 * Algolia 기반 검색존.
 * 메인 페이지 MAP 탭 좌측에 들어감. 결과는 입력창 아래 dropdown 으로.
 */
export function SearchZone() {
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
