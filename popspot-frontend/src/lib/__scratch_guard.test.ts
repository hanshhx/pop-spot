import { describe, it } from 'vitest';

/* --- 후보 구현 --- */
const SEOUL_BBOX = { minLat: 37.41, maxLat: 37.72, minLng: 126.75, maxLng: 127.2 };

type Verdict = 'inside' | 'outside' | 'unknown';

function seoulVerdict(lat: string | null | undefined, lng: string | null | undefined): Verdict {
  const la = Number(lat);
  const ln = Number(lng);
  if (!lat || !lng || !Number.isFinite(la) || !Number.isFinite(ln) || (la === 0 && ln === 0)) {
    return 'unknown';
  }
  const inside =
    la >= SEOUL_BBOX.minLat &&
    la <= SEOUL_BBOX.maxLat &&
    ln >= SEOUL_BBOX.minLng &&
    ln <= SEOUL_BBOX.maxLng;
  return inside ? 'inside' : 'outside';
}

/* 텍스트 규칙 후보 — 행정 접미사가 붙은 것만 본다. */
const OTHER_SIDO =
  /(부산|대구|인천|광주|대전|울산)광역시|세종특별자치시|(경기|강원|충청북|충청남|전라북|전라남|경상북|경상남|제주)(도|특별자치도)|(경기|강원|충북|충남|전북|전남|경북|경남)도/;
const OTHER_CITY = /(?:^|[\s,])([가-힣]{2,4})(시|군)(?:$|[\s,])/g;
const SEOUL_SI = new Set(['서울특별', '서울']);

function textSaysOutside(location: string | null | undefined): boolean {
  if (!location) return false;
  if (OTHER_SIDO.test(location)) return true;
  OTHER_CITY.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = OTHER_CITY.exec(location))) {
    if (!SEOUL_SI.has(m[1])) return true;
  }
  return false;
}

/* --- 실측 데이터 --- */
const OUTSIDE = [
  '서울 대전신세계',
  '서울 수원시',
  '서울 판교현대백화점',
  '서울 서면',
  '서울 순천시',
  '서울 제주국제공항',
  '서울 부산역 광장',
  '서울 하남시',
  '서울 경기도 성남시 판교역로146번길 20 현대백화점 판교점 B층',
];

const REAL_SEOUL = [
  '서울 성북구 성북로 108 창원빌딩 3층',
  '서울특별시 마포구 양화로 178',
  '서울 성동구 연무장길 41',
  '서울 강남구 아이파크몰 3층',
  '서울 영등포구 타임스퀘어',
  '서울 중구 을지로 100',
  '서울 송파구 올림픽로 240',
  '서울 용산구 한남동 683-142',
  '서울 마포구 연남동 227-15',
  '서울 서초구 반포대로 58',
  '서울 광진구 능동로 209 건국대학교',
  '서울 은평구 진관동 스타필드',
  '서울 강서구 코엑스 마곡',
  '서울 종로구 대학로 12길',
  '서울 강동구 더현대',
  '서울 동대문구 왕산로 214',
  '서울 서대문구 신촌로 83',
  '서울',
];

const out: string[] = [];
describe('scratch guard', () => {
  it('dump', async () => {
    out.push('=== 좌표 규칙 ===');
    out.push(`부산역(35.1151,129.0415) -> ${seoulVerdict('35.1151', '129.0415')}`);
    out.push(`판교(37.3947,127.1112)   -> ${seoulVerdict('37.3947', '127.1112')}`);
    out.push(`성수(37.5445,127.056)    -> ${seoulVerdict('37.5445', '127.056')}`);
    out.push(`제주공항(33.5104,126.49) -> ${seoulVerdict('33.5104', '126.4914')}`);
    out.push(`하남미사(37.5636,127.19) -> ${seoulVerdict('37.5636', '127.1930')}`);
    out.push(`좌표없음                 -> ${seoulVerdict(null, null)}`);
    out.push(`빈문자                   -> ${seoulVerdict('', '')}`);

    out.push('\n=== 텍스트 규칙: 서울밖 실측 (true 여야 잡힘) ===');
    for (const s of OUTSIDE) out.push(`${String(textSaysOutside(s)).padEnd(6)} <- ${s}`);

    out.push('\n=== 텍스트 규칙: 진짜 서울 (전부 false 여야 함) ===');
    for (const s of REAL_SEOUL) out.push(`${String(textSaysOutside(s)).padEnd(6)} <- ${s}`);

    const fs = await import('node:fs');
    fs.writeFileSync('scratch-guard-dump.txt', out.join('\n'), 'utf8');
  });
});
