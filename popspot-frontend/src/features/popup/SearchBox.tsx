"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, MapPin, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import {
  InstantSearch,
  useSearchBox,
  useHits,
  type UseSearchBoxProps,
} from "react-instantsearch";
import { liteClient as algoliasearch } from "algoliasearch/lite";
import { env } from "@/lib/env";
import { apiFetch } from "@/lib/api";
import { popupCoverUrl } from "@/lib/popupCover";
import { SectionLogo } from "@/components/layout/BrandLogos";

interface AlgoliaHit {
  objectID: string;
  name: string;
  location?: string;
  category?: string | null;
  imageUrl?: string | null;
  /** v2.13 — 백엔드가 인덱싱 시점에 가드를 걸지만 클라에서도 한 번 더 검증 (이중 방어). */
  reviewStatus?: string | null;
  status?: string | null;
  confidence?: number | null;
  endDate?: string | null;
}

const MIN_CONFIDENCE = 0.8;
const ALLOWED_REVIEW_STATUSES: ReadonlyArray<string | null | undefined> = [
  "AUTO_PUBLISHED",
  "APPROVED",
  null,
  undefined,
];
const BLOCKED_STATUSES: ReadonlySet<string> = new Set(["EXPIRED", "PENDING"]);

/** 인덱스에 옛 garbage 가 남아 있을 가능성 대비 — 정확도 / 유효기간 / 상태 가드. */
function isVisibleHit(hit: AlgoliaHit): boolean {
  if (!ALLOWED_REVIEW_STATUSES.includes(hit.reviewStatus ?? null)) return false;
  if (hit.status && BLOCKED_STATUSES.has(hit.status)) return false;
  if (typeof hit.confidence === "number" && hit.confidence < MIN_CONFIDENCE) return false;
  if (hit.endDate) {
    const end = Date.parse(hit.endDate);
    if (!Number.isNaN(end) && end < Date.now() - 24 * 60 * 60 * 1000) return false;
  }
  return true;
}

// env.algolia 가 null 이면 (미설정·더미값) 클라이언트 미생성 → fallback UI.
const searchClient = env.algolia
  ? algoliasearch(env.algolia.appId, env.algolia.searchKey)
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

interface CustomHitsProps {
  onSelect?: (hit: { objectID: string; name: string; location?: string }) => void;
}

