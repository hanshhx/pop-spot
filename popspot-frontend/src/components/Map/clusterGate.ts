/**
 * 마커를 이름표 낱개로 펼칠지, 묶음(클러스터)으로 보여줄지 가르는 조건.
 *
 * <p>{@link InteractiveMap} 의 markerClusters 안에서만 쓰던 조건식을 그대로 뺐다 — 컴포넌트를
 * 건드리지 않고도 이 조건 하나만 단위 테스트로 잠글 수 있다.
 *
 * <p>원래 클러스터링은 <b>모바일 폭에서만</b> 켜졌다. 홈 지도 탭 · /map · 작전지도 같은 전체 화면
 * 지도는 데스크톱에서도 넓어서, 마커마다 이름표를 그대로 띄워도 괜찮다는 전제였다. 그런데 랜딩
 * 페이지의 지도는 655×370 정도의 작은 카드다. 성수처럼 112개가 몰린 슬라이스를 그 카드에 그대로
 * 펼치면 이름표끼리 겹쳐 뭉개진다(실측 — 「샷포로 프리미엄 비」·「뷰오리 드림니트」 등이 같은
 * 몇 픽셀에 쌓인다).
 *
 * <p>{@code forceCluster} 는 그 전제가 깨지는 자리를 위해 <b>폭 조건만</b> 우회한다. 나머지
 * 탈출구 — 줌 16 이상이면 낱개로 푸는 것, showPath(경로 모드)·PLAN 모드에서는 클러스터링을
 * 아예 안 쓰는 것 — 는 그대로 둔다.
 *
 * @returns true 면 클러스터링을 <b>끄고</b> 마커를 낱개로 그린다(호출부의 변수명과 같은 뜻).
 */
export function isClusteringDisabled(params: {
  isMobileViewport: boolean;
  forceCluster: boolean;
  zoomLevel: number;
  showPath: boolean;
  mode: 'DEFAULT' | 'PLAN';
}): boolean {
  const { isMobileViewport, forceCluster, zoomLevel, showPath, mode } = params;
  return (!isMobileViewport && !forceCluster) || zoomLevel >= 16 || showPath || mode === 'PLAN';
}
