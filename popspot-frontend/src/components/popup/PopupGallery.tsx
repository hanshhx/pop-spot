'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, useState } from 'react';

import {
  countDropped,
  creditNames,
  renderableGalleryImages,
  type GalleryImage,
} from '@/lib/galleryImages';
import { useLocale } from '@/lib/i18n';

/**
 * 주최측 제공 자료를 <b>한 장씩 넘겨 보는</b> 갤러리.
 *
 * <p><b>왜 격자가 아닌가.</b> 처음에는 작은 그림 여러 장을 격자로 깔았다. 카드뉴스는 그림이 아니라
 * <b>글이 얹힌 그림</b>이고 차례가 있는 한 벌인데, 격자는 그 둘을 다 망친다 — 한 칸이 작아 글이 안
 * 읽히고, 여러 장이 동시에 보여 읽는 순서가 사라진다. 한 장씩 크게 보여주는 쪽이 원래 만들어진
 * 방식에 맞는다.
 *
 * <p><b>왜 가로 스냅 스크롤인가.</b> 손가락 처리를 직접 짜지 않아도 모바일 스와이프가 그대로
 * 따라온다(관성·튕김까지 브라우저가 한다). 화살표는 그 위에 얹은 것뿐이라, 둘이 어긋날 여지가
 * 없다 — 한쪽만 고쳐지는 사고가 안 난다.
 *
 * <p><b>왜 잘라내지 않나.</b> {@code object-contain} 이라 어떤 비율이 와도 한 조각도 안 잘린다.
 * 세로가 남으면 여백이 생기지만, 카드뉴스에서 잘린 글자보다 여백이 낫다.
 *
 * <p><b>왜 {@code next/image} 가 아닌가.</b> 인프라 비용 0원이 절대 조건인데 Vercel 이미지
 * 최적화는 무료 한도를 넘으면 과금된다. 자료는 미리 webp 로 줄여 {@code public/} 에 두므로
 * 런타임 변환이 할 일이 없다.
 */

/** CSP 가 허용하는 백엔드 오리진. 빌드 시점에 박히는 공개 값이다. */
const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL;

interface PopupGalleryProps {
  images?: GalleryImage[] | null;
  /** 대체 텍스트에 쓸 팝업 이름. 화면에 안 보이는 사람에게 이 그림이 무엇인지 알려 준다. */
  popupName: string;
}

export function PopupGallery({ images, popupName }: PopupGalleryProps) {
  const { t } = useLocale();
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const shown = renderableGalleryImages(images, API_ORIGIN);
  const dropped = countDropped(images, API_ORIGIN);
  const credits = creditNames(shown);

  /* 손가락으로 쓸어 넘겼을 때 번호를 맞춘다. 화살표는 이것 없이도 동작한다. */
  const syncIndex = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    setIndex(Math.round(track.scrollLeft / track.clientWidth));
  };

  if (shown.length === 0) return null;

  const last = shown.length - 1;
  const atStart = index <= 0;
  const atEnd = index >= last;

  /**
   * 화살표 한 번에 한 칸.
   *
   * <p><b>지금 어디인지는 스크롤 위치에서 읽는다.</b> 상태는 번호를 그리는 용도일 뿐이다. 손가락으로
   * 쓸어 넘기면 위치는 바뀌는데 상태는 scroll 이벤트가 와야 따라오는데, 그 이벤트가 늦거나 안 오는
   * 자리에서 상태를 믿고 계산하면 3번 장을 보는 사람이 다음을 눌렀을 때 <b>2번으로 되돌아간다.</b>
   *
   * <p><b>계산도 명령도 setIndex 밖에서 한다.</b> 안에 넣었더니 한 번 눌러도 두 칸씩 갔다 —
   * React 는 개발 모드에서 상태 갱신 함수를 일부러 두 번 부르는데(순수한지 보려고), 두 번째 호출이
   * 이미 옮겨진 위치를 다시 읽어 한 칸을 더 갔다. 갱신 함수는 순수해야 한다.
   */
  const step = (delta: number) => {
    const track = trackRef.current;
    const here =
      track && track.clientWidth > 0 ? Math.round(track.scrollLeft / track.clientWidth) : index;
    const next = Math.min(Math.max(here + delta, 0), last);
    /*
     * <b>부드러운 이동을 쓰지 않는다.</b> 애니메이션은 화면을 프레임 단위로 다시 그려야 진행되는데,
     * 그리기가 멈춘 자리에서는 이동이 시작만 하고 끝나지 않는다. 그러면 번호만 올라가고 그림은
     * 그대로 있는, 가장 나쁜 고장이 된다. 즉시 이동은 어디서나 같은 결과를 낸다.
     */
    if (track) track.scrollTo({ left: track.clientWidth * next });
    setIndex(next);
  };

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-black">{t('detail.galleryTitle')}</h2>

      <div className="relative mx-auto w-full max-w-md">
        <div
          ref={trackRef}
          onScroll={syncIndex}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-2xl border border-gray-200 bg-gray-50 [scrollbar-width:none] dark:border-white/10 dark:bg-white/5 [&::-webkit-scrollbar]:hidden"
        >
          {shown.map((image, i) => (
            <div key={image.imageUrl} className="w-full shrink-0 snap-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- 위 주석: 비용 0원 제약 + 이미 webp 로 줄여 둔 자료 */}
              <img
                src={image.imageUrl}
                alt={`${popupName} — ${t('detail.galleryTitle')} ${i + 1}`}
                /* 첫 장은 바로 보이는 자리라 미루지 않는다. 나머지는 넘길 때 온다. */
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                className="aspect-[3/4] w-full object-contain"
              />
            </div>
          ))}
        </div>

        {shown.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={atStart}
              aria-label={t('gallery.prev')}
              className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md transition hover:bg-black/75 disabled:pointer-events-none disabled:opacity-0"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={atEnd}
              aria-label={t('gallery.next')}
              className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md transition hover:bg-black/75 disabled:pointer-events-none disabled:opacity-0"
            >
              <ChevronRight size={20} />
            </button>

            {/* 몇 장 중 몇 번째인지. 끝이 어디인지 모르면 계속 넘겨 봐야 한다. */}
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-pill bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">
              {index + 1} / {shown.length}
            </span>
          </>
        )}
      </div>

      {/* 출처는 묶음 아래 한 번. 여덟 장에 여덟 번 적으면 읽히지 않는다(저작권법 §37). */}
      {credits.length > 0 && (
        <p className="mt-3 text-center text-xs font-semibold text-muted-foreground">
          {t('detail.galleryProvidedBy')} · {credits.join(' · ')}
        </p>
      )}

      {/*
        상한에 걸려 못 그린 것이 있으면 숫자로 말한다. 조용히 자르면 "전부 올렸다" 로 읽히고,
        등록해 놓고 안 보이는 이유를 아무도 못 찾는다.
      */}
      {dropped > 0 && <p className="mt-1 text-center text-xs text-muted-foreground">+{dropped}</p>}
    </section>
  );
}