function CustomHits({ onSelect }: CustomHitsProps) {
  const { items: hits } = useHits<AlgoliaHit>();
  const { query, refine } = useSearchBox();

  if (!query) return null;

  const visibleHits = hits.filter(isVisibleHit);

  return (
    <div className="absolute top-full left-0 right-0 mt-3 bg-surface border border-[var(--color-border)] rounded-lg overflow-hidden z-50 shadow-pop max-h-[400px] overflow-y-auto custom-scrollbar">
      {visibleHits.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground text-sm">
          검색 결과가 없습니다.
        </div>
      ) : (
        visibleHits.map((hit) => (
          <Link
            key={hit.objectID}
            href={`/popup/${hit.objectID}`}
            onClick={(e) => {
              // onSelect 가 있으면 상세 이동 대신 지도 이동(+검색 닫기).
              if (onSelect) {
                e.preventDefault();
                onSelect({ objectID: hit.objectID, name: hit.name, location: hit.location });
                refine("");
              }
            }}
          >
            <article className="flex items-center gap-4 p-4 hover:bg-lime-300/10 transition-colors cursor-pointer border-b border-[var(--color-border)] last:border-none group">
              {/* 팝업 커버 — imageUrl 이 기본 플레이스홀더면 카테고리·id 로 큐레이션 사진 배정. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={popupCoverUrl(
                  { id: hit.objectID, category: hit.category, imageUrl: hit.imageUrl },
                  200,
                )}
                alt=""
                loading="lazy"
                className="size-12 shrink-0 rounded-md object-cover bg-lime-300/15"
              />
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
 * AI 자연어 검색 — 검색어를 백엔드 LLM(Groq)이 해석해 매칭 팝업 id 를 받고, 지도에 그 핀만 남긴다.
 * Algolia 서치존과 독립적으로 동작(키가 없어도 사용 가능). LLM 비용/한도 고려해 Enter/버튼 제출 시에만 호출.
 */
function AiSearchBar({ onAiFilter }: { onAiFilter?: (ids: string[] | null) => void }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [erred, setErred] = useState(false);

  async function run() {
    const query = q.trim();
    if (!query || loading) return;
    setLoading(true);
    setErred(false);
    try {
      const res = await apiFetch(`/api/search/ai?q=${encodeURIComponent(query)}`);
      const data = await res.json().catch(() => ({}));
      const ids: string[] = Array.isArray(data?.ids) ? data.ids.map(String) : [];
      setCount(ids.length);
      onAiFilter?.(ids);
    } catch {
      setErred(true);
      setCount(null);
      onAiFilter?.(null);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setQ("");
    setCount(null);
    setErred(false);
    onAiFilter?.(null);
  }

  return (
    <div className="mt-4 rounded-2xl border border-lime-300/40 bg-lime-50/60 dark:bg-lime-300/5 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={14} className="text-lime-600 dark:text-lime-300" aria-hidden />
        <span className="text-xs font-bold text-lime-700 dark:text-lime-300">AI로 찾기</span>
        <span className="text-[10px] text-muted-foreground">— 지도에 딱 맞는 핀만</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") run();
          }}
          placeholder="예: 비 오는 날 감성 카페, 성수 캐릭터 굿즈"
          aria-label="AI 검색"
          className="flex-1 h-11 rounded-pill py-2.5 px-4 bg-surface border border-[var(--color-border)] text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-lime-400"
        />
        <button
          type="button"
          onClick={run}
          disabled={loading || !q.trim()}
          aria-label="AI 검색 실행"
          className="shrink-0 h-11 px-4 rounded-pill bg-lime-300 text-ink-900 font-bold text-sm hover:bg-lime-400 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          찾기
        </button>
      </div>
      {(count !== null || erred) && (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className={erred ? "text-hot-500 font-medium" : "text-muted-foreground"}>
            {erred
              ? "AI 검색이 잠시 안 돼요. 다시 시도해 주세요."
              : count === 0
                ? "맞는 팝업을 못 찾았어요."
                : `지도에 ${count}곳만 표시 중`}
          </span>
          <button
            type="button"
            onClick={reset}
            className="shrink-0 font-bold text-lime-700 dark:text-lime-300 hover:underline"
          >
            전체 지도 보기
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Algolia 키 미설정/잘못된 키일 때 보여주는 안전한 fallback.
 * 외부 호출을 일절 하지 않으므로 콘솔 에러 없음. (AI 검색은 Algolia 와 독립이라 여기서도 노출)
 */
function SearchZoneFallback({ onAiFilter }: { onAiFilter?: (ids: string[] | null) => void }) {
  return (
    <div className="rounded-xl p-6 md:p-8 flex flex-col justify-start border border-[var(--color-border)] bg-surface relative z-50 min-h-0">
      <div>
        <SectionLogo name="search-zone" label="Search Zone" className="h-9 md:h-12 mb-4 text-foreground" />
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
      <AiSearchBar onAiFilter={onAiFilter} />
    </div>
  );
}

/**
 * Algolia 기반 검색존.
 * 메인 페이지 MAP 탭 좌측에 들어감. 결과는 입력창 아래 dropdown 으로.
 * Algolia 키가 없거나 잘못 설정됐으면 fallback UI 로 안전하게 대체.
 */
interface SearchZoneProps {
  /** 검색 결과 선택 시 호출 — 지도 이동 등에 사용. 미지정이면 상세 페이지로 이동. */
  onSelectPopup?: (hit: { objectID: string; name: string; location?: string }) => void;
  /** AI 검색 결과 id 목록(또는 null=전체 복원). 지도 핀 필터에 사용. */
  onAiFilter?: (ids: string[] | null) => void;
}

export function SearchZone({ onSelectPopup, onAiFilter }: SearchZoneProps = {}) {
  if (!searchClient) {
    return <SearchZoneFallback onAiFilter={onAiFilter} />;
  }

  return (
    <div className="rounded-xl p-6 md:p-8 flex flex-col justify-start border border-[var(--color-border)] bg-surface relative z-50 min-h-0">
      <InstantSearch searchClient={searchClient} indexName="popups">
        <div>
          <SectionLogo name="search-zone" label="Search Zone" className="h-9 md:h-12 mb-4 text-foreground" />
          <div className="mt-6 relative w-full">
            <CustomSearchBox />
          </div>
        </div>
        <CustomHits onSelect={onSelectPopup} />
      </InstantSearch>
      <AiSearchBar onAiFilter={onAiFilter} />
    </div>
  );
}
