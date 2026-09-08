import type { MessageKey } from './i18n';
import { isUrgentPeriod, type SavedPeriodBadge } from './popupDetailStatus';

/**
 * 저장한 팝업의 기간 배지 — <b>문구와 색.</b>
 *
 * <p><b>왜 파일로 꺼냈나.</b> 원래 {@code app/HomeClient.tsx} 안의 비공개 함수였고, 그 주석이
 * 이미 이렇게 적고 있었다 — <i>"상세 화면의 {@code ddayText} 와 같은 모양이고, 같은 문구 키를
 * 쓴다. <b>같은 것을 두 화면이 다르게 부르면 안 된다.</b>"</i> 그런데 세 번째 화면(비교)이
 * 같은 배지를 그리게 되면서, 그 원칙을 지키려면 함수가 한 화면 안에 갇혀 있으면 안 됐다.
 *
 * <p>여기 있는 것은 <b>옮겨 적기</b>뿐이다. 무엇을 셀지는 {@code savedPeriodBadge} 가 정한다.
 */

/** 배지에 쓸 글자. 무엇을 셀지는 {@code savedPeriodBadge} 가 이미 정했다. */
export function savedBadgeText(badge: SavedPeriodBadge, t: (key: MessageKey) => string): string {
  if (badge.kind === 'ended') return t('detail.ended');
  if (badge.kind === 'closing-today') return t('detail.todayClosing');
  if (badge.kind === 'opens-in') return t('detail.opensIn').replace('{days}', String(badge.days));
  if (badge.kind === 'open-undated') return t('wish.undated');
  return `D-${badge.days}`;
}

/**
 * 그 배지의 색.
 *
 * <p><b>보이는 글자가 아니라 종류로 고른다.</b> 예전에 상세 화면이 문구를 되물어 색을 고르다가,
 * 문구를 옮기는 순간 끝난 팝업까지 강조색을 달았다({@code popupDetailStatus.ts} 의 경위).
 *
 * <p>강조색은 <b>서두를 이유가 있는 것</b>에만 준다. 끝난 것은 서둘러도 소용없고, 아직 안 연
 * 것은 서두를 일이 아니며, <b>마감일을 모르는 것에 마감 임박과 같은 색을 주면 모른다는 사실이
 * 지워진다.</b>
 */
export function savedBadgeTone(badge: SavedPeriodBadge): string {
  if (isUrgentPeriod(badge)) return 'bg-hot-400/90 text-white';
  if (badge.kind === 'ended') return 'bg-ink-900/70 text-cream-200/70';
  return 'bg-ink-900/70 text-cream-200';
}
