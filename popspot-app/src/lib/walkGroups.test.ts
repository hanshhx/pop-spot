import { describe, expect, it } from 'vitest';

import { walkGroups, walkInfo } from './walkGroups';

/**
 * 걸어서 묶기.
 *
 * <p>작전지도({@code app/planning/page.tsx})가 쓰던 산수를 그대로 꺼내 온 것이다. 그 화면의 도보
 * 시간은 <b>라우팅 API 에서 온 적이 없다</b> — OSRM 은 지도에 선을 그리려고만 부르고 응답의
 * duration·distance 는 버린다. 그래서 이 계산은 좌표만 있으면 되고, 랜딩 840 개에 얹어도 호출이
 * 0 번이다.
 *
 * <p>값을 바꾸지 않는다. 1.3 배와 분속 67m 는 작전지도가 쓰던 그대로다 — 두 화면이 같은 거리를
 * 다르게 말하면 어느 쪽도 믿을 수 없다.
 */
/*
 * 좌표는 손으로 계산해 둔 값이다. 위도 0.005° ≈ 556m 이고, 도보 보정 1.3 배를 먹이면 723m,
 * 분속 67m 로 약 11분이다 — 20분 한도 안에 들어온다. 성수와 홍대는 직선 약 11.7km 라
 * 도보 15.3km, 228분이 되어 어떤 한도로도 묶이지 않는다.
 */
const 성수 = { lat: 37.5446, lng: 127.0559 };
const 성수옆 = { lat: 37.5496, lng: 127.0559 }; // 북쪽으로 0.005° ≈ 556m
const 홍대 = { lat: 37.5563, lng: 126.9236 };
const 홍대옆 = { lat: 37.5613, lng: 126.9236 };

describe('walkInfo', () => {
  it('1km 를 넘지 않으면 미터로 말한다', () => {
    const near = walkInfo(성수.lat, 성수.lng, 성수옆.lat, 성수옆.lng);
    // endsWith('m') 로는 '2.1km' 도 통과한다. 단위 자리를 통째로 본다.
    expect(near.dist).toMatch(/^\d+m$/);
    expect(near.time).toBeGreaterThan(0);
  });

  it('1km 를 넘으면 킬로미터로 말한다', () => {
    expect(walkInfo(성수.lat, 성수.lng, 홍대.lat, 홍대.lng).dist).toMatch(/^\d+\.\dkm$/);
  });

  it('같은 자리는 0분이다', () => {
    expect(walkInfo(37.5, 127.0, 37.5, 127.0)).toEqual({ dist: '0m', time: 0 });
  });

  it('작전지도와 같은 값을 낸다 — 1.3 배와 분속 67m', () => {
    // 위도 1도 = 6371km × π/180 = 111.1949km. × 1.3 = 144.5534km = 144553.4m.
    // 144553.4 / 67 = 2157.51 → 반올림 2158. 이 숫자가 두 상수를 동시에 붙잡는다.
    expect(walkInfo(37.0, 127.0, 38.0, 127.0).time).toBe(2158);
  });
});

describe('walkGroups', () => {
  const coord = (p: { lat: number; lng: number } | null) => p;

  it('걸어갈 만한 것끼리 한 묶음이 된다', () => {
    const groups = walkGroups([성수, 성수옆], coord, 20);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toEqual([성수, 성수옆]);
  });

  it('걸어갈 수 없는 거리면 묶이지 않는다', () => {
    // 성수↔홍대는 도보 228분이다. 20분 한도에서 둘 다 혼자 남으므로 묶음이 하나도 없다.
    expect(walkGroups([성수, 홍대], coord, 20)).toEqual([]);
  });

  it('좌표가 없는 것은 어느 묶음에도 안 들어간다 — 지어내지 않는다', () => {
    const groups = walkGroups([성수, null, 성수옆], coord, 20);
    expect(groups.flatMap((g) => g.members)).toEqual([성수, 성수옆]);
  });

  it('혼자인 것은 묶음이 되지 않는다 — "걸어서 묶기" 는 둘 이상일 때만 뜻이 있다', () => {
    expect(walkGroups([성수], coord, 20)).toEqual([]);
  });

  it('한도를 넘기면 갈라진다 — 경계가 실제로 작동한다', () => {
    // 성수↔성수옆은 약 11분이다. 한도를 10분으로 낮추면 갈라져 묶음이 사라진다.
    expect(walkGroups([성수, 성수옆], coord, 20)).toHaveLength(1);
    expect(walkGroups([성수, 성수옆], coord, 10)).toEqual([]);
  });

  it('묶어도 항목이 사라지거나 겹치지 않는다', () => {
    const members = walkGroups([성수, 성수옆, 홍대, 홍대옆], coord, 20).flatMap((g) => g.members);
    expect(members).toHaveLength(4);
    expect(new Set(members).size).toBe(4);
  });
});
