/**
 * 무드 여섯 — 웹 {@code components/music/MusicTab.tsx} 의 {@code MOODS} 를 그대로 옮긴 것.
 *
 * <p>시안의 코스 탭은 무드를 다섯 개(몽환적인·설레는·차분한·신나는·혼자 조용히)로 그렸고, 음악
 * 탭은 여섯 개(감성·카페 / 트렌디·K팝 / …)로 그렸다. <b>두 벌을 다 만들지 않는다.</b> 앞의 다섯은
 * 시안에서만 존재하는 낱말이라 팝업 분야와 이어지지 않고, 뒤의 여섯은 웹 소스에 실재하며 각각
 * <b>어떤 분야를 보여줄지</b>({@code cats})가 정해져 있다. 이어지는 쪽을 쓴다.
 *
 * <p>덕분에 코스와 음악이 같은 무드를 공유한다 — 음악에서 "비 오는 날" 을 고르고 코스로 넘어가면
 * 같은 무드가 걸려 있다.
 */

export interface Mood {
  id: string;
  label: string;
  desc: string;
  /**
   * 음악 검색어. <b>번역하지 않는다</b> — 음악 API 로 그대로 나가는 값이라, 화면 언어가 바뀌었다고
   * 검색어까지 바뀌면 결과가 통째로 달라진다.
   */
  music: string;
  /** 이 무드로 보여줄 팝업 분야(백엔드 원본 코드). */
  cats: string[];
}

export const MOODS: Mood[] = [
  {
    id: 'chill',
    label: '감성·카페',
    desc: '잔잔하게 둘러보기',
    music: 'korean lofi cafe chill',
    cats: ['FOOD', 'CULTURE'],
  },
  {
    id: 'trend',
    label: '트렌디·K팝',
    desc: '지금 가장 힙한',
    music: 'k-pop hits 2025',
    cats: ['FASHION', 'BEAUTY'],
  },
  {
    id: 'cute',
    label: '아기자기',
    desc: '귀여운 캐릭터',
    music: 'korean cute bright pop',
    cats: ['CHARACTER'],
  },
  {
    id: 'art',
    label: '전시·아트',
    desc: '감각을 채우는',
    music: 'korean indie art',
    cats: ['CULTURE', 'TECH'],
  },
  {
    id: 'date',
    label: '데이트',
    desc: '둘이 설레는',
    music: 'korean rnb soul love',
    cats: ['FASHION', 'FOOD', 'BEAUTY'],
  },
  {
    id: 'rainy',
    label: '비 오는 날',
    desc: '차분하게 젖어드는',
    music: 'korean rainy day ballad',
    cats: ['CULTURE', 'FOOD'],
  },
];

export function moodById(id: string): Mood {
  return MOODS.find((m) => m.id === id) ?? MOODS[0];
}

/** 이 팝업이 그 무드에 드는가. 분야 코드는 백엔드 원문(대문자)이라 그대로 비교한다. */
export function matchesMood(category: string | null | undefined, mood: Mood): boolean {
  if (!category) return false;
  return mood.cats.includes(category.trim().toUpperCase());
}
