'use client';

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';

import { canRevealVideo, isPlaybackStalled, shouldUseStandbyRecovery } from '@/lib/videoWatchdog';
import { VIDEO_MIN_WIDTH } from '@/lib/seasonVideo';

const CROSSFADE_MS = 1200;

/**
 * 배경이 멈추지 않았는지 확인하는 간격.
 *
 * <p>2초면 사용자가 "멈췄네" 하고 알아채기 전에 되살릴 수 있고, 재생 중 판정에 필요한 시간
 * 변화(수백 ms)도 충분히 확보된다. 판정 규칙은 {@code lib/videoWatchdog} 참고.
 */
const WATCHDOG_MS = 2_000;
const FRAME_READY_TIMEOUT_MS = 3_500;

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
 *
 * <p>기준 폭은 {@link VIDEO_MIN_WIDTH} 하나만 본다. 예전에는 여기에 768 이 박혀 있었는데,
 * 같은 규칙을 설명하는 lib/seasonVideo 주석과 관리자 화면은 1024 라고 적고 있었다. 셋이 어긋나면
 * 운영자가 화면에서 읽은 폭과 실제로 파일이 내려가는 폭이 달라진다.
 */
function useShouldRender(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const wide = window.matchMedia(`(min-width: ${VIDEO_MIN_WIDTH}px)`);
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
  const fadeFallbackTimerRef = useRef(0);
  const swapFinishTimerRef = useRef(0);
  const operationRef = useRef(0);
  const consecutiveStallsRef = useRef(0);

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
      if (fadeFallbackTimerRef.current) window.clearTimeout(fadeFallbackTimerRef.current);
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
      fadeFallbackTimerRef.current = window.setTimeout(() => {
        if (incoming) incoming.style.opacity = '1';
        if (outgoing) outgoing.style.opacity = '0';
        fadeFallbackTimerRef.current = 0;
      }, CROSSFADE_MS + 80);
    },
    [],
  );

  /** 재생 요청 뒤 디코딩된 첫 프레임이 준비될 때까지 기다린다. */
  const waitForRenderableFrame = useCallback((video: HTMLVideoElement): Promise<boolean> => {
    return new Promise((resolve) => {
      let settled = false;
      let paintRaf = 0;

      const cleanup = () => {
        window.clearTimeout(timeout);
        if (paintRaf) cancelAnimationFrame(paintRaf);
        video.removeEventListener('playing', check);
        video.removeEventListener('loadeddata', check);
        video.removeEventListener('canplay', check);
        video.removeEventListener('timeupdate', check);
        video.removeEventListener('error', fail);
      };
      const finish = (ready: boolean) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(ready);
      };
      const afterPaint = () => {
        paintRaf = requestAnimationFrame(() => {
          paintRaf = 0;
          finish(canRevealVideo(video.readyState, Boolean(video.error)) && !video.paused);
        });
      };
      const check = () => {
        if (!canRevealVideo(video.readyState, Boolean(video.error)) || video.paused) return;
        if (paintRaf) return;
        // 첫 프레임이 준비됐다는 이벤트 직후 한 프레임을 더 기다린 뒤에만 기존 영상을 가린다.
        paintRaf = requestAnimationFrame(afterPaint);
      };
      const fail = () => finish(false);
      const timeout = window.setTimeout(
        () => finish(canRevealVideo(video.readyState, Boolean(video.error)) && !video.paused),
        FRAME_READY_TIMEOUT_MS,
      );

      video.addEventListener('playing', check);
      video.addEventListener('loadeddata', check);
      video.addEventListener('canplay', check);
      video.addEventListener('timeupdate', check);
      video.addEventListener('error', fail, { once: true });
      check();
    });
  }, []);

  const playUntilFrame = useCallback(
    async (video: HTMLVideoElement): Promise<boolean> => {
      applyRate(video);
      try {
        await video.play();
      } catch {
        return false;
      }
      return waitForRenderableFrame(video);
    },
    [applyRate, waitForRenderableFrame],
  );

  /**
   * 대기 영상이 실제로 재생되고 첫 프레임까지 준비된 뒤에만 화면을 넘긴다.
   *
   * <p>예전에는 {@code play()} 성공 여부와 상관없이 불투명도를 바꿔, 재생이 거절되거나 버퍼가
   * 비어 있으면 검은 대기 영상이 정상 영상을 덮었다. 실패하면 기존 영상을 그대로 유지한다.
   */
  const prepareAndSwap = useCallback(
    async (outgoingIsA: boolean, startAt = 0): Promise<boolean> => {
      if (swapping.current || outgoingIsA !== activeIsA.current) return false;
      swapping.current = true;
      const operation = ++operationRef.current;
      const incoming = (outgoingIsA ? bRef : aRef).current;
      const outgoing = (outgoingIsA ? aRef : bRef).current;

      if (!incoming || !outgoing) {
        swapping.current = false;
        return false;
      }

      incoming.style.opacity = '0';
      if (incoming.error || incoming.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
        // 디코더/네트워크 오류 상태는 play() 만 반복해도 풀리지 않는다. 소스를 다시 연결한다.
        incoming.load();
      }
      try {
        incoming.currentTime = Number.isFinite(startAt) && startAt >= 0 ? startAt : 0;
      } catch {
        /* metadata 전 seek 예외 무시 */
      }

      const ready = await playUntilFrame(incoming);
      if (operation !== operationRef.current || outgoingIsA !== activeIsA.current || !ready) {
        incoming.pause();
        incoming.style.opacity = '0';
        outgoing.style.opacity = '1';
        if (operation === operationRef.current) swapping.current = false;
        return false;
      }

      crossfade(incoming, outgoing);
      activeIsA.current = !outgoingIsA;
      consecutiveStallsRef.current = 0;
      if (swapFinishTimerRef.current) window.clearTimeout(swapFinishTimerRef.current);
      swapFinishTimerRef.current = window.setTimeout(() => {
        if (operation !== operationRef.current) return;
        outgoing.pause();
        try {
          outgoing.currentTime = 0;
        } catch {
          /* noop */
        }
        outgoing.style.opacity = '0';
        incoming.style.opacity = '1';
        swapping.current = false;
        swapFinishTimerRef.current = 0;
      }, CROSSFADE_MS + 120);
      return true;
    },
    [crossfade, playUntilFrame],
  );

  // 마운트 / 테마(src) 변경 시: A 를 처음부터 보이게, B 는 숨겨 대기.
  useEffect(() => {
    if (!shouldRender) return;

    const operation = ++operationRef.current;
    activeIsA.current = true;
    swapping.current = false;
    consecutiveStallsRef.current = 0;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (fadeFallbackTimerRef.current) {
      window.clearTimeout(fadeFallbackTimerRef.current);
      fadeFallbackTimerRef.current = 0;
    }
    if (swapFinishTimerRef.current) {
      window.clearTimeout(swapFinishTimerRef.current);
      swapFinishTimerRef.current = 0;
    }
    const a = aRef.current;
    const b = bRef.current;
    if (a) {
      // 디코딩 전 video 요소가 검게 칠해지는 것을 막기 위해 첫 프레임 전에는 숨긴다.
      a.style.opacity = '0';
      try {
        a.currentTime = 0;
      } catch {
        /* noop */
      }
      void playUntilFrame(a).then((ready) => {
        if (operation !== operationRef.current || !ready) return;
        a.style.opacity = '1';
      });
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
      operationRef.current += 1;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (fadeFallbackTimerRef.current) window.clearTimeout(fadeFallbackTimerRef.current);
      if (swapFinishTimerRef.current) window.clearTimeout(swapFinishTimerRef.current);
    };
  }, [shouldRender, src, applyRate, playUntilFrame]);

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
      void video.play().catch(() => undefined);
    };

    const tick = () => {
      // 배경 탭에서는 브라우저가 정당하게 멈춘다. 되살리려 들면 배터리만 쓴다.
      if (document.visibilityState !== 'visible') return;
      const video = activeVideo();
      if (!video) return;
      if (isPlaybackStalled(video.paused, video.ended, video.currentTime, previousTime)) {
        consecutiveStallsRef.current += 1;
        if (shouldUseStandbyRecovery(consecutiveStallsRef.current)) {
          const outgoingIsA = activeIsA.current;
          const startAt = video.ended ? 0 : video.currentTime;
          void prepareAndSwap(outgoingIsA, startAt).then((swapped) => {
            if (!swapped && outgoingIsA === activeIsA.current) revive();
          });
        } else {
          revive();
        }
      } else {
        consecutiveStallsRef.current = 0;
      }
      previousTime = video.currentTime;
    };

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      // 돌아온 직후의 위치는 떠나기 전 값이라 비교 대상이 못 된다.
      previousTime = -1;
      consecutiveStallsRef.current = 0;
      revive();
    };

    const timer = window.setInterval(tick, WATCHDOG_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [shouldRender, src, prepareAndSwap]);

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
      // 이미 다음 편을 준비 중이면 마지막 프레임이 검게 변하기 전에 현재 편을 다시 돌린다.
      if (swapping.current) {
        try {
          video.currentTime = 0;
        } catch {
          /* noop */
        }
        void video.play().catch(() => undefined);
        return;
      }
      void prepareAndSwap(isA, 0).then((swapped) => {
        if (swapped || isA !== activeIsA.current) return;
        try {
          video.currentTime = 0;
        } catch {
          /* noop */
        }
        void video.play().catch(() => undefined);
      });
    },
    [prepareAndSwap],
  );

  const handleTimeUpdate = useCallback(
    (isA: boolean) => (e: SyntheticEvent<HTMLVideoElement>) => {
      if (swapping.current || isA !== activeIsA.current) return;
      const cur = e.currentTarget;
      const dur = cur.duration;
      if (!dur || !Number.isFinite(dur)) return;
      if ((dur - cur.currentTime) / (rate || 1) > CROSSFADE_MS / 1000 + 0.25) return;

      void prepareAndSwap(isA, 0);
    },
    [rate, prepareAndSwap],
  );

  const handleError = useCallback(
    (isA: boolean) => (e: SyntheticEvent<HTMLVideoElement>) => {
      if (isA !== activeIsA.current) return;
      const failedVideo = e.currentTarget;
      void prepareAndSwap(isA, 0).then((swapped) => {
        if (!swapped && isA === activeIsA.current) {
          // 오류 난 video 요소의 검은 오류 프레임 대신 부모의 브랜드 배경을 보여 준다.
          failedVideo.style.opacity = '0';
        }
      });
    },
    [prepareAndSwap],
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
        onPlaying={() => {
          consecutiveStallsRef.current = 0;
        }}
        onTimeUpdate={handleTimeUpdate(true)}
        onEnded={handleEnded(true)}
        onError={handleError(true)}
        style={{ opacity: 0 }}
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
        onPlaying={() => {
          consecutiveStallsRef.current = 0;
        }}
        onTimeUpdate={handleTimeUpdate(false)}
        onEnded={handleEnded(false)}
        onError={handleError(false)}
        style={{ opacity: 0 }}
        className={`${base} ${className}`}
      >
        <source src={src} type="video/mp4" />
      </video>
    </>
  );
}
