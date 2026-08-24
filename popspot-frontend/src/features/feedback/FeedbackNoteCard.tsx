'use client';

import { useState } from 'react';
import { ChevronDown, MessageSquare } from 'lucide-react';

import { FeedbackForm } from './FeedbackForm';

interface FeedbackNoteCardProps {
  heading: string;
  note: string;
  cta: string;
}

/**
 * 검색 랜딩 정정 창구 — 그 자리에서 바로 쓰는 의견 폼.
 *
 * <p>이 페이지의 목록은 크롤러 자동 수집물이라 누락·오기가 생긴다. 그걸 가장 먼저 알아채는 사람은
 * 바로 그 키워드로 검색해 들어온 방문자인데, 예전엔 {@code /feedback} 페이지로 내보내는 링크뿐이었다.
 * 주 920명 중 다시 오는 사람이 7명(0.76%)인 서비스에서 한 번의 이탈 지점을 더 만드는 셈이라, 그
 * 자리에서 바로 쓰게 폼을 옮겨왔다.
 *
 * <p><b>접힌 채로 시작한다.</b> 목록마다 입력칸 네 개가 항상 붙어 있으면 스크롤만 늘어난다. 제목
 * 줄(전체가 버튼)을 눌러야 펴진다 — 접힌 상태는 예전 링크가 쓰던 만큼만 자리를 쓴다.
 *
 * <p><b>제출 성공 후엔 다시 접는다.</b> {@code FeedbackForm} 내부가 이미 성공 토스트
 * ({@code fb.sentTitle}/{@code fb.sentText})를 띄워준다. 여기서 "감사합니다" 문구를 새로 만드는
 * 대신 카드를 원래 높이로 되돌리는 쪽을 골랐다 — 새 copy 키 없이 끝난다.
 *
 * <p>게스트 모드 고정: 랜딩은 로그인 여부를 모르는(=모를 필요 없는) 화면이라 {@code userId} 를 항상
 * {@code null} 로 넘긴다. {@code FeedbackForm} 이 게스트 모드에서 보여주는 선택적 회신 이메일 칸이
 * 그대로 나온다.
 */
export function FeedbackNoteCard({ heading, note, cta }: FeedbackNoteCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-10 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-lg shadow-black/5 dark:border-white/10 dark:bg-[#17181c] dark:shadow-black/30 md:px-6">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full flex-col gap-3 text-left sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-bold md:text-base">
            <MessageSquare size={15} className="shrink-0 text-lime-500" />
            {heading}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground md:text-sm">{note}</p>
        </div>
        <span className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-pill border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-900 transition hover:border-lime-300 hover:bg-lime-50 md:text-sm dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-lime-300/40 dark:hover:bg-lime-300/10">
          {cta}
          <ChevronDown
            size={14}
            aria-hidden
            className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-white/10">
          <FeedbackForm userId={null} onSubmitted={() => setOpen(false)} />
        </div>
      )}
    </section>
  );
}
