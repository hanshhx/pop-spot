import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  EMERGENCY_SNAPSHOT_META,
  activeEmergencyMarkers,
  allEmergencyMarkers,
  findEmergencyMarker,
  isEmergencyDuplicate,
  loadPublicMarkers,
} from './emergencyPopupData';

describe('비상 공개 팝업 스냅샷', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('원본 1,786건과 공개 필드 통계를 변형 없이 보존한다', () => {
    const rows = allEmergencyMarkers();
    expect(rows).toHaveLength(1786);
    expect(new Set(rows.map((row) => row.id)).size).toBe(1786);
    expect(rows.filter((row) => row.latitude && row.longitude)).toHaveLength(1545);
    expect(rows.filter((row) => row.endDate)).toHaveLength(988);
    expect(rows.filter((row) => row.nameJa)).toHaveLength(511);
    expect(EMERGENCY_SNAPSHOT_META.sha256).toBe(
      'b9eb8d48fb12e7585dcdbead56664d65e3235b891900850b34a5ff721209c882',
    );
    const rawSnapshot = readFileSync(
      path.join(process.cwd(), 'src/data/emergency/popups-2026-09-01.json'),
    );
    expect(createHash('sha256').update(rawSnapshot).digest('hex')).toBe(
      EMERGENCY_SNAPSHOT_META.sha256,
    );
  });

  it('중복은 목록에서만 숨기고 상세 ID는 계속 찾을 수 있다', () => {
    expect(isEmergencyDuplicate(525)).toBe(true);
    expect(
      activeEmergencyMarkers(new Date('2026-08-11T00:00:00+09:00')).some((row) => row.id === 525),
    ).toBe(false);
    expect(findEmergencyMarker(525)?.id).toBe(525);
  });

  it('정상 서버 데이터가 있으면 스냅샷보다 우선한다', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://backend.example.com');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json([{ id: 7, name: '최신 팝업' }])),
    );

    await expect(loadPublicMarkers()).resolves.toMatchObject({
      source: 'live',
      markers: [{ id: 7, name: '최신 팝업' }],
    });
  });

  it('네트워크 실패 때만 스냅샷을 사용한다', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://backend.example.com');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 502 })),
    );

    const result = await loadPublicMarkers();
    expect(result.source).toBe('snapshot');
    expect(result.markers.length).toBeGreaterThan(0);
    expect(result.capturedAt).toContain('2026-09-01');
  });
});
