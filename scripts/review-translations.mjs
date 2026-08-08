/**
 * 번역 백필 결과를 사람이 빠르게 훑기 위한 도구.
 *
 * 왜 필요한가 — 2026-08-06 에 운영 데이터를 눈으로 훑었더니 일본어 이름 170건 중 상당수가
 * 틀려 있었다. 명탐정 코난이 문장이 되고, 남대문이 南山(남산)이 되고, 없는 층수("1F")가
 * 지어졌다. 그런데 화면만 봐서는 알 수 없다 — 틀린 일본어도 일본어처럼 보이기 때문이다.
 *
 * 그래서 (1) 백필 전후를 비교해 새로 채워진 것만 뽑고, (2) 기계가 잡을 수 있는 의심 신호를
 * 붙여 준다. 최종 판단은 사람이 한다 — 이 도구는 볼 순서를 정해 줄 뿐이다.
 *
 * 사용법:
 *   node scripts/review-translations.mjs snapshot          # 백필 전에 한 번
 *   ... 관리자 화면에서 번역 백필 실행 ...
 *   node scripts/review-translations.mjs diff              # 새로 채워진 것만 검수
 *   node scripts/review-translations.mjs audit             # 지금 값 전체를 훑는다
 */

import fs from 'node:fs';
import path from 'node:path';

const API = process.env.POPSPOT_API ?? 'https://popspot.co.kr';
const SNAPSHOT = path.join(process.cwd(), 'scripts', '.translations-snapshot.json');

const KANA_OR_KANJI = /[ぁ-んァ-ヶ一-龯]/;
const KANA = /[ぁ-んァ-ヶ]/;
const HANGUL = /[가-힣]/;
const filled = (v) => typeof v === 'string' && v.trim().length > 0;

async function fetchMarkers() {
  const res = await fetch(`${API}/api/map/markers`);
  if (!res.ok) throw new Error(`마커를 가져오지 못했습니다: HTTP ${res.status}`);
  return res.json();
}

/**
 * 기계가 잡을 수 있는 의심 신호만 붙인다.
 *
 * <p>"번역이 어색하다" 는 여기서 판정하지 않는다 — 그건 사람이 봐야 하고, 어설프게 점수를
 * 매기면 통과한 것을 안 보게 된다. 대신 <b>확실히 이상한 것</b>만 표시해 볼 순서를 정한다.
 */
function suspicions(row) {
  const flags = [];
  const ja = row.nameJa?.trim() ?? '';
  const ko = row.name?.trim() ?? '';

  if (HANGUL.test(ja)) flags.push('한글이 남음');

  // 한자만 있고 가나가 없으면 중국어일 수 있다. 실제로 "南山拌菜熱米糕" 가 나온 적이 있다.
  if (/[一-龯]/.test(ja) && !KANA.test(ja) && ja.length >= 4) flags.push('중국어 의심(가나 없음)');

  // 일본 문자가 하나도 없는데 원문에는 한글이 있었다면 음역조차 안 된 것이다.
  // (SUPREME 처럼 원문이 영문 브랜드면 정상이라 원문에 한글이 있을 때만 본다)
  if (!KANA_OR_KANJI.test(ja) && HANGUL.test(ko)) flags.push('일본 문자 없음');

  // 원문에 없던 숫자가 생겼다 — "1F" 처럼 없는 층수를 지어낸 사례가 있다.
  const koDigits = new Set(ko.match(/\d+/g) ?? []);
  for (const d of ja.match(/\d+/g) ?? []) {
    if (!koDigits.has(d)) {
      flags.push(`원문에 없는 숫자 '${d}'`);
      break;
    }
  }

  if (ja === ko) flags.push('원문과 동일');
  return flags;
}

function show(rows, title) {
  const flagged = rows.filter((r) => suspicions(r).length > 0);
  const clean = rows.filter((r) => suspicions(r).length === 0);

  console.log(`\n${title}`);
  console.log(`  전체 ${rows.length}건 · 의심 ${flagged.length}건 · 나머지 ${clean.length}건\n`);

  if (flagged.length) {
    console.log('── 먼저 볼 것 ─────────────────────────────');
    for (const r of flagged) {
      console.log(`  #${r.id} ${r.name}`);
      console.log(`      → ${r.nameJa}   [${suspicions(r).join(' · ')}]`);
    }
  }

  console.log('\n── 나머지(그래도 눈으로 확인) ─────────────');
  for (const r of clean) console.log(`  #${r.id} ${r.name}\n      → ${r.nameJa}`);

  console.log(`\n틀린 것이 있으면 그 id 를 모아 두세요. 다시 번역시키려면 그 행의`);
  console.log(`name_ja / name_en 을 비우고 translated_at 을 NULL 로 되돌려야 합니다 —`);
  console.log(`대량 백필은 "비어 있는 행" 만 다시 집습니다.`);
}

const mode = process.argv[2] ?? 'audit';
const rows = await fetchMarkers();

if (mode === 'snapshot') {
  const seen = Object.fromEntries(
    rows.filter((r) => filled(r.nameJa)).map((r) => [r.id, r.nameJa]),
  );
  fs.writeFileSync(SNAPSHOT, JSON.stringify(seen), 'utf8');
  console.log(`백필 전 상태를 저장했습니다 — 일본어 이름이 있는 ${Object.keys(seen).length}건.`);
  console.log(`이제 번역 백필을 돌린 뒤 'diff' 로 새로 채워진 것만 보세요.`);
} else if (mode === 'diff') {
  if (!fs.existsSync(SNAPSHOT)) {
    console.error(`먼저 'snapshot' 을 실행하세요 — 비교할 이전 상태가 없습니다.`);
    process.exit(1);
  }
  const before = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  const changed = rows.filter((r) => filled(r.nameJa) && before[r.id] !== r.nameJa);
  show(changed, `이번 백필로 새로 채워지거나 바뀐 이름`);
} else {
  show(
    rows.filter((r) => filled(r.nameJa)),
    `지금 일본어 이름이 있는 전체`,
  );
}
