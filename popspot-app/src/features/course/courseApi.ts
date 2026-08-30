import { apiFetch } from '@/lib/api';
import type { CourseItem } from '@/types/popup';

/**
 * POP-COURSE — 웹 홈의 COURSE 탭이 부르는 것과 같은 두 문.
 *
 * <p>{@code GET /api/courses/recommend?vibe=} 로 코스를 받고, {@code POST /api/my-courses} 로
 * 저장한다. 앱이 따로 계산하지 않는다 — 추천은 서버의 LLM 이 한다(실측 3.2초).
 *
 * <h3>돌아오는 것이 우리 팝업이 아니다</h3>
 *
 * <p><b>중요.</b> 응답의 {@code id} 는 팝업 id 가 아니라 <b>1부터 세는 순번</b>이고, 이름도 우리
 * DB 에 없는 것이 온다. 실측(2026-08-30): "스파클링 팝업스토어" · "플랜트랩 카페" 등 다섯 곳 모두
 * {@code /api/popups} 1,455건 어디에도 없었다. 즉 LLM 이 <b>동네를 아는 지식으로 코스를 지어내는</b>
 * 것이지, 우리가 수집한 팝업을 고르는 것이 아니다.
 *
 * <p>그래서 앱은 이 항목을 눌러도 팝업 상세로 보내지 않는다. 웹은
 * {@code router.push('/popup/' + item.id)} 로 보내는데, 우리 팝업 id 는 185 부터 시작하므로
 * {@code /popup/1} 은 <b>존재하지 않는 페이지</b>다. 그 링크를 그대로 옮기면 앱에서도 같은 막다른
 * 길이 된다.
 *
 * <p>좌표는 진짜다 — 그래서 지도에 그리고 최단 동선 플래너로 넘기는 것은 그대로 된다.
 */

/** 시안·웹이 함께 쓰는 네 분위기. {@code value} 는 서버로 그대로 나가는 검색어라 한국어 고정. */
export const VIBES = [
  { value: '핫플', no: '01', label: '핫플레이스', desc: '지금 가장 뜨거운' },
  { value: '데이트', no: '02', label: '데이트', desc: '둘이 가기 좋은' },
  { value: '사진', no: '03', label: '사진 명소', desc: '찍기 좋은 스팟' },
  { value: '힐링', no: '04', label: '휴식·힐링', desc: '잠시 멈출 곳' },
] as const;

export type CourseResult =
  | { kind: 'ok'; course: CourseItem[] }
  | { kind: 'error'; message: string };

/**
 * 분위기 하나로 코스를 받는다.
 *
 * <p>서버가 <b>JSON 을 문자열로</b> 돌려주기도 해서 웹은 {@code res.text()} 후 직접 파싱한다.
 * 같은 방식을 쓴다 — {@code res.json()} 만 믿으면 그 경우에 조용히 실패한다.
 */
export async function recommendCourse(vibe: string): Promise<CourseResult> {
  const trimmed = vibe.trim();
  if (!trimmed) return { kind: 'error', message: '분위기를 입력해주세요.' };

  try {
    const res = await apiFetch(`/api/courses/recommend?vibe=${encodeURIComponent(trimmed)}`);
    if (!res.ok) return { kind: 'error', message: '코스를 받지 못했어요. 잠시 후 다시 시도해 주세요.' };

    const text = await res.text();
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { kind: 'error', message: '이 분위기로는 코스를 만들지 못했어요. 다른 말로 물어봐 주세요.' };
    }
    return { kind: 'ok', course: parsed as CourseItem[] };
  } catch {
    return { kind: 'error', message: '서버에 연결하지 못했습니다.' };
  }
}

/**
 * 마이페이지에 저장.
 *
 * <p>이름에 분위기 값을 섞지 않는다 — 그 값은 LLM 검색어라 한국어로 고정돼 있고, 저장 이름은
 * 사용자가 보는 말이어야 한다(웹도 같은 이유로 기본 이름을 쓴다).
 */
export async function saveCourse(
  userId: string,
  course: CourseItem[],
): Promise<string | null> {
  try {
    const res = await apiFetch('/api/my-courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        courseName: `내 코스 (${new Date().toLocaleDateString('ko-KR')})`,
        courseData: JSON.stringify(course),
      }),
    });
    return res.ok ? null : '저장하지 못했어요.';
  } catch {
    return '서버에 연결하지 못했습니다.';
  }
}
