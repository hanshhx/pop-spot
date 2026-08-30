import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({ apiJson: vi.fn() }));
vi.mock('@/lib/devMockPopups', () => ({ devMockPopups: () => [] }));

const { derive } = await import('./usePopupStore');
import type { PopupStore } from '@/types/popup';

/**
 * 목록에서 화면이 쓰는 네 갈래를 만드는 계산.
 *
 * <p>여기가 틀리면 팝업이 화면에서 통째로 사라지거나, 반대로 끝난 팝업이 남는다. 각 단계가
 * <b>무엇을 빼는지</b>를 한 단계씩 못박는다 — 웹의 같은 계산이 화면 파일(3,300줄) 안에 흩어져
 * 있어서 테스트가 없다.
 */

const TODAY = new Date(2026, 7, 30); // 2026-08-30

const p = (id: number, extra: Partial<PopupStore> = {}): PopupStore =>
  ({
    id,
    name: `팝업 ${id}`,
    location: '서울 성동구',
    status: 'ACTIVE',
    viewCount: 0,
    latitude: '37.5443',
    longitude: '127.0557',
    startDate: '2026-08-01',
    endDate: '2026-09-30',
    ...extra,
  }) as PopupStore;

const ids = (list: PopupStore[]) => list.map((x) => x.id).sort((a, b) => a - b);

describe('derive — 1단계 open', () => {
  it('이미 끝난 팝업을 뺀다', () => {
    const out = derive([p(1), p(2, { endDate: '2026-08-29' })], TODAY);
    expect(ids(out.open)).toEqual([1]);
  });

  it('아직 시작하지 않은 팝업을 뺀다', () => {
    const out = derive([p(1), p(2, { startDate: '2026-09-01' })], TODAY);
    expect(ids(out.open)).toEqual([1]);
  });

  it('날짜가 둘 다 없으면 뺀다', () => {
    const out = derive([p(1), p(2, { startDate: undefined, endDate: undefined })], TODAY);
    expect(ids(out.open)).toEqual([1]);
  });

  it('종료일만 없고 시작한 지 90일이 넘으면 뺀다', () => {
    const out = derive(
      [p(1), p(2, { startDate: '2023-01-01', endDate: undefined })],
      TODAY,
    );
    expect(ids(out.open)).toEqual([1]);
  });

  it('종료일만 없어도 최근에 시작했으면 남긴다 — 상시 운영이거나 못 뽑았을 뿐이다', () => {
    const out = derive([p(2, { startDate: '2026-08-20', endDate: undefined })], TODAY);
    expect(ids(out.open)).toEqual([2]);
  });

  it('종료일 당일은 아직 열려 있다', () => {
    expect(ids(derive([p(1, { endDate: '2026-08-30' })], TODAY).open)).toEqual([1]);
  });
});

describe('derive — 2단계 mappable', () => {
  it('좌표가 없으면 지도에서 뺀다. 다만 open 에는 남는다', () => {
    const out = derive([p(1), p(2, { latitude: undefined, longitude: undefined })], TODAY);
    expect(ids(out.open)).toEqual([1, 2]);
    expect(ids(out.mappable)).toEqual([1]);
  });

  it('공백만 든 좌표도 뺀다 — Number(" ") 가 0 이라 (0,0) 에 찍히던 자리', () => {
    const out = derive([p(1), p(2, { latitude: ' ', longitude: ' ' })], TODAY);
    expect(ids(out.mappable)).toEqual([1]);
  });

  it('서울 밖 좌표를 뺀다 — 우리 타일이 서울만 담고 있다', () => {
    // 수원 스타필드. 표기는 "서울 수원시" 로 들어오지만 좌표가 서울 박스 밖이다.
    const out = derive([p(1), p(2, { latitude: '37.267', longitude: '126.961' })], TODAY);
    expect(ids(out.open)).toEqual([1, 2]);
    expect(ids(out.mappable)).toEqual([1]);
  });

  it('한 좌표에 40개를 넘겨 뭉치면 지역 중심점으로 보고 전부 뺀다', () => {
    const heap = Array.from({ length: 41 }, (_, i) =>
      p(100 + i, { latitude: '37.55', longitude: '126.99' }),
    );
    const out = derive([p(1), ...heap], TODAY);
    expect(ids(out.mappable)).toEqual([1]);
    // 지도에서만 뺀다 — 목록에는 그대로 있다.
    expect(out.open).toHaveLength(42);
  });
});

describe('derive — 3단계 popAll', () => {
  it('같은 행사가 이름만 달라도 한 줄로 묶는다', () => {
    const out = derive(
      [
        p(1, { name: '주술회전 사멸회유 팝업스토어' }),
        p(2, { name: '주술회전(사멸회유)' }),
      ],
      TODAY,
    );
    expect(out.mappable).toHaveLength(2);
    expect(out.popAll).toHaveLength(1);
  });

  it('묶으면서 조회수를 합산한다 — 쪼개졌다고 인기순에서 밀리면 안 된다', () => {
    const out = derive(
      [
        p(1, { name: '주술회전 사멸회유 팝업스토어', viewCount: 67 }),
        p(2, { name: '주술회전(사멸회유)', viewCount: 157 }),
      ],
      TODAY,
    );
    expect(out.popAll[0].viewCount).toBe(224);
  });

  it('다른 행사는 안 묶는다', () => {
    const out = derive([p(1, { name: '올리브영N 성수' }), p(2, { name: '은혼 팝업' })], TODAY);
    expect(out.popAll).toHaveLength(2);
  });
});

describe('derive — 전체', () => {
  it('빈 목록도 견딘다', () => {
    expect(derive([], TODAY)).toEqual({ open: [], mappable: [], popAll: [] });
  });

  it('단계가 좁아지는 순서를 지킨다 — catalog ⊇ open ⊇ mappable ⊇ popAll', () => {
    const catalog = [
      p(1),
      p(2, { endDate: '2020-01-01' }),
      p(3, { latitude: undefined }),
      p(4, { latitude: '35.1', longitude: '129.0' }),
    ];
    const out = derive(catalog, TODAY);
    expect(catalog.length).toBeGreaterThanOrEqual(out.open.length);
    expect(out.open.length).toBeGreaterThanOrEqual(out.mappable.length);
    expect(out.mappable.length).toBeGreaterThanOrEqual(out.popAll.length);
  });

  it('원본 배열을 고치지 않는다', () => {
    const catalog = [p(1), p(2)];
    derive(catalog, TODAY);
    expect(catalog).toHaveLength(2);
  });
});
