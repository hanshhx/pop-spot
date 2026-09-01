import type { Metadata } from 'next';

import { PopupGallery } from '@/components/popup/PopupGallery';
import type { GalleryImage } from '@/lib/galleryImages';

/**
 * 제휴 자료 갤러리 확인용 화면. <b>서비스 화면이 아니다.</b>
 *
 * <p>갤러리는 주최측 자료가 실제로 등록된 팝업에서만 나타난다. 그런 팝업이 아직 없으므로
 * 서비스 화면에서는 <b>만든 것을 볼 방법이 없다</b> — 자료를 넣고 배포한 뒤에야 처음 보게 되는데,
 * 그때 잘못돼 있으면 이미 제휴처에 링크를 보낸 뒤다.
 *
 * <p>그래서 세 가지 경우를 나란히 놓는다. 하나만 보면 "그려진다" 밖에 모르지만, 셋을 같이 놓으면
 * <b>안 그려져야 할 때 안 그려지는지</b>가 같이 보인다 — 그쪽이 훨씬 자주 문제가 된다.
 */
export const metadata: Metadata = {
  title: '제휴 자료 갤러리 미리보기',
  // 검색에 잡히면 안 된다. 서비스 화면이 아니고 내용도 실제 팝업 정보가 아니다.
  robots: { index: false, follow: false },
};

/** 카드뉴스 크기(1080×1350)로 만든 샘플. 실제 자료가 아니라는 표시가 그림 안에 들어 있다. */
const SAMPLES: GalleryImage[] = Array.from({ length: 8 }, (_, i) => ({
  imageUrl: `/preview/gallery/sample-0${i + 1}.webp`,
  photoOrigin: 'USER',
  photoCreditName: '제주창조경제혁신센터',
}));

function Case({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12 border-t border-gray-200 pt-6 dark:border-white/10">
      <h2 className="text-sm font-black">{title}</h2>
      <p className="mb-2 text-xs text-muted-foreground">{note}</p>
      <div className="rounded-2xl bg-gray-50 p-4 dark:bg-white/5">{children}</div>
    </section>
  );
}

export default function GalleryPreviewPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-xl font-black">제휴 자료 갤러리 미리보기</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        서비스 화면이 아니다. 상세 페이지의 소개 아래에 이 모양으로 붙는다.
      </p>

      <Case
        title="1. 자료 8장"
        note="주최측이 보낸 카드뉴스. 화살표로 한 장씩 넘긴다(모바일에서는 스와이프)."
      >
        <PopupGallery images={SAMPLES} popupName="2026 제주 로컬브랜드 팝업스토어" />
      </Case>

      <Case
        title="2. 자료 없음 — 오늘의 팝업 1,405건"
        note="아래 칸이 비어 있어야 맞다. 제목만 남으면 사이트 전체에 빈 껍데기가 생긴 것이다."
      >
        <PopupGallery images={[]} popupName="자료 없는 팝업" />
      </Case>

      <Case
        title="3. 우리가 못 그리는 주소가 섞인 경우"
        note="남의 도메인 두 장은 CSP 가 막으므로 빼고, 우리 것 한 장만 그려져야 맞다."
      >
        <PopupGallery
          images={[
            { imageUrl: 'https://cdn.partner.co.kr/a.jpg', photoOrigin: 'USER' },
            SAMPLES[0],
            { imageUrl: '//evil.example.com/b.jpg', photoOrigin: 'USER' },
          ]}
          popupName="섞인 팝업"
        />
      </Case>
    </main>
  );
}
