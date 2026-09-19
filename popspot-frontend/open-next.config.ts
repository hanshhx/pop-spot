import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

/**
 * Next 를 Cloudflare Workers 위에서 돌리기 위한 설정.
 *
 * <p><b>{@code staticAssetsIncrementalCache} 를 고른 것이 이 파일의 전부다.</b> 기본값인
 * KV 기반 캐시를 쓰면 재검증할 때마다 KV <b>쓰기</b>가 한 건씩 생기는데, Workers 무료 티어의
 * KV 쓰기 한도는 <b>하루 1,000건</b>이다. 이 사이트는 {@code /popups/{slug}} 만 로케일당 282개,
 * 합쳐 846 페이지가 {@code revalidate=3600} 이다. 구글봇이 하루 한 바퀴만 돌아도 한도를 넘는다 —
 * <b>검색 유입이 늘수록 먼저 깨지는</b> 구조가 된다.
 *
 * <p>정적 자산 기반 캐시는 빌드 때 구운 결과를 그대로 읽으므로 KV 를 쓰지 않는다. 대신
 * 런타임 재검증이 없다 — 내용이 바뀌면 <b>다시 빌드해서 배포</b>해야 한다. 이 사이트는 크롤러가
 * 하루 단위로 팝업을 모으고 배포도 그 주기라 맞는다.
 *
 * <p>{@code enableCacheInterception} 은 캐시된 응답을 Next 라우터에 들어가기 <b>전에</b> 돌려준다.
 * 프리렌더된 890 페이지가 Worker 안에서 라우팅 비용을 치르지 않게 하는 장치다 — 무료 티어의
 * CPU 10ms 한도를 지키는 쪽에서도 이득이다.
 */
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
