'use client';

import InteractiveMap from '@/components/Map/InteractiveMap';
import type { PublicMapMarker } from '@/lib/mapMarkers';

/**
 * /map 의 지도 부분만 클라이언트로 분리.
 *
 * <p>page.tsx 를 서버 컴포넌트로 두기 위해서다 — 검색로봇이 읽을 제목·건수·지역 링크는 서버에서
 * 완성된 HTML 로 나가야 하고, 지도(MapLibre)는 브라우저에서만 동작한다. 한 파일에 두면 페이지
 * 전체가 클라이언트 컴포넌트가 되어 본문까지 JS 로만 그려진다.
 *
 * <p>InteractiveMap 은 props 가 전부 선택값이고 지역·기간 필터는 자기가 URL 에서 직접 읽으므로
 * (/map?region=seongsu 처럼) 여기서 넘겨줄 것이 없다.
 */
export default function MapClient({ initialMarkers }: { initialMarkers: PublicMapMarker[] }) {
  return (
    /* 70vh 는 화면에 따라 끝없이 늘어난다 — 27인치 세로 모니터에서는 1,000px 을 넘고,
       지도만 한 화면을 다 먹은 채 아래 목록·지역 링크가 첫 화면에서 사라진다.
       홈 지도가 이미 min(62svh, 560px) 로 같은 상한을 두고 있어 값을 맞춘다. */
    <div className="relative h-[min(70vh,640px)] min-h-[460px] w-full overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-lg shadow-black/5 dark:border-white/10 dark:bg-[#111] dark:shadow-black/30">
      <InteractiveMap initialMarkers={initialMarkers} />
    </div>
  );
}
