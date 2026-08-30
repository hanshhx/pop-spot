/**
 * 같은 행사가 여러 줄로 쪼개진 것을 한 줄로 묶는다.
 *
 * <p>자동 수집이라 한 행사가 출처마다 조금씩 다른 이름·주소로 들어온다. 실측(라이브 965건)에서
 * 이런 그룹이 70개, 접을 수 있는 줄이 <b>98개</b>였다. 최악은 주술회전으로, 5줄이 전부 홍대
 * 사멸회유 같은 행사였다.
 *
 * <pre>
 *   주술회전사멸회유 팝업        (서울 FANBASE 홍대)
 *   주술회전 사멸회유            (서울 홍대)
 *   주술회전 (사멸회유)          (서울 마포구 양화로 178)
 *   주술회전(사멸회유) 팝업스토어 (서울 홍대입구역 4번출구)
 *   주술회전 사멸회유 팝업스토어  (서울특별시 마포구 양화로)
 * </pre>
 *
 * <p>이게 왜 문제인가 — 유입 1등인 흑백요리사가 상세 전환은 하위권(38.6%)인데, 그 목록 8줄 중
 * 7줄이 같은 롯데백화점 잠실 행사다. <b>뭘 눌러도 같은 곳</b>이라는 인상만 남는다.
 *
 * <p><b>화면에서만 묶는다. DB 는 건드리지 않는다.</b> 이미 검색에 색인된 상세 URL 이 있어서,
 * 지우거나 합치면 그 주소로 들어온 사람이 404 를 만난다. 백엔드의 {@code PopupDedupService} 는
 * 이름 완전일치만 보므로 이 부류를 못 잡는다 — 여기서 표시만 정리한다.
 */

