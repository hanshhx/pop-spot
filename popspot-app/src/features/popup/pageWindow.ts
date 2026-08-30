import type { PopAllQuery, RelaxSuggestion } from '@/lib/popAllQuery';

/**
 * 페이지 줄과 조건 완화 — 웹 {@code features/popup/PopAllModal.tsx} 에서 그대로 가져온 두 함수.
 *
 * <p>웹에서는 이 둘이 모달 컴포넌트 파일 안에 있고, 테스트가 그 파일을 직접 가져다 쓴다
 * ({@code pageWindow.test.ts}). 앱에서는 화면 파일과 분리했다 — 화면이 하나 더 생기면 컴포넌트
 * 파일에서 순수 함수를 꺼내야 하는데, 그때 옮기면 테스트 import 도 함께 흔들린다.
 */

/**
 * 조건 하나를 푸는 패치.
 *
 * <p>{@code keyword} 만 빈 문자열이고 나머지 셋은 null 이다. 이 갈래를 한 곳에 모아 두지 않으면
 * 부르는 자리마다 각자 틀린다.
 */
export function relaxPatch(field: RelaxSuggestion['field']): Partial<PopAllQuery> {
  return field === 'keyword' ? { keyword: '', page: 1 } : { [field]: null, page: 1 };
}

/**
 * 페이지 번호 줄에 실제로 그릴 것들 — 처음·끝과 현재 주변만, 사이는 생략 표시.
 *
 * <p>전체가 39페이지인데 서른아홉 개를 다 그리면 그 줄이 화면을 먹는다.
 *
 * <p><b>한 칸만 비면 접지 않는다.</b> 번호 하나를 「…」로 바꾸면 차지하는 자리는 그대로인데
 * 누를 수 있는 것만 하나 줄어든다 — 접는 이유가 자리를 아끼는 것이므로, 아껴지지 않으면
 * 접을 이유도 없다.
 */
export function pageWindow(page: number, totalPages: number): (number | 'gap')[] {
  const wanted = new Set([1, totalPages, page - 1, page, page + 1]);
  const shown = [...wanted].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  shown.forEach((p, i) => {
    if (i > 0) {
      const gapSize = p - shown[i - 1] - 1;
      if (gapSize === 1) out.push(p - 1);
      else if (gapSize > 1) out.push('gap');
    }
    out.push(p);
  });
  return out;
}
