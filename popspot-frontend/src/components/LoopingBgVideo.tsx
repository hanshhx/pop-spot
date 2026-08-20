'use client';

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';

import { isPlaybackStalled } from '@/lib/videoWatchdog';

const CROSSFADE_MS = 1200;

/**
 * 배경이 멈추지 않았는지 확인하는 간격.
 *
 * <p>2초면 사용자가 "멈췄네" 하고 알아채기 전에 되살릴 수 있고, 재생 중 판정에 필요한 시간
 * 변화(수백 ms)도 충분히 확보된다. 판정 규칙은 {@code lib/videoWatchdog} 참고.
 */
const WATCHDOG_MS = 2_000;

/**
 * 끊김 없는 배경 영상 루프.
 *
 * <p>네이티브 {@code loop} 는 끝 프레임 → 시작 프레임이 튀어 "뚝" 끊겨 보인다(영상이 seamless 하지 않을 때).
 * 두 개의 {@code <video>} 를 핑퐁 크로스페이드해 영상 내용과 무관하게 매끄럽게 잇는다: 활성 영상이 끝나기
 * 약 {@code CROSSFADE_MS} 전, 반대편을 0 초부터 재생하며 opacity 를 교차한다.
 *
 * <p>opacity 는 CSS transition 이 아니라 requestAnimationFrame 으로 매 프레임 직접 쓴다. (GPU 레이어 +
 * opacity transition 조합이 일부 환경에서 진행되지 않는 문제가 있어, rAF 로 결정적으로 애니메이션한다.)
 */
/**
 * 이 배경을 <b>그릴 만한 환경인가.</b>
 *
 * <p>이 컴포넌트는 {@code <video>} 를 두 개 만들고 둘 다 {@code preload="auto"} 다(크로스페이드
 * 하려면 다음 편이 미리 준비돼 있어야 한다). 그런데 <b>미디어 쿼리가 없어서</b> 좁은 화면에서도
 * 그대로 받았다. 다크 배경은 2.8MB 다.
 *
 * <p>홈은 이 사이트에서 가장 많이 열리는 화면이고(주 255회) 방문자의 <b>75.7% 가 모바일</b>이다.
 * 스크림 두 겹 뒤에 깔리는 장식이라 작은 화면에서는 거의 보이지도 않는데, 첫 방문의 전송량 대부분을
 * 이게 차지한다. 안 그리면 부모의 브랜드 단색(cream/ink)이 그대로 보인다 — 빈 화면이 아니다.
 *
 * <p>움직임을 줄이도록 설정한 사람에게도 그리지 않는다.
 */
function useShouldRender(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 768px)');
    const calm = window.matchMedia('(prefers-reduced-motion: no-preference)');
    const update = () => setOk(wide.matches && calm.matches);
    update();
    wide.addEventListener('change', update);
    calm.addEventListener('change', update);
    return () => {
      wide.removeEventListener('change', update);
      calm.removeEventListener('change', update);
    };
  }, []);
  return ok;
}

