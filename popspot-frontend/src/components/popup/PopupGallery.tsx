'use client';

import { X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import {
  countDropped,
  creditNames,
  renderableGalleryImages,
  type GalleryImage,
} from '@/lib/galleryImages';
import { useLocale } from '@/lib/i18n';

/**
 * 소개 아래 '주최측 제공 자료' 갤러리.
 *
 * <p><b>언제 보이나.</b> 주최측이 보내온 실사진(CRAWLED·USER)이 대표 말고 더 있을 때만. 오늘
 * 살아 있는 팝업은 전부 스톡 대표 한 장이라 이 블록은 그려지지 않는다 — 빈 껍데기나 "준비 중"
 * 자리를 만들지 않는다.
 *
 * <p><b>왜 {@code next/image} 가 아닌가.</b> 두 가지다. (1) 인프라 비용 0원이 절대 조건인데
 * Vercel 의 이미지 최적화는 무료 한도가 있고 넘으면 과금된다. (2) 자료는 미리 webp 로 줄여
 * {@code public/} 에 두므로 런타임 변환이 할 일이 없다. 음악 커버·배경도 같은 이유로 raw
 * {@code <img>} 다.
 *
 * <p><b>왜 잘라내지 않나.</b> 카드뉴스는 그림이 아니라 <b>글이 얹힌 그림</b>이다.
 * {@code object-cover} 로 비율을 맞추면 정작 읽어야 할 글이 잘려 나간다. 그래서 원래 비율을
 * 그대로 두고, 작아서 안 읽히면 눌러서 크게 볼 수 있게 했다.
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
  const [openAt, setOpenAt] = useState<number | null>(null);

  const shown = renderableGalleryImages(images, API_ORIGIN);
  const dropped = countDropped(images, API_ORIGIN);
  const credits = creditNames(shown);

  const close = useCallback(() => setOpenAt(null), []);

  /* 크게 보기는 Escape 로도 닫혀야 한다 — 모바일 뒤로가기 말고는 나갈 길이 없으면 갇힌다. */
  useEffect(() => {
    if (openAt === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openAt, close]);

  if (shown.length === 0) return null;

  /* 인덱스를 함께 들고 다닌다 — 대체 텍스트의 "n번째" 가 열린 장과 어긋나면 안 된다. */
  const opened = openAt !== null && shown[openAt] ? { image: shown[openAt], index: openAt } : null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-black">{t('detail.galleryTitle')}</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map((image, index) => (
          <button
            key={image.imageUrl}
            type="button"
            onClick={() => setOpenAt(index)}
            className="overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:opacity-90 dark:border-white/10 dark:bg-[#111]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- 위 주석: 비용 0원 제약 + 이미 webp 로 줄여 둔 자료 */}
            <img
              src={image.imageUrl}
              alt={`${popupName} — ${t('detail.galleryTitle')} ${index + 1}`}
              loading="lazy"
              decoding="async"
              className="h-auto w-full"
            />
          </button>
        ))}
      </div>

      {/* 출처는 묶음 아래 한 번. 여덟 장에 여덟 번 적으면 읽히지 않는다(저작권법 §37). */}
      {credits.length > 0 && (
        <p className="mt-3 text-xs font-semibold text-muted-foreground">
          {t('detail.galleryProvidedBy')} · {credits.join(' · ')}
        </p>
      )}

      {/*
        상한에 걸려 못 그린 것이 있으면 숫자로 말한다. 조용히 자르면 "전부 올렸다" 로 읽히고,
        등록해 놓고 안 보이는 이유를 아무도 못 찾는다.
      */}
      {dropped > 0 && <p className="mt-1 text-xs text-muted-foreground">+{dropped}</p>}

      {opened && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={close}
          role="presentation"
        >
          <button
            type="button"
            onClick={close}
            aria-label={t('common.close')}
            className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- 위와 같은 이유 */}
          <img
            src={opened.image.imageUrl}
            alt={`${popupName} — ${t('detail.galleryTitle')} ${opened.index + 1}`}
            className="max-h-[90vh] max-w-full rounded-xl object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
}