/** 묶을 수 있는 최소 정보. 목록·카드가 쓰는 값만 받는다. */
export type GroupableEvent = {
  id: number;
  name: string;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

/**
 * 이름에서 <b>표기 차이</b>만 걷어낸다.
 *
 * <p>"팝업"·"스토어" 같은 접미와 공백·괄호·중점은 출처마다 다르게 붙는다. 반대로 숫자와 한글은
 * 남긴다 — "2026 K리그" 와 "K리그" 는 다른 해의 행사일 수 있어서 합치면 안 된다.
 */
function normalizeName(name: string): string {
  return name
    .replace(/[\s 　]/g, '')
    .replace(/[·・,.\-–—_'"“”‘’()[\]<>#&×✕]/g, '')
    .replace(/(팝업스토어|팝업|스토어|전시회|전시|기획전|특별전|행사|이벤트)/g, '')
    .toLowerCase();
}

/** 기간이 하루라도 겹치는가. 날짜가 없으면 열려 있는 것으로 본다(합치는 쪽으로 기울지 않게 넓게). */
function overlaps(a: GroupableEvent, b: GroupableEvent): boolean {
  const from = (x: GroupableEvent) =>
    x.startDate ? Date.parse(x.startDate) : Number.NEGATIVE_INFINITY;
  const to = (x: GroupableEvent) => (x.endDate ? Date.parse(x.endDate) : Number.POSITIVE_INFINITY);
  const [as, ae, bs, be] = [from(a), to(a), from(b), to(b)];
  if (Number.isNaN(as) || Number.isNaN(ae) || Number.isNaN(bs) || Number.isNaN(be)) return false;
  return as <= be && bs <= ae;
}

/** 묶인 결과 — 대표 하나와, 같은 행사로 판단한 나머지. */
export type EventGroup<T extends GroupableEvent> = {
  /** 화면에 보일 대표. 가장 자세한 주소를 가진 것을 고른다. */
  lead: T;
  /** 대표를 뺀 나머지. 비어 있으면 원래 한 줄짜리다. */
  duplicates: T[];
};

/**
 * 같은 행사끼리 묶는다. <b>입력 순서를 유지</b>한다 — 호출부가 이미 마감임박순으로 정렬해 두었고,
 * 여기서 순서를 바꾸면 "마감 임박순" 이라는 화면의 약속이 깨진다.
 *
 * <p>묶는 조건은 셋을 <b>모두</b> 만족할 때다. 하나라도 빼면 다른 행사가 합쳐진다.
 *
 * <ol>
 *   <li>표기를 걷어낸 이름이 같다
 *   <li>기간이 겹친다 — 같은 브랜드의 다음 시즌 팝업을 지난 것과 합치지 않기 위해
 *   <li>지역이 어긋나지 않는다 — 같은 이름으로 강남·성수에서 동시에 열면 서로 다른 방문지다
 * </ol>
 */
export function groupSameEvent<T extends GroupableEvent>(items: T[]): EventGroup<T>[] {
  const groups: { key: string; members: T[] }[] = [];

  for (const item of items) {
    const key = normalizeName(item.name);
    // 이름이 통째로 표기 문자뿐이라 빈 값이 되면 묶지 않는다. 빈 키끼리 다 합쳐지면 재앙이다.
    const found = key
      ? groups.find(
          (g) =>
            g.key === key &&
            g.members.some((m) => overlaps(m, item) && !differentPlace(m.location, item.location)),
        )
      : undefined;

    if (found) found.members.push(item);
    else groups.push({ key, members: [item] });
  }

  return groups.map((g) => {
    // 대표는 주소가 가장 자세한 것. 같은 행사인데 "서울" 한 줄짜리와 "송파구 올림픽로 240" 이
    // 섞여 있으면, 사람에게 쓸모 있는 쪽은 후자다.
    const lead = g.members.reduce((best, m) =>
      (m.location ?? '').length > (best.location ?? '').length ? m : best,
    );
    return { lead, duplicates: g.members.filter((m) => m !== lead) };
  });
}

/** 서울 안에서 서로 다른 동네로 <b>확정할 수 있을 때만</b> true. 모르면 false — 모른다고 갈라놓지 않는다. */
function differentPlace(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = placeKey(a);
  const y = placeKey(b);
  return x !== null && y !== null && x !== y;
}

/**
 * 상권 이름 → 그 상권이 속한 구.
 *
 * <p>같은 행사가 한 출처에서는 "마포구 양화로 178", 다른 출처에서는 "홍대" 로 들어온다. 둘 다
 * 같은 곳인데 글자만 보면 달라 보여서, 정규화하지 않으면 <b>같은 행사가 갈라진다</b>(실제로
 * 주술회전 5줄이 홍대 3 · 마포 2 로 쪼개졌다).
 *
 * <p>백화점·몰 이름은 <b>일부러 뺐다.</b> "신세계"·"현대백화점"·"스타필드" 는 여러 구에 있어서
 * 한 구로 못 정한다. 지점까지 붙은 이름(잠실 롯데월드몰)만 남긴다.
 */
const AREA_TO_GU: Record<string, string> = {
  성수: '성동',
  서울숲: '성동',
  홍대: '마포',
  홍대입구: '마포',
  합정: '마포',
  연남: '마포',
  망원: '마포',
  상수: '마포',
  이태원: '용산',
  한남: '용산',
  아이파크몰: '용산',
  강남: '강남',
  신사: '강남',
  압구정: '강남',
  청담: '강남',
  코엑스: '강남',
  가로수길: '강남',
  잠실: '송파',
  롯데월드몰: '송파',
  여의도: '영등포',
  더현대: '영등포',
  타임스퀘어: '영등포',
  명동: '중',
  을지로: '중',
  대학로: '종로',
  익선동: '종로',
  건대: '광진',
  신촌: '서대문',
  목동: '양천',
};

const GU = new RegExp(
  '(종로|중|용산|성동|광진|동대문|중랑|성북|강북|도봉|노원|은평|서대문|마포|양천|강서|구로|금천|영등포|동작|관악|서초|강남|송파|강동)구',
);
const AREA = new RegExp(`(${Object.keys(AREA_TO_GU).join('|')})`);

/** 주소에서 동네 하나를 뽑아 <b>구 단위로</b> 맞춘다. 못 정하면 null — 모르면 갈라놓지 않는다. */
function placeKey(location: string | null | undefined): string | null {
  if (!location) return null;
  const gu = location.match(GU);
  if (gu) return gu[1];
  const area = location.match(AREA);
  return area ? AREA_TO_GU[area[1]] : null;
}
