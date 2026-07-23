'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Loader2, MapPin, ArrowRight } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { SectionLogo } from '@/components/layout/BrandLogos';

/**
 * AI 검색존 — 기존 Algolia 서치바를 걷어내고 자연어 'AI 검색'을 메인 검색으로 승격.
 *
 * <p>검색어를 백엔드 LLM(Groq)이 해석해 매칭 팝업을 받는다. 지도 페이지에서는 {@code onAiFilter} 로 지도에 해당
 * 핀만 남기고, 지도가 없는 글로벌 검색 모달에서는 결과를 목록으로 보여준다(팝업 상세로 이동). 기존 서치바처럼 크고
 * 또렷하되, AI 답게 스파클·라임 글로우·예시 칩으로 특색을 준다.
 */

type AiResult = { id: string; name: string; location: string };

interface SearchZoneProps {
  /** 이름 매칭으로 고른 팝업 → 지도에서 해당 핀으로 이동 + 정보카드 오픈. */
  onSelectPopup?: (hit: { objectID: string; name: string; location?: string }) => void;
  /** AI 검색 결과 id 목록(또는 null=전체 복원). 지정되면 지도 핀 필터 모드. 미지정이면 결과 목록 모드. */
  onAiFilter?: (ids: string[] | null) => void;
  /** 이름 즉시검색용 팝업 목록(지도 모드). 있으면 입력 즉시 이름 부분일치 드롭다운을 띄운다. */
  popups?: { id: number; name: string; location: string }[];
}

const EXAMPLES = [
  '비 오는 날 감성 카페',
  '성수 캐릭터 굿즈',
  '주말 전시 팝업',
  '아이랑 가기 좋은 곳',
];