export default function LoopingBgVideo({
  src,
  rate = 1,
  className = '',
}: {
  src: string;
  rate?: number;
  className?: string;
}) {
  const shouldRender = useShouldRender();
  const aRef = useRef<HTMLVideoElement>(null);
  const bRef = useRef<HTMLVideoElement>(null);
  const activeIsA = useRef(true);
  const swapping = useRef(false);
  const rafRef = useRef(0);

  const applyRate = useCallback(
    (v: HTMLVideoElement | null) => {
      if (v) {
        try {
          v.playbackRate = rate;
        } catch {
          /* metadata 전 설정 예외 무시 */
        }
      }
    },
    [rate],
  );

  // rAF 크로스페이드: incoming 0→1, outgoing 1→0 을 CROSSFADE_MS 동안.
  const crossfade = useCallback(
    (incoming: HTMLVideoElement | null, outgoing: HTMLVideoElement | null) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      let startTs = 0;
      const step = (ts: number) => {
        if (!startTs) startTs = ts;
        const p = Math.min(1, (ts - startTs) / CROSSFADE_MS);
        if (incoming) incoming.style.opacity = String(p);
        if (outgoing) outgoing.style.opacity = String(1 - p);
        rafRef.current = p < 1 ? requestAnimationFrame(step) : 0;
      };
      rafRef.current = requestAnimationFrame(step);
      // 폴백: 백그라운드 탭 등 rAF 가 멈춘 경우에도 최종 상태를 보장(setTimeout 은 백그라운드에서도 발화).
      window.setTimeout(() => {
        if (incoming) incoming.style.opacity = '1';
        if (outgoing) outgoing.style.opacity = '0';
      }, CROSSFADE_MS + 80);
    },
    [],
  );

  // 마운트 / 테마(src) 변경 시: A 를 처음부터 보이게, B 는 숨겨 대기.
  useEffect(() => {
    activeIsA.current = true;
    swapping.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const a = aRef.current;
    const b = bRef.current;
    if (a) {
      a.style.opacity = '1';
      try {
        a.currentTime = 0;
      } catch {
        /* noop */
      }
      applyRate(a);
      void a.play().catch(() => {});
    }
    if (b) {
      b.style.opacity = '0';
      b.pause();
      try {
        b.currentTime = 0;
      } catch {
        /* noop */
      }
      applyRate(b);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [src, applyRate]);

  /**
   * 배경이 멈춘 채로 남지 않게 지킨다.
   *
   * <p>이 컴포넌트에서 {@code play()} 거절은 전부 {@code .catch(() => {})} 로 삼켜진다 — 배경 장식이
   * 오류를 띄우면 안 되니 맞는 처리지만, 그 결과 <b>시작하지 못한 영상이 조용히 드러난다.</b>
   * 되살릴 곳이 여기 한 군데뿐인 이유다.
   */
  useEffect(() => {
    if (!shouldRender) return;

    let previousTime = -1;
    const activeVideo = () => (activeIsA.current ? aRef.current : bRef.current);

    const revive = () => {
      const video = activeVideo();
      if (!video) return;
      // 끝난 채로 서 있으면 되감아야 다시 돈다. 그냥 play() 하면 그 자리에 머문다.
      if (video.ended) {
        try {
          video.currentTime = 0;
        } catch {
          /* noop */
        }
      }
      void video.play().catch(() => {});
    };

    const tick = () => {
      // 배경 탭에서는 브라우저가 정당하게 멈춘다. 되살리려 들면 배터리만 쓴다.
      if (document.visibilityState !== 'visible') return;
      const video = activeVideo();
      if (!video) return;
      if (isPlaybackStalled(video.paused, video.ended, video.currentTime, previousTime)) revive();
      previousTime = video.currentTime;
    };

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      // 돌아온 직후의 위치는 떠나기 전 값이라 비교 대상이 못 된다.
      previousTime = -1;
      revive();
    };

    const timer = window.setInterval(tick, WATCHDOG_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [shouldRender, src]);

  /**
   * 교대가 걸리지 않은 채 영상이 끝났을 때의 대비.
   *
   * <p>교대는 {@code timeupdate} 로 남은 시간을 보고 거는데, 그 이벤트가 드물게 오면 판정 구간을
   * 건너뛰고 그대로 끝난다. 그때는 크로스페이드를 포기하고 즉시 되감아 잇는다 — 한 번 튀는 편이
   * 영원히 멈춰 있는 것보다 낫다.
   *
   * <p>교대가 정상적으로 걸린 뒤 물러난 편도 곧 {@code ended} 를 내지만, 그쪽은 이미 활성이
   * 아니므로 건드리지 않는다.
   */
  const handleEnded = useCallback(
    (isA: boolean) => (e: SyntheticEvent<HTMLVideoElement>) => {
      if (isA !== activeIsA.current) return;
      const video = e.currentTarget;
      try {
        video.currentTime = 0;
      } catch {
        /* noop */
      }
      void video.play().catch(() => {});
    },
    [],
  );

  const handleTimeUpdate = useCallback(
    (isA: boolean) => (e: SyntheticEvent<HTMLVideoElement>) => {
      if (swapping.current || isA !== activeIsA.current) return;
      const cur = e.currentTarget;
      const dur = cur.duration;
      if (!dur || !Number.isFinite(dur)) return;
      if ((dur - cur.currentTime) / (rate || 1) > CROSSFADE_MS / 1000 + 0.25) return;

      swapping.current = true;
      const incoming = (isA ? bRef : aRef).current;
      const outgoing = (isA ? aRef : bRef).current;
      if (incoming) {
        try {
          incoming.currentTime = 0;
        } catch {
          /* noop */
        }
        applyRate(incoming);
        void incoming.play().catch(() => {});
      }
      crossfade(incoming, outgoing);
      activeIsA.current = !isA;
      window.setTimeout(() => {
        swapping.current = false;
      }, CROSSFADE_MS + 300);
    },
    [rate, applyRate, crossfade],
  );

  const base = 'absolute inset-0 h-full w-full object-cover';

  // 훅을 전부 부른 뒤에 판단한다. 위에서 일찍 반환하면 훅 호출 순서가 렌더마다 달라진다.
  if (!shouldRender) return null;

  return (
    <>
      <video
        ref={aRef}
        autoPlay
        muted
        playsInline
        preload="auto"
        onLoadedMetadata={(e) => applyRate(e.currentTarget)}
        onTimeUpdate={handleTimeUpdate(true)}
        onEnded={handleEnded(true)}
        className={`${base} ${className}`}
      >
        <source src={src} type="video/mp4" />
      </video>
      <video
        ref={bRef}
        muted
        playsInline
        preload="auto"
        onLoadedMetadata={(e) => applyRate(e.currentTarget)}
        onTimeUpdate={handleTimeUpdate(false)}
        onEnded={handleEnded(false)}
        className={`${base} ${className}`}
      >
        <source src={src} type="video/mp4" />
      </video>
    </>
  );
}
