/**
 * <b>잃어버린 방문 비콘을 센다.</b>
 *
 * <p><b>왜 필요한가.</b> {@code trackVisitEvent} 는 실패를 통째로 삼켜 왔다. 게다가
 * {@code fetch} 는 500 응답에도 성공으로 resolve 하므로, 백엔드가 죽어 있어도 화면은 "보냈다" 고
 * 여겼다. 2026-08-13~19 서버 과부하 구간에 방문 기록이 통째로 비어 있는데 <b>그 사실이 아무 데도
 * 드러나지 않았다</b> — 나중에 그 구간을 보고 "유입이 줄었네" 하고 엉뚱한 곳을 의심하게 된다.
 *
 * <p><b>왜 브라우저에 쌓아 두는가.</b> 실패한 보고를 다시 서버로 보내는 것은 순환이다 — 서버가
 * 죽어서 실패한 것이라면 그 보고도 실패한다. 그래서 세어 두었다가 <b>다음에 성공하는 요청에
 * 얹어</b> 보낸다. 서버가 살아나는 순간 그동안 잃은 수가 따라 들어온다.
 *
 * <p>전부 실패해서 영영 못 보내는 구간은 이 장치로 못 잡는다. 그쪽은 'Vercel 대비 DB 누락률' 이
 * 따로 잡는다 — 두 겹으로 막는다.
 */

/** 브라우저에 세어 두는 자리. */
export const DROPPED_KEY = 'popspot:visit:dropped';

/**
 * 이보다 많이는 세지 않는다.
 *
 * <p>정확한 수보다 <b>"많이 잃었다"</b> 는 사실이 중요하고, 상한이 없으면 오래 열어 둔 탭에서
 * 값이 끝없이 자란다.
 */
export const MAX_DROPPED = 9999;

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** 지금까지 잃은 수. 읽을 수 없거나 값이 이상하면 <b>0</b> — 없는 손실을 지어내지 않는다. */
export function readDropped(storage: ReadableStorage | null | undefined): number {
  try {
    const raw = storage?.getItem(DROPPED_KEY);
    /*
     * 우리가 쓴 값은 <b>숫자만</b> 들어 있다. 그 밖의 것은 다른 무언가가 이 열쇠를 건드렸다는
     * 뜻이므로 손실 0 으로 본다 — parseInt 는 "1e9999" 를 1 로 읽어 주는데, 그렇게 주워
     * 담으면 없는 손실을 지어내게 된다.
     */
    if (typeof raw !== 'string' || !/^[0-9]+$/.test(raw)) return 0;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.min(parsed, MAX_DROPPED);
  } catch {
    /* 사생활 보호 모드 등에서 접근 자체가 막힌다. */
    return 0;
  }
}

/** 한 건 잃었다고 표시한다. */
export function bumpDropped(storage: WritableStorage | null | undefined): void {
  try {
    const next = Math.min(readDropped(storage) + 1, MAX_DROPPED);
    storage?.setItem(DROPPED_KEY, String(next));
  } catch {
    /* 못 써도 화면이 깨지면 안 된다 — 통계보다 화면이 먼저다. */
  }
}

/**
 * 서버가 받아 준 만큼 뺀다.
 *
 * <p><b>0 으로 지우지 않는 이유.</b> 보고를 보낸 뒤 응답이 오기까지 사이에 다른 비콘이 또 실패할
 * 수 있다. 통째로 지우면 그 사이에 생긴 손실이 소리 없이 사라진다 — 손실을 세는 장치가 손실을
 * 잃으면 안 된다.
 */
export function settleDropped(storage: WritableStorage | null | undefined, reported: number): void {
  try {
    const left = Math.max(0, readDropped(storage) - Math.max(0, reported));
    if (left === 0) storage?.removeItem(DROPPED_KEY);
    else storage?.setItem(DROPPED_KEY, String(left));
  } catch {
    /* 위와 같다. */
  }
}

/**
 * 이 실패를 <b>손실로 세야 하는가.</b>
 *
 * <p><b>왜 안 세는 경우가 있나.</b> {@code keepalive} 요청은 문서가 사라져도 브라우저가 전송을
 * 끝낸다. 그런데 그 사이 문서가 없어지면 이쪽 promise 는 abort 로 거절된다 — <b>서버는 받았는데
 * 화면은 잃었다고 세게 된다.</b> 카드를 눌러 상세로 넘어가는 순간이 정확히 이 상황이라, 그대로
 * 두면 정상 이동마다 유실이 하나씩 쌓인다.
 *
 * <p>2026-09-02 배포 직후 운영에서 바로 나왔다 — 응답은 204 인데 네트워크 기록은
 * {@code net::ERR_ABORTED} 였다. 없는 손실을 지어내면 멀쩡한 구간을 장애로 의심하게 되므로,
 * 판단이 안 서면 <b>안 세는 쪽</b>으로 기운다.
 *
 * <p>서버가 500 을 돌려준 것은 다르다. 그건 페이지가 떠나든 말든 진짜 실패이므로 센다.
 */
export function countsAsDrop(error: unknown, unloading: boolean): boolean {
  if (unloading) return false;
  const name = (error as { name?: unknown } | null | undefined)?.name;
  return name !== 'AbortError';
}
