/**
 * 검색엔진에 <b>색인 요청할 URL 을 순서까지</b> 뽑는다.
 *
 * 왜 필요한가 — 서치콘솔·서치어드바이저의 수동 색인 요청은 하루 10건 남짓이다. 색인 자격이 있는
 * 상세가 400건 가까이 되므로 전부 넣을 수 없고, 값이 큰 것부터 넣어야 한다.
 *
 * 세 가지를 거른다.
 *
 *   자격 없는 것   프론트 src/lib/indexableDetail.ts 와 같은 규칙으로 판정한다.
 *   곧 끝나는 것   색인이 붙기 전에 팝업이 끝나면 요청 한도만 쓴다.
 *   같은 행사      한 행사가 열한 가지 이름으로 들어와 있던 적이 있다. 다 넣으면 한도를 낭비할 뿐
 *                  아니라 검색엔진이 같은 내용의 페이지 여러 개로 본다.
 *
 * 남은 것을 <b>검색 수요</b> 순으로 세운다. 수요는 지어내지 않고 서치콘솔이 준 실제 노출 수를 쓴다.
 * CSV 가 없으면 남은 기간 순으로만 정렬한다.
 *
 * 사용법:
 *   node scripts/index-request-list.mjs                      # 남은 기간 순
 *   node scripts/index-request-list.mjs <검색어CSV경로>      # 검색 수요 순(권장)
 *
 * 검색어 CSV 는 서치콘솔 → 실적 → 내보내기 안에 있는 "인기 검색어" 파일이다.
 */
import fs from 'node:fs';

const API = process.env.POPSPOT_API ?? 'https://popspot.co.kr';
const OUT = 'docs/search-index-request-list.txt';

/** 색인이 붙기까지 걸리는 최소 시간. 이보다 빨리 끝나는 팝업은 넣어 봐야 소용이 없다. */
const MIN_DAYS_LEFT = 7;

/* ---------- 색인 자격 (src/lib/indexableDetail.ts 와 같은 규칙) ---------- */

const HAS_NUMBER = /\d/;
const HAS_GU =
  /(종로|중|용산|성동|광진|동대문|중랑|성북|강북|도봉|노원|은평|서대문|마포|양천|강서|구로|금천|영등포|동작|관악|서초|강남|송파|강동)구/;
const HAS_VENUE =
  /(더현대|현대백화점|롯데백화점|롯데월드몰|신세계|갤러리아|AK플라자|타임스퀘어|코엑스|스타필드|아이파크몰|무신사|성수동|홍대|연남|한남|이태원|압구정|청담|가로수길|명동|을지로|여의도|잠실|건대|신촌|목동)/;

function usefulLocation(loc) {
  const text = (loc ?? '').trim();
  if (!text) return false;
  if (HAS_VENUE.test(text)) return true;
  const rest = text.replace(/^서울\s*(특별시)?\s*/, '').trim();
  if (rest.length < 3) return false;
  return HAS_NUMBER.test(rest) || HAS_GU.test(text);
}

const indexable = (m, today) =>
  Boolean(m.name?.trim()) && Boolean(m.endDate) && m.endDate >= today && usefulLocation(m.location);

/* ---------- 같은 행사 묶기 ---------- */

/** 장소·업태처럼 어느 팝업에나 붙는 말. 남겨 두면 "성수" 하나로 무관한 팝업들이 한 덩어리가 된다. */
const GENERIC =
  /^(팝업|스토어|팝업스토어|카페|전시|전시회|콜라보|콜라보레이션|컬래버|기념|공식|한정|오픈|이벤트|굿즈|스페셜|시즌|글로벌|성수|성수동|홍대|잠실|한남|명동|여의도|신촌|목동|건대|연남|청담|압구정|이태원|강남|서울|더현대|현대백화점|롯데백화점|신세계|코엑스|스타필드|무신사|아이파크몰|더|앤|and|the|pop|up|store|in|x)$/i;

const tokens = (name) => [
  ...new Set(
    (name ?? '')
      .replace(/[^가-힣A-Za-z0-9]+/g, ' ')
      .split(/\s+/)
      .map((w) => w.toLowerCase())
      .filter((w) => w.length >= 2 && !GENERIC.test(w)),
  ),
];

