'use client';

/**
 * 지도가 뜨기 전에 그 자리를 지키는 그림.
 *
 * <p>지도는 두 가지를 기다린다 — 번들과 테마. 그 사이 자리를 비워 두면 화면이 한 번 접혔다
 * 펴지고, 색으로만 채우면 라이트 화면에 검은 사각형이 잠깐 뜬다. 격자를 깔아 두면 "여기 지도가
 * 온다" 가 읽히고, 실제 지도로 바뀔 때 눈에 띄는 변화가 적다.
 *
 * <p><b>글자를 쓰지 않는다.</b> 예전에 이 자리가 "위치 정보가 없습니다" 를 보여줬는데,
 * 좌표가 멀쩡한 팝업도 불러오는 동안 그 문구를 띄웠다. 서버가 만든 HTML 에도 그대로 들어가서
 * 검색엔진이 <b>팝업 위치를 알려주는 페이지에서 "위치 정보가 없습니다" 를 읽어갔다.</b>
 * 모르는 것과 없는 것은 다르고, 모를 때는 아무 말도 하지 않는 편이 맞다.
 */

/** 격자 한 칸. 실제 지도의 도로 간격과 비슷해 바뀔 때 덜 튄다. */
const CELL = '40px';

interface MapPlaceholderProps {
  /** 화면 낭독기에 읽어 줄 말. 화면에는 안 보인다. */
  label: string;
  className?: string;
}

export default function MapPlaceholder({ label, className }: MapPlaceholderProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`relative h-full w-full overflow-hidden bg-cream-300 dark:bg-[#14161a] ${className ?? ''}`}
    >
      {/* 격자 — 두 방향 반복 그라디언트. 이미지 요청이 없어 지도보다 늘 먼저 그려진다. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            `repeating-linear-gradient(90deg, var(--map-grid-line) 0 1px, transparent 1px ${CELL})`,
            `repeating-linear-gradient(0deg, var(--map-grid-line) 0 1px, transparent 1px ${CELL})`,
          ].join(','),
        }}
        aria-hidden
      />
      {/* 흐린 핀 세 개 — 지도에 무엇이 찍힐지 미리 알려 준다. 자리는 고정이다.
          움직이거나 무작위로 두면 실제 데이터처럼 보여서 오히려 헷갈린다. */}
      {[
        { left: '32%', top: '38%' },
        { left: '58%', top: '52%' },
        { left: '44%', top: '68%' },
      ].map((pos) => (
        <span
          key={pos.left}
          aria-hidden
          className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-400/25 ring-2 ring-lime-400/15"
          style={pos}
        />
      ))}
      {/* 가장자리를 살짝 어둡게 — 평평한 격자가 종이처럼 보이는 것을 막는다. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(10,10,10,0.06))] dark:bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.35))]"
      />
    </div>
  );
}
