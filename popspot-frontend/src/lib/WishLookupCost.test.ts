import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const home = readFileSync(join(process.cwd(), 'app/HomeClient.tsx'), 'utf8');
const controller = readFileSync(
  join(
    process.cwd(),
    '../popspot-backend/src/main/java/com/example/popspotbackend/controller/PopupStoreController.java',
  ),
  'utf8',
);

/**
 * <b>저장 목록을 그리는 값으로 조회수를 올리지 않는다.</b>
 *
 * <p><b>왜 지키나.</b> {@code GET /api/popups/{id}} 는 읽기가 아니라 쓰기다 — 부를 때마다
 * {@code viewCount} 를 1 올리고 YouTube 검색을 한 번 태운다. 백엔드 컨트롤러가 그 사실을 주석에
 * 직접 적어 두었다("진입할 때마다 조회수를 1 올리는 부수효과가 있어 캐시 헤더를 붙이지 않는다").
 *
 * <p>2026-09-06 에 저장 목록이 끝난 팝업의 이름을 알아내려고 이 엔드포인트를 쓰기 시작했는데,
 * 다시 묻지 않을 장치를 두지 않아 <b>MY 탭에 들어갈 때마다 담아 둔 개수만큼</b> 조회수가 오르고
 * 외부 API 가 호출됐다. 아무도 보지 않은 팝업의 조회수가 오르는 셈이고, 인프라 비용이 0원이어야
 * 하는 서비스에서 카드 한 장 값으로는 너무 비싸다.
 *
 * <p><b>왜 이렇게 검사하나.</b> 이 비용은 <b>화면에 아무 표시도 내지 않는다.</b> 캐시를 지우거나
 * abort 를 빼도 사용자에게는 똑같이 보이고, 시험도 타입도 통과한다. 사람이 백엔드 컨트롤러까지
 * 따라가 읽기 전에는 아무도 모른다.
 */

describe('저장 목록 조회의 대가', () => {
  /*
   * 이 시험의 전제가 바뀌면(백엔드가 부수효과를 없애면) 아래 검사들은 과잉이 된다.
   * 그때 이 줄이 먼저 깨져서 다시 생각하게 만든다.
   */
  it('상세 조회는 여전히 조회수를 올린다 — 전제 확인', () => {
    expect(controller).toContain('조회수를 1 올리는 부수효과');
  });

  it('한 번 알아낸 것은 적어 두고 다시 묻지 않는다', () => {
    expect(home).toContain('readSummaries(');
    expect(home).toContain('rememberSummaries(');
  });

  /*
   * 적어 둔 것을 "목록에 있는 것" 으로 합쳐 넘겨야 buildGuestWishlist 가 조회를 건너뛴다.
   * 읽기만 하고 넘기지 않으면 캐시가 있으나 마나다 — 요청은 그대로 나간다.
   */
  it('적어 둔 것을 조회 대상에서 빼도록 넘긴다', () => {
    expect(home).toMatch(/const known = \[\.\.\.catalogPopups, \.\.\..*summaryToPopup\)\]/);
    expect(home).toContain('buildGuestWishlist(readGuestWishlist(), known,');
  });

  /*
   * 알아낸 것을 적기 전에 화면 갱신 여부를 먼저 보고 빠져나가면, 떠난 경우에 그 요청의 대가만
   * 치르고 아무것도 안 남는다 — 다음 방문에서 같은 요청이 또 나간다.
   */
  it('화면을 버리더라도 알아낸 것은 적어 둔다', () => {
    const remember = home.indexOf('rememberSummaries(learned, now)');
    const bail = home.indexOf('if (controller.signal.aborted) return');
    expect(remember).toBeGreaterThan(-1);
    expect(bail).toBeGreaterThan(remember);
  });

  /*
   * 예전에는 플래그로 setState 만 막았다. 요청은 끝까지 날아가므로, 탭을 빠르게 오가면 같은 id 의
   * 요청이 겹쳐 나가고 그 하나하나가 조회수를 올린다.
   */
  it('떠나면 요청을 실제로 끊는다 — 플래그로 setState 만 막지 않는다', () => {
    expect(home).toContain('new AbortController()');
    expect(home).toContain('return () => controller.abort()');
    expect(home).toContain('signal: lookupSignal(controller)');
  });

  it('끊기와 타임아웃을 함께 건다', () => {
    expect(home).toContain('AbortSignal.any([controller.signal, AbortSignal.timeout(');
  });
});