/**
 * 낱말이 하나라도 겹치면 같은 덩어리로 본다.
 *
 * <p>한 행사가 "피마원 X 토이스토리" · "THE FIRST FAN 토이스토리" 처럼 약칭만 다르게 들어와 있어,
 * 이름을 통째로 비교해서는 묶이지 않는다. 토이스토리 같은 공통 낱말을 통해 이어 붙인다.
 *
 * <p>여기서는 <b>요청 순서만</b> 정한다. DB 를 손대는 중복 정리는 별개 작업이고 더 엄격한 규칙을
 * 쓴다(장소·기간까지 같아야 한다).
 */
function groupBySharedWord(items) {
  const parent = items.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));

  const seen = new Map();
  items.forEach((item, i) => {
    for (const word of tokens(item.name)) {
      if (seen.has(word)) {
        const [a, b] = [find(seen.get(word)), find(i)];
        if (a !== b) parent[b] = a;
      } else seen.set(word, i);
    }
  });

  const groups = new Map();
  items.forEach((item, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(item);
  });
  return [...groups.values()];
}

/* ---------- 검색 수요 ---------- */

/** 서치콘솔 CSV 한 줄. 값 안에 쉼표가 있을 수 있어 따옴표를 다룬다. */
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function loadQueries(path) {
  if (!path || !fs.existsSync(path)) return [];
  return fs
    .readFileSync(path, 'utf8')
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map(parseCsvLine)
    .map(([query, , impressions]) => ({ query: query.trim(), impressions: Number(impressions) || 0 }))
    .filter((row) => row.query);
}

/**
 * 이 이름이 실제 검색어와 얼마나 겹치는가.
 *
 * <p>검색어의 낱말이 이름 안에 모두 있으면 그 검색어의 노출 수를 더한다. "짱구 팝업" 이
 * "짱구는못말려 올리브영 팝업" 에 걸리도록 부분 일치로 본다.
 */
function demandOf(name, queries) {
  const target = (name ?? '').replace(/\s+/g, '');
  if (!target) return 0;
  let total = 0;
  for (const { query, impressions } of queries) {
    const words = query.split(/\s+/).filter((w) => w.length >= 2);
    if (words.length && words.every((w) => target.includes(w))) total += impressions;
  }
  return total;
}

/* ---------- 실행 ---------- */

const queries = loadQueries(process.argv[2]);
const today = new Date().toISOString().slice(0, 10);
const days = (from, to) => Math.round((new Date(to) - new Date(from)) / 86400000);

const res = await fetch(`${API}/api/map/markers`);
if (!res.ok) throw new Error(`마커를 가져오지 못했습니다: HTTP ${res.status}`);
const rows = await res.json();

const eligible = rows
  .filter((m) => indexable(m, today))
  .map((m) => ({
    id: m.id,
    name: m.name,
    left: days(today, m.endDate),
    demand: demandOf(m.name, queries),
  }));

const tooSoon = eligible.filter((r) => r.left < MIN_DAYS_LEFT);
const survivors = eligible.filter((r) => r.left >= MIN_DAYS_LEFT);
const list = groupBySharedWord(survivors)
  .map((group) => group.sort((a, b) => b.demand - a.demand || b.left - a.left).at(0))
  .sort((a, b) => b.demand - a.demand || b.left - a.left);

const lines = [
  `색인 요청 목록 — ${today} 기준`,
  '',
  `  색인 자격 전체            ${eligible.length}건 (사이트맵에 올라간 것)`,
  `  ${MIN_DAYS_LEFT}일 안에 끝나서 제외       ${tooSoon.length}건`,
  `  같은 행사라 묶어서 제외    ${survivors.length - list.length}건`,
  `  → 요청할 것              ${list.length}건`,
  '',
  queries.length
    ? '순서는 "검색 수요 → 남은 기간" 이다. 수요는 서치콘솔 실제 노출 수다.'
    : '검색어 CSV 를 주지 않아 남은 기간 순으로만 세웠다.',
  '수동 색인 요청은 하루 10건 남짓이니 하루 한 묶음씩. 구글·네이버 양쪽에 같이 넣으면 된다.',
  '',
];
for (const [i, r] of list.entries()) {
  if (i % 10 === 0) lines.push(`\n--- ${i / 10 + 1}일차 ---`);
  const demand = r.demand > 0 ? `수요 ${String(r.demand).padStart(4)}` : '수요    -';
  lines.push(`${API}/popup/${r.id}    [${demand} · ${r.left}일] ${r.name}`);
}

fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log(
  `${OUT} — 요청 ${list.length}건 (자격 ${eligible.length} − 곧끝남 ${tooSoon.length} − 중복 ${survivors.length - list.length})`,
);
