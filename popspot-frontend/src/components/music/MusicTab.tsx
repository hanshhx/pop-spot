'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Dice5, Loader2, Music2, Play, Search, Ticket, X } from 'lucide-react';
import Link from 'next/link';

import { apiFetch } from '@/lib/api';
import { getAuthToken } from '@/lib/authStorage';
import { SpotifyConnectButton } from '@/features/music/SpotifyConnectButton';
import { MatchResult, MusicTrack } from '@/types/music';
import type { PopupStore } from '@/types/popup';
import { PopupCard } from '@/components/main/PopupCard';
import { useMusicPlayer } from './MusicPlayerProvider';

/**
 * 검색 디바운스 — 입력이 멈추고 N ms 후 한 번만 호출.
 * IME 조합 중에는 effect 가 흘러도 value 자체는 안정적이라 추가 처리 불필요.
 */
function useDebounce<T>(value: T, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/**
 * 무드 = '음악 분위기' + '그 분위기의 팝업 카테고리'를 한 쌍으로 묶은 것.
 *
 * <p>개선안 #5: 음악 탭이 스포티파이 앨범 그리드였는데, 팝스팟의 핵심(팝업 발견)에서 벗어나 있었다.
 * 이제 무드를 고르면 <b>그 무드의 팝업(사진 카드)</b>이 주 화면이고, 음악(배경음악 스트립)은 위젯으로 강등한다.
 * {@code music} = 배경음악 검색 키워드, {@code cats} = 그 무드로 보여줄 팝업 카테고리. "대충 붙인" 느낌이 없도록
 * 무드마다 음악·팝업을 함께 큐레이션했다.
 */
const MOODS: {
  id: string;
  label: string;
  desc: string;
  music: string;
  cats: string[];
}[] = [
  {
    id: 'chill',
    label: '감성·카페',
    desc: '잔잔하게 둘러보기',
    music: 'korean lofi cafe chill',
    cats: ['FOOD', 'CULTURE'],
  },
  {
    id: 'trend',
    label: '트렌디·K팝',
    desc: '지금 가장 힙한',
    music: 'k-pop hits 2025',
    cats: ['FASHION', 'BEAUTY'],
  },
  {
    id: 'cute',
    label: '아기자기',
    desc: '귀여운 캐릭터',
    music: 'korean cute bright pop',
    cats: ['CHARACTER'],
  },
  {
    id: 'art',
    label: '전시·아트',
    desc: '감각을 채우는',
    music: 'korean indie art',
    cats: ['CULTURE', 'TECH'],
  },
  {
    id: 'date',
    label: '데이트',
    desc: '둘이 설레는',
    music: 'korean rnb soul love',
    cats: ['FASHION', 'FOOD', 'BEAUTY'],
  },
  {
    id: 'rainy',
    label: '비 오는 날',
    desc: '차분하게 젖어드는',
    music: 'korean rainy day ballad',
    cats: ['CULTURE', 'FOOD'],
  },
];

const MAX_POPUPS = 12;

export interface MusicTabProps {
  /** 무드로 걸러 카드로 보여줄 팝업 목록(홈의 allPopups). 없으면 배경음악 위젯만 노출. */
  popups?: PopupStore[];
  /** 팝업 카드 클릭 시 상세로 이동. 없으면 카드 클릭 무시. */
  onOpenPopup?: (id: number) => void;
}

/**
 * 홈 화면의 MUSIC 탭 — '음악 무드로 팝업 찾기'.
 *
 * - 무드 선택(주 인터랙션)
 * - 그 무드의 팝업 사진 카드 (PRIMARY)
 * - 이 무드의 배경음악 위젯: 스트립 + 검색 + 운명의 곡 + 패스포트 (SECONDARY, 강등)
 */
export default function MusicTab({ popups, onOpenPopup }: MusicTabProps) {
  const player = useMusicPlayer();

  const [activeMoodId, setActiveMoodId] = useState(MOODS[0].id);
  const activeMood = useMemo(
    () => MOODS.find((m) => m.id === activeMoodId) ?? MOODS[0],
    [activeMoodId],
  );

  // 무드로 거른 팝업. 매칭이 적으면 조회수 높은 팝업으로 채워 그리드가 비지 않게 한다.
  const moodPopups = useMemo(() => {
    const list = popups ?? [];
    if (list.length === 0) return [];
    const matched = list.filter((p) =>
      activeMood.cats.includes((p.category || 'ETC').toUpperCase()),
    );
    if (matched.length >= MAX_POPUPS) return matched.slice(0, MAX_POPUPS);
    const matchedIds = new Set(matched.map((p) => p.id));
    const filler = list
      .filter((p) => !matchedIds.has(p.id))
      .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    return [...matched, ...filler].slice(0, MAX_POPUPS);
  }, [popups, activeMood]);

  // 정렬 기준 — 추천순(무드 매칭 순) / 인기순 / 마감임박순 / 카테고리순.
  const [sortBy, setSortBy] = useState<'default' | 'popular' | 'dday' | 'category'>('default');

  const sortedMoodPopups = useMemo(() => {
    const arr = [...moodPopups];
    const dday = (p: PopupStore) => {
      if (!p.endDate) return Number.POSITIVE_INFINITY;
      const end = new Date(p.endDate);
      if (Number.isNaN(end.getTime())) return Number.POSITIVE_INFINITY;
      return Math.ceil((end.getTime() - Date.now()) / 86_400_000);
    };
    if (sortBy === 'popular') arr.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    else if (sortBy === 'dday') arr.sort((a, b) => dday(a) - dday(b));
    else if (sortBy === 'category')
      arr.sort((a, b) => (a.category || 'ETC').localeCompare(b.category || 'ETC'));
    return arr;
  }, [moodPopups, sortBy]);

  /* -------- 배경음악(강등된 위젯) -------- */
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const debouncedQuery = useDebounce(query, 250);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestBoxRef = useRef<HTMLDivElement>(null);

  const [popular, setPopular] = useState<MusicTrack[]>([]);
  const [results, setResults] = useState<MusicTrack[]>([]);
  const [searching, setSearching] = useState(false);

  const [moodTracks, setMoodTracks] = useState<MusicTrack[]>([]);
  const [moodLoading, setMoodLoading] = useState(false);

  const [rouletteLoading, setRouletteLoading] = useState(false);

  // 개인화: 로그인 유저의 재생 이력 취향 기반 '당신을 위한' 추천.
  const [forYou, setForYou] = useState<MusicTrack[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 인기곡(검색·무드 트랙이 모두 비었을 때의 최종 폴백)
  useEffect(() => {
    apiFetch('/api/music/popular?limit=12')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MusicTrack[]) => setPopular(data || []))
      .catch(() => setPopular([]));
  }, []);

  // '당신을 위한' — 로그인 상태에서만. 재생 이력이 쌓일수록 각자 다른 추천이 뜬다.
  useEffect(() => {
    let alive = true;
    const token = getAuthToken();
    setIsLoggedIn(!!token);
    if (!token) return;
    apiFetch('/api/music/for-you?limit=12')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MusicTrack[]) => {
        if (alive) setForYou(data || []);
      })
      .catch(() => {
        if (alive) setForYou([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  // 무드 변경 시 그 무드의 배경음악을 가져온다.
  useEffect(() => {
    let alive = true;
    setMoodLoading(true);
    apiFetch(`/api/music/category?keyword=${encodeURIComponent(activeMood.music)}&limit=12`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MusicTrack[]) => {
        if (alive) setMoodTracks(data || []);
      })
      .catch(() => {
        if (alive) setMoodTracks([]);
      })
      .finally(() => {
        if (alive) setMoodLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [activeMood]);

  // 자동완성
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }
    apiFetch(`/api/music/suggest?q=${encodeURIComponent(q)}&limit=8`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: string[]) => {
        setSuggestions(data || []);
        setActiveIndex(-1);
      })
      .catch(() => setSuggestions([]));
  }, [debouncedQuery]);

  // 입력만 해도 자동으로 검색 확정
  useEffect(() => {
    const q = debouncedQuery.trim();
    setSubmittedQuery(q);
  }, [debouncedQuery]);

  // 확정된 검색어로 실제 곡 검색
  useEffect(() => {
    const q = submittedQuery.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    apiFetch(`/api/music/search?q=${encodeURIComponent(q)}&limit=12`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MusicTrack[]) => setResults(data || []))
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, [submittedQuery]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        suggestBoxRef.current &&
        !suggestBoxRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setSuggestOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const submitSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setSubmittedQuery(trimmed);
    setSuggestOpen(false);
    inputRef.current?.blur();
  };

  const clearSearch = () => {
    setQuery('');
    setSubmittedQuery('');
    setSuggestions([]);
    setSuggestOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestOpen || suggestions.length === 0) {
      if (e.key === 'Enter') submitSearch(query);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = activeIndex >= 0 ? suggestions[activeIndex] : query;
      submitSearch(target);
    } else if (e.key === 'Escape') {
      setSuggestOpen(false);
    }
  };

  const handleRoulette = async () => {
    setRouletteLoading(true);
    try {
      const r = await apiFetch('/api/music/roulette', { method: 'POST' });
      if (!r.ok) return;
      const data: MatchResult = await r.json();
      if (data?.track) player.play(data.track);
    } finally {
      setRouletteLoading(false);
    }
  };

  const showSearch = submittedQuery.trim().length > 0;
  // 배경음악 스트립: 검색 중이면 검색결과, 아니면 무드 트랙, 그것도 없으면 인기곡.
  const strip: MusicTrack[] = showSearch ? results : moodTracks.length > 0 ? moodTracks : popular;

  return (
    <div className="relative w-full">
      {/* 헤더 */}
      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
              POP · MUSIC
            </p>
            <h2 className="mt-2 text-2xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
              무드로 고르는, <span className="text-lime-500 dark:text-lime-300">오늘의 팝업</span>
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              지금 기분에 맞는 무드를 고르면, 어울리는 팝업과 배경음악을 함께 골라드려요.
            </p>
          </div>
          {/* Spotify 연결 칩. Premium 이면 풀트랙, Free/미연결은 30초 미리듣기. */}
          <div className="shrink-0 pt-1">
            <SpotifyConnectButton />
          </div>
        </div>
      </header>

      {/* 당신을 위한 — 개인화 추천 (로그인 유저, 재생 이력 취향 기반) */}
      {isLoggedIn && forYou.length > 0 && (
        <section aria-label="당신을 위한 추천" className="mb-7">
          <div className="mb-3 flex items-baseline gap-2">
            <h3 className="text-base font-black text-foreground">
              당신을 위한 <span className="text-lime-500 dark:text-lime-300">추천</span>
            </h3>
            <span className="text-xs text-muted-foreground">들으신 곡 취향으로 골랐어요</span>
          </div>
          <div className="custom-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
            {forYou.map((t) => (
              <TrackChip key={t.id} track={t} onPlay={() => player.play(t, forYou)} />
            ))}
          </div>
        </section>
      )}

      {/* 무드 선택 — 주 인터랙션 */}
      <div className="mb-7 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {MOODS.map((m) => {
          const active = m.id === activeMoodId;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setActiveMoodId(m.id)}
              aria-pressed={active}
              className={`flex flex-col items-start rounded-2xl border px-3.5 py-3 text-left transition ${
                active
                  ? 'border-lime-400 bg-lime-300 text-ink-900 shadow-md'
                  : 'border-[var(--color-border)] bg-cream-200 text-foreground hover:border-lime-300/60 dark:bg-ink-800'
              }`}
            >
              <span className="text-sm font-black leading-tight">{m.label}</span>
              <span
                className={`mt-0.5 text-[11px] leading-tight ${active ? 'text-ink-900/70' : 'text-muted-foreground'}`}
              >
                {m.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* PRIMARY — 이 무드의 팝업 사진 카드 */}
      <section aria-label="이 무드의 팝업" className="mb-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h3 className="text-base font-black text-foreground">
              <span className="text-lime-500 dark:text-lime-300">{activeMood.label}</span> 무드의
              팝업
            </h3>
            <span className="text-xs text-muted-foreground">사진으로 훑어보세요</span>
          </div>
          <label className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">정렬</span>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'default' | 'popular' | 'dday' | 'category')
              }
              aria-label="팝업 정렬 기준"
              className="rounded-pill border border-[var(--color-border)] bg-surface px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:border-lime-400"
            >
              <option value="default">추천순</option>
              <option value="popular">인기순</option>
              <option value="dday">마감임박순</option>
              <option value="category">카테고리순</option>
            </select>
          </label>
        </div>

        {sortedMoodPopups.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {sortedMoodPopups.map((p) => (
              <PopupCard
                key={p.id}
                popup={p}
                className="w-full"
                onClick={() => onOpenPopup?.(p.id)}
              />
            ))}
          </div>
        ) : (
          <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--color-border)] bg-cream-200 px-6 py-16 text-center dark:bg-ink-800">
            <p className="text-sm font-bold text-foreground">이 무드의 팝업을 불러오는 중이에요</p>
            <p className="mt-1 text-xs text-muted-foreground">잠시 후 다시 확인해주세요</p>
          </div>
        )}
      </section>

      {/* SECONDARY — 이 무드의 배경음악 위젯 (강등) */}
      <section
        aria-label="이 무드의 배경음악"
        className="rounded-2xl border border-[var(--color-border)] bg-cream-100 p-4 dark:bg-ink-800/60 sm:p-5"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-lime-300/25 text-lime-600 dark:text-lime-300">
              <Music2 className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-black text-foreground">이 무드의 배경음악</h3>
              <p className="text-[11px] text-muted-foreground">
                {showSearch ? `검색 "${submittedQuery}"` : `${activeMood.label} 무드에 어울리는 곡`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRoulette}
              disabled={rouletteLoading}
              className="flex h-9 items-center gap-1.5 rounded-pill bg-gradient-to-r from-lime-400 to-emerald-400 px-3.5 text-xs font-black text-ink-900 transition hover:scale-[1.02] disabled:opacity-60"
            >
              {rouletteLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Dice5 className="h-3.5 w-3.5" />
              )}
              운명의 곡
            </button>
            <Link
              href="/music/passport"
              className="flex h-9 items-center gap-1.5 rounded-pill border border-[var(--color-border)] bg-surface px-3.5 text-xs font-bold text-foreground transition hover:bg-cream-300 dark:hover:bg-ink-700"
            >
              <Ticket className="h-3.5 w-3.5" />
              패스포트
            </Link>
          </div>
        </div>

        {/* 곡 검색 (컴팩트) */}
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSuggestOpen(true);
            }}
            onFocus={() => setSuggestOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="아티스트·곡명으로 직접 검색"
            className="h-10 w-full rounded-pill border border-[var(--color-border)] bg-surface pl-10 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-lime-400 focus:outline-none"
            autoComplete="off"
          />
          {searching ? (
            <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : query ? (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="검색 지우기"
              className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-foreground/5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}

          {/* 자동완성 드롭다운 */}
          {suggestOpen && suggestions.length > 0 && (
            <div
              ref={suggestBoxRef}
              role="listbox"
              className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-surface shadow-pop"
            >
              {suggestions.map((s, i) => (
                <button
                  key={`${s}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === i}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => submitSearch(s)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
                    activeIndex === i
                      ? 'bg-foreground/5 text-foreground'
                      : 'text-foreground/80 hover:bg-foreground/5'
                  }`}
                >
                  <Music2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{s}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 곡 스트립 (가로 스크롤) */}
        {moodLoading && !showSearch ? (
          <TrackStripSkeleton />
        ) : strip.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            아직 표시할 곡이 없어요. 검색해보거나 잠시 후 다시 시도해주세요.
          </p>
        ) : (
          <div className="custom-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
            {strip.map((t) => (
              <TrackChip key={t.id} track={t} onPlay={() => player.play(t, strip)} />
            ))}
          </div>
        )}

        {/* 어트리뷰션 (Spotify Branding Guidelines) */}
        <p className="mt-4 text-center text-[10px] tracking-wide text-muted-foreground">
          음원 제공 · <span className="font-bold text-[#1DB954]">Spotify</span> · Apple Music ·
          YouTube
        </p>
      </section>

      {/* 다음 추천 — 재생 중일 때 이어질 곡 (유튜브 up-next식, 재생 곡 기반 개인화) */}
      {player.current && player.autoQueue.length > 0 && (
        <section aria-label="다음 추천" className="mt-6">
          <div className="mb-3 flex items-baseline gap-2">
            <h3 className="text-base font-black text-foreground">다음 추천</h3>
            <span className="min-w-0 truncate text-xs text-muted-foreground">
              &ldquo;{player.current.trackName}&rdquo; 다음에 이어질 곡
            </span>
          </div>
          <div className="custom-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
            {player.autoQueue.map((t) => (
              <TrackChip key={t.id} track={t} onPlay={() => player.play(t, player.autoQueue)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* -------------------- 작은 부속 컴포넌트들 -------------------- */

/** 강등된 배경음악 스트립의 가로 곡 칩. */
function TrackChip({ track, onPlay }: { track: MusicTrack; onPlay: () => void }) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className="group w-[120px] shrink-0 snap-start text-left sm:w-[132px]"
    >
      <div className="relative aspect-square overflow-hidden rounded-xl bg-foreground/5 ring-1 ring-[var(--color-border)] transition group-hover:ring-foreground/30">
        {track.artworkUrlHires || track.artworkUrl ? (
          // Spotify/iTunes CDN 이미지 — next/image 화이트리스트 대신 <img> 사용.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={track.artworkUrlHires || track.artworkUrl}
            alt={track.trackName}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            <Music2 className="h-7 w-7" />
          </div>
        )}
        <div className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-lime-300 text-ink-900 shadow-lg">
            <Play className="ml-0.5 h-3.5 w-3.5" fill="currentColor" />
          </span>
        </div>
      </div>
      <p className="mt-1.5 truncate text-xs font-bold text-foreground">{track.trackName}</p>
      <p className="truncate text-[11px] text-muted-foreground">{track.artistName}</p>
    </button>
  );
}

function TrackStripSkeleton() {
  return (
    <div className="-mx-1 flex gap-3 overflow-hidden px-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="w-[120px] shrink-0 space-y-1.5 sm:w-[132px]">
          <div className="aspect-square animate-pulse rounded-xl bg-foreground/5" />
          <div className="h-2.5 w-3/4 animate-pulse rounded bg-foreground/5" />
          <div className="h-2.5 w-1/2 animate-pulse rounded bg-foreground/5" />
        </div>
      ))}
    </div>
  );
}