export function SearchZone({ onAiFilter, onSelectPopup, popups }: SearchZoneProps = {}) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AiResult[] | null>(null);
  const [erred, setErred] = useState(false);
  // 이름 매칭 드롭다운 표시 여부(입력/포커스 중에만).
  const [showSuggest, setShowSuggest] = useState(false);

  const mapMode = typeof onAiFilter === 'function'; // 지도 필터 vs 결과 목록

  // 이름 부분일치(대소문자 무시) — AI 호출 없이 즉시. "마뗑킴" → "마뗑킴 전시" 처럼 부분 이름도 잡는다.
  const nameMatches = useMemo(() => {
    const low = q.trim().toLowerCase();
    if (low.length < 1 || !popups?.length) return [];
    return popups.filter((p) => p.name?.toLowerCase().includes(low)).slice(0, 6);
  }, [q, popups]);

  const canSuggest = typeof onSelectPopup === 'function';

  /** 이름 매칭 결과 선택 → 지도가 그 핀으로 이동하고 카드를 연다. */
  function pick(p: { id: number; name: string; location: string }) {
    setQ(p.name);
    setShowSuggest(false);
    setResults(null);
    setErred(false);
    onSelectPopup?.({ objectID: String(p.id), name: p.name, location: p.location });
  }

  async function run(query?: string) {
    const text = (query ?? q).trim();
    if (!text || loading) return;
    if (query) setQ(query);
    setLoading(true);
    setErred(false);
    try {
      const res = await apiFetch(`/api/search/ai?q=${encodeURIComponent(text)}`);
      const data = await res.json().catch(() => ({}));
      const list: AiResult[] = Array.isArray(data?.results)
        ? data.results.map((r: { id: unknown; name?: string; location?: string }) => ({
            id: String(r.id),
            name: r.name ?? '',
            location: r.location ?? '',
          }))
        : [];
      setResults(list);
      onAiFilter?.(list.map((r) => r.id));
    } catch {
      setErred(true);
      setResults(null);
      onAiFilter?.(null);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setQ('');
    setResults(null);
    setErred(false);
    onAiFilter?.(null);
  }

  const count = results?.length ?? null;

  return (
    <div className="relative z-50 overflow-hidden rounded-xl border border-lime-300/50 bg-gradient-to-br from-lime-50/70 via-surface to-surface p-6 md:p-8 dark:from-lime-300/[0.06] dark:via-surface dark:to-surface">
      {/* 헤더 — AI 브랜딩 */}
      <div className="mb-4 flex items-center gap-2">
        <SectionLogo
          name="search-zone"
          label="Search Zone"
          className="h-9 text-foreground md:h-12"
        />
        <span className="inline-flex items-center gap-1 rounded-pill bg-lime-300 px-2 py-0.5 text-[10px] font-black text-ink-900">
          <Sparkles size={11} /> AI
        </span>
      </div>

      {/* 메인 검색 입력 — 기존 서치바처럼 크게, AI 답게 스파클 + 라임 글로우 */}
      <div className="relative w-full">
        <Sparkles
          className="absolute left-4 top-1/2 -translate-y-1/2 text-lime-500 dark:text-lime-300"
          size={20}
          aria-hidden
        />
        <input
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setShowSuggest(true);
          }}
          onFocus={() => {
            if (q.trim()) setShowSuggest(true);
          }}
          // 드롭다운 항목은 onMouseDown 에서 preventDefault 하므로 클릭해도 blur 가 나지 않는다.
          // 따라서 지연 없이 즉시 닫아도 안전하다(지연을 두면 딴 곳을 눌러도 드롭다운이 잠깐 남았다).
          onBlur={() => setShowSuggest(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              // 이름 후보가 있으면 첫 후보로 바로 이동(핀+카드). 없으면 자연어 AI 검색.
              if (canSuggest && showSuggest && nameMatches.length > 0) {
                pick(nameMatches[0]);
              } else {
                setShowSuggest(false);
                run();
              }
            } else if (e.key === 'Escape') {
              setShowSuggest(false);
            }
          }}
          placeholder="팝업 이름 또는 느낌으로 검색 — 예: 마뗑킴, 비 오는 날 감성 카페"
          aria-label="팝업 이름·AI 검색"
          autoComplete="off"
          className="h-14 w-full rounded-pill border-2 border-lime-300/40 bg-surface py-3.5 pl-12 pr-24 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-lime-400 focus:outline-none focus:ring-4 focus:ring-lime-300/20 md:text-base"
        />
        <button
          type="button"
          onClick={() => {
            setShowSuggest(false);
            run();
          }}
          disabled={loading || !q.trim()}
          aria-label="AI 검색 실행"
          className="absolute right-1.5 top-1/2 inline-flex h-11 -translate-y-1/2 items-center gap-1.5 rounded-pill bg-lime-300 px-4 text-sm font-bold text-ink-900 transition hover:bg-lime-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          찾기
        </button>

        {/* 이름 즉시검색 드롭다운 — 고르면 지도가 그 핀으로 이동 + 카드 오픈 */}
        {canSuggest && showSuggest && nameMatches.length > 0 && (
          <ul className="absolute left-0 right-0 top-[calc(100%+6px)] z-[60] max-h-[320px] overflow-y-auto custom-scrollbar rounded-2xl border border-[var(--color-border)] bg-surface shadow-2xl">
            {nameMatches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  // input blur 로 드롭다운이 닫히기 전에 클릭이 처리되도록
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(p)}
                  className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-lime-300/10"
                >
                  <MapPin size={16} className="shrink-0 text-lime-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-foreground">
                      {p.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.location || '위치 정보 없음'}
                    </span>
                  </span>
                  {/* 지도 모드면 해당 핀으로 이동하고, 모달(글로벌 검색)에선 상세로 보낸다.
                      문구가 실제 동작과 어긋나면 사용자가 어디로 가는지 예측할 수 없다. */}
                  <span className="shrink-0 text-[10px] font-bold text-lime-600 dark:text-lime-300">
                    {mapMode ? '지도에서 보기' : '상세 보기'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 결과 피드백 */}
      {(count !== null || erred) && (
        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
          <span className={erred ? 'font-medium text-hot-500' : 'text-muted-foreground'}>
            {erred
              ? 'AI 검색이 잠시 안 돼요. 다시 시도해 주세요.'
              : count === 0
                ? '맞는 팝업을 못 찾았어요. 다르게 말해볼까요?'
                : mapMode
                  ? `지도에 ${count}곳만 표시 중 ✨`
                  : `${count}곳 찾았어요 ✨`}
          </span>
          <button
            type="button"
            onClick={reset}
            className="shrink-0 font-bold text-lime-700 hover:underline dark:text-lime-300"
          >
            {mapMode ? '전체 지도 보기' : '초기화'}
          </button>
        </div>
      )}

      {/* 결과 목록 — 지도가 없는 모달 모드에서만(맵 모드는 지도 핀으로 표시) */}
      {!mapMode && results && results.length > 0 && (
        <ul className="mt-3 max-h-[360px] divide-y divide-[var(--color-border)] overflow-y-auto custom-scrollbar rounded-lg border border-[var(--color-border)]">
          {results.map((r) => (
            <li key={r.id}>
              <Link
                href={`/popup/${r.id}`}
                className="group flex items-center gap-3 p-3 transition-colors hover:bg-lime-300/10"
              >
                <span className="shrink-0 text-lime-500">
                  <MapPin size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground group-hover:text-lime-600 dark:group-hover:text-lime-300">
                    {r.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.location || '위치 정보 없음'}
                  </p>
                </div>
                <ArrowRight
                  size={14}
                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* 예시 칩 — 아직 검색 전일 때만 */}
      {count === null && !erred && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => run(ex)}
              className="rounded-pill border border-[var(--color-border)] bg-surface px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-lime-300 hover:text-lime-600 dark:hover:text-lime-300"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
