'use client';

import { useRouter } from 'next/navigation';

import DeferredInteractiveMap from '@/components/Map/DeferredInteractiveMap';
import type { InteractiveMapProps } from '@/components/Map/InteractiveMap';

/**
 * 슬라이스 랜딩 지도의 핀 클릭만 감싸는 얇은 클라이언트 래퍼.
 *
 * <p>{@code app/popups/[slug]/page.tsx} 는 {@code metadata}·{@code notFound} 를 쓰는 서버
 * 컴포넌트라 {@code onMarkerClick} 같은 함수 prop 을 직접 넘길 수 없다 — 여기서만 라우팅을
 * 붙인다. 그 밖의 동작(지도 지연 로딩 등)은 그대로 {@link DeferredInteractiveMap} 에 맡긴다.
 *
 * <p>{@code localePrefix} 는 페이지가 이미 만들어 둔 값(홈 링크와 같은 것)을 그대로 받는다 —
 * 여기서 언어 코드로부터 새로 계산하지 않는다. 두 곳에서 각자 계산하면 한쪽만 고쳤을 때
 * 조용히 어긋난다.
 *
 * <p>{@code forceCluster} 와 {@code hideChrome} 도 여기서 고정으로 넘긴다 — 이 지도는 항상
 * 655×370 정도의 작은 카드 안에서만 쓰이므로 페이지마다 값을 고를 필요가 없다(각 prop 이
 * 필요한 이유는 {@code InteractiveMap.tsx} 의 prop 주석 참고). 홈·작전지도·검색 지도는 이
 * 래퍼를 거치지 않아 두 prop 다 넘겨받지 않고, 지금과 동작이 같다.
 */
export default function LandingMap({
  localePrefix,
  ...props
}: InteractiveMapProps & { localePrefix: string }) {
  const router = useRouter();
  return (
    <DeferredInteractiveMap
      {...props}
      forceCluster
      hideChrome
      onMarkerClick={(popupId) => router.push(`${localePrefix}/popup/${popupId}`)}
    />
  );
}
