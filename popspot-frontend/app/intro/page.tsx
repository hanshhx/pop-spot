"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  Calendar,
  MapPin,
  Crown,
  ArrowRight,
  LogIn,
  UserPlus,
  ChevronDown,
  Sparkles,
  Users,
  Stamp,
  Zap,
  Clock,
  Map as MapIcon,
  Sun,
  Moon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useGuestMode } from "@/lib/useGuestMode";

/* ============================================================================ */
/*  POP-SPOT — Intro Page                                                      */
/*                                                                              */
/*  매거진 에디토리얼 무드 — 12 데코 레이어 + 페이지 단위 fixed 배경.            */
/*  컴포넌트 단위로 분리해 각 레이어가 한 가지 책임만 갖도록 했다.              */
/* ============================================================================ */

/* ────────── 디자인 상수 ────────── */
const SECTION_META = [
  { id: 1, label: "SEONGSU · HANNAM · APGUJEONG", vol: "VOL.01" },
  { id: 2, label: "WHY POP-SPOT", vol: "VOL.02" },
  { id: 3, label: "CORE FEATURES", vol: "VOL.03" },
  { id: 4, label: "WHAT IS UNIQUE", vol: "VOL.04" },
  { id: 5, label: "START NOW", vol: "VOL.05" },
] as const;

const PUBLICATION_YEAR = 2026;

/**
 * 인트로 시청 추적 — 첫 방문에서만 cinema 시퀀스를 보여주기 위한 localStorage 키.
 * 일단 한 번 보면 다음 방문부터는 인트로를 건너뛰고 메인 페이지로 직행한다.
 */
const INTRO_PLAYED_KEY = "popspot:intro:played";

/** 첫 방문 cinema 시퀀스 총 길이 (ms). 7초 후 자동으로 메인 페이지로 진입. */
const CINEMA_DURATION_MS = 7000;

/* ────────── 배경: 라이트 / 다크 (page-level fixed) ────────── */

/** 라이트 모드 페이지 배경 — 따뜻한 cream 베이스 + 6 파스텔 orb. */
function LightPageBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-cream-200 via-cream-300/50 to-cream-100">
      <div className="pointer-events-none absolute right-[-10%] top-[5%] h-[520px] w-[520px] rounded-full bg-hot-300/55 blur-3xl" />
      <div className="pointer-events-none absolute left-[-10%] top-[15%] h-[480px] w-[480px] rounded-full bg-lime-200/65 blur-3xl" />
      <div className="pointer-events-none absolute left-[35%] top-[45%] h-[420px] w-[420px] rounded-full bg-amber-200/55 blur-3xl" />
      <div className="pointer-events-none absolute right-[20%] top-[60%] h-[460px] w-[460px] rounded-full bg-blue-200/55 blur-3xl" />
      <div className="pointer-events-none absolute left-[5%] bottom-[10%] h-[400px] w-[400px] rounded-full bg-violet-200/45 blur-3xl" />
      <div className="pointer-events-none absolute right-[-5%] bottom-[5%] h-[440px] w-[440px] rounded-full bg-rose-200/55 blur-3xl" />
    </div>
  );
}

/** 다크 모드 페이지 배경 — 따뜻한 deep purple-gray 베이스 + 6 파스텔 orb (채도↑). */
function DarkPageBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: "linear-gradient(135deg, #1a1820 0%, #221e2a 50%, #1a1820 100%)" }}>
      <div className="pointer-events-none absolute right-[-10%] top-[5%] h-[520px] w-[520px] rounded-full bg-hot-500/30 blur-3xl" />
      <div className="pointer-events-none absolute left-[-10%] top-[15%] h-[480px] w-[480px] rounded-full bg-lime-500/22 blur-3xl" />
      <div className="pointer-events-none absolute left-[35%] top-[45%] h-[420px] w-[420px] rounded-full bg-amber-400/22 blur-3xl" />
      <div className="pointer-events-none absolute right-[20%] top-[60%] h-[460px] w-[460px] rounded-full bg-blue-500/25 blur-3xl" />
      <div className="pointer-events-none absolute left-[5%] bottom-[10%] h-[400px] w-[400px] rounded-full bg-violet-500/22 blur-3xl" />
      <div className="pointer-events-none absolute right-[-5%] bottom-[5%] h-[440px] w-[440px] rounded-full bg-rose-500/25 blur-3xl" />
    </div>
  );
}

/** 모서리에서 viewport 안쪽으로 퍼지는 conic ray — cinematic 광원 흉내. */
function CornerConicRays() {
  return (
    <>
      <div
        className="pointer-events-none absolute -left-[20%] -top-[20%] h-[60vh] w-[60vh] opacity-30 dark:opacity-25"
        style={{
          background:
            "conic-gradient(from 135deg at 50% 50%, transparent 0deg, rgba(194,249,112,0.4) 30deg, transparent 60deg)",
        }}
      />
      <div
        className="pointer-events-none absolute -right-[20%] -bottom-[20%] h-[60vh] w-[60vh] opacity-30 dark:opacity-25"
        style={{
          background:
            "conic-gradient(from -45deg at 50% 50%, transparent 0deg, rgba(255,87,34,0.35) 30deg, transparent 60deg)",
        }}
      />
    </>
  );
}

/** SVG 노이즈 그레인 — 디지털 → 아날로그 인쇄물 느낌. 페이지 전체에 살짝 깔린다. */
function GrainTexture() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[5] opacity-[0.06] mix-blend-multiply dark:opacity-[0.08] dark:mix-blend-overlay"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'160\\' height=\\'160\\' viewBox=\\'0 0 160 160\\'><filter id=\\'n\\'><feTurbulence type=\\'fractalNoise\\' baseFrequency=\\'0.9\\' numOctaves=\\'2\\' stitchTiles=\\'stitch\\'/></filter><rect width=\\'100%\\' height=\\'100%\\' filter=\\'url(%23n)\\'/></svg>\")",
      }}
    />
  );
}

/** 천천히 떠다니는 dust 파티클 — 정적인 화면에 미세한 살아있음. */
function DustParticles() {
  const dots = [
    { left: "15%", top: "20%", delay: 0, duration: 18 },
    { left: "70%", top: "12%", delay: 3, duration: 22 },
    { left: "40%", top: "55%", delay: 6, duration: 20 },
    { left: "85%", top: "60%", delay: 1, duration: 24 },
    { left: "25%", top: "75%", delay: 4, duration: 19 },
    { left: "60%", top: "85%", delay: 2, duration: 21 },
    { left: "8%", top: "45%", delay: 5, duration: 23 },
    { left: "92%", top: "30%", delay: 7, duration: 20 },
  ];
  return (
    <div className="pointer-events-none fixed inset-0 z-[3]" aria-hidden>
      {dots.map((d, i) => (
        <motion.span
          key={i}
          className="absolute size-1 rounded-full bg-ink-900/30 dark:bg-cream-100/40"
          style={{ left: d.left, top: d.top }}
          animate={{ y: [-6, 6, -6], opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: d.duration, delay: d.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

/* ────────── 매거진 에디토리얼 데코 (per-section) ────────── */

interface SideLabelProps {
  text: string;
  side: "left" | "right";
}

/** 섹션 좌/우 가장자리에 세로로 회전된 매거진 라벨. */
function VerticalLabel({ text, side }: SideLabelProps) {
  const positionClass = side === "left" ? "left-4 sm:left-6" : "right-4 sm:right-6";
  const rotation = side === "left" ? "rotate-180" : "";
  return (
    <div
      className={`pointer-events-none absolute ${positionClass} top-1/2 hidden -translate-y-1/2 select-none sm:block`}
      style={{ writingMode: "vertical-rl" }}
      aria-hidden
    >
      <span className={`block text-[10px] font-mono uppercase tracking-[0.4em] text-ink-700/40 dark:text-cream-100/35 ${rotation}`}>
        {text}
      </span>
    </div>
  );
}

interface GhostNumberProps {
  number: number;
  position?: string;
}

/** 거대 outline 섹션 번호 — DU 70주년 스타일. 섹션 우상단 또는 지정 위치에. */
function GhostNumber({ number, position = "right-[6%] top-[8%]" }: GhostNumberProps) {
  return (
    <span
      className={`pointer-events-none absolute ${position} hidden select-none text-[16vw] font-black leading-none text-transparent sm:block md:text-[14vw]`}
      style={{ WebkitTextStroke: "1.5px rgba(30,30,30,0.10)" }}
      aria-hidden
    >
      <span className="block dark:[-webkit-text-stroke:1.5px_rgba(255,255,255,0.12)]">
        0{number}
      </span>
    </span>
  );
}

interface MetaChipProps {
  vol: string;
  position?: string;
}

/** 매거진 메타 칩 — "VOL.01 · 2026" 같은 발행 정보 표시. */
function MetaChip({ vol, position = "left-[5%] top-[8%]" }: MetaChipProps) {
  return (
    <div
      className={`pointer-events-none absolute ${position} hidden select-none sm:block`}
      aria-hidden
    >
      <span className="inline-flex items-center gap-2 rounded-full border border-ink-900/15 bg-cream-100/60 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-700/60 backdrop-blur-sm dark:border-white/20 dark:bg-ink-900/40 dark:text-cream-100/60">
        <span className="size-1 rounded-full bg-hot-500 dark:bg-hot-400" />
        {vol} · {PUBLICATION_YEAR}
      </span>
    </div>
  );
}

interface SectionDecorProps {
  meta: (typeof SECTION_META)[number];
}

/** 섹션별 공통 에디토리얼 데코 — 세로 라벨 + ghost 번호 + 매거진 칩. */
function SectionDecor({ meta }: SectionDecorProps) {
  return (
    <>
      <VerticalLabel text={meta.label} side="left" />
      <VerticalLabel text={`NO.${meta.id} / 05`} side="right" />
      <GhostNumber number={meta.id} />
      <MetaChip vol={meta.vol} />
    </>
  );
}

/** 마퀴 스트립 — 페이지 호흡 정리. 좌→우 무한 스크롤 텍스트. */
function MarqueeStrip() {
  const words = ["POP·SPOT", "SEOUL POPUP", "DAILY UPDATE", "EST. 2026", "SEONGSU EDITION"];
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 overflow-hidden border-y border-ink-900/10 bg-cream-100/40 py-2 backdrop-blur-sm dark:border-white/10 dark:bg-ink-900/30">
      <motion.div
        className="flex gap-12 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        {[...words, ...words, ...words].map((w, i) => (
          <span key={i} className="font-mono text-xs uppercase tracking-[0.3em] text-ink-700/40 dark:text-cream-100/35">
            {w}
            <span className="mx-12 text-hot-500 dark:text-hot-400">×</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/* ────────── Hero 폴라로이드 데이터 + 컴포넌트 ────────── */

interface PolaroidData {
  name: string;
  location: string;
  gradient: string;
  rotate: string;
  position: string;
}

const HERO_POLAROIDS: PolaroidData[] = [
  { name: "젠틀몬스터", location: "성수동 · 카페", gradient: "from-hot-400/80 to-hot-300/50", rotate: "-rotate-6", position: "left-[4%] top-[10%]" },
  { name: "마뗑킴", location: "한남 · 패션", gradient: "from-lime-300/80 to-lime-200/40", rotate: "rotate-3", position: "right-[6%] top-[14%]" },
  { name: "포켓몬스터", location: "압구정 · 캐릭터", gradient: "from-amber-300/80 to-hot-300/40", rotate: "-rotate-3", position: "left-[8%] bottom-[12%]" },
  { name: "디스이즈네버댓", location: "성수 · 굿즈", gradient: "from-violet-400/70 to-blue-300/50", rotate: "rotate-6", position: "right-[5%] bottom-[16%]" },
];

const SECTION_SIDE_POLAROIDS: Record<number, PolaroidData[]> = {
  2: [
    { name: "탬버린즈", location: "성수 · 뷰티", gradient: "from-rose-300/80 to-amber-200/50", rotate: "-rotate-4", position: "left-[5%] top-[18%]" },
  ],
  3: [
    { name: "아이브 팝업", location: "코엑스 · 엔터", gradient: "from-blue-300/80 to-violet-300/50", rotate: "rotate-5", position: "right-[5%] top-[22%]" },
  ],
  4: [
    { name: "노티드도넛", location: "삼청동 · F&B", gradient: "from-amber-300/80 to-rose-200/50", rotate: "-rotate-5", position: "left-[5%] bottom-[20%]" },
  ],
};

interface PolaroidCardProps {
  data: PolaroidData;
  delay?: number;
}

/** 폴라로이드 사진 카드 — 그라데이션 placeholder + 브랜드명/위치 라벨. */
function PolaroidCard({ data, delay = 0 }: PolaroidCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay }}
      className={`pointer-events-none absolute ${data.position} ${data.rotate} w-28 select-none rounded-md bg-white p-2 shadow-xl shadow-ink-900/20 ring-1 ring-ink-900/10 dark:bg-ink-800 dark:shadow-black/50 dark:ring-white/15 md:w-36`}
    >
      <div className={`aspect-[4/5] rounded-sm bg-gradient-to-br ${data.gradient}`} />
      <div className="mt-2 px-1 pb-1">
        <div className="text-[11px] font-bold text-ink-900 dark:text-cream-100 md:text-xs">{data.name}</div>
        <div className="mt-0.5 text-[9px] text-ink-700/60 dark:text-cream-100/55 md:text-[10px]">{data.location}</div>
      </div>
    </motion.div>
  );
}

/** 거대 outline 브랜드 텍스트 (Hero 좌/우). */
interface OutlineBrandProps {
  word: string;
  position: string;
  delay?: number;
}
function OutlineBrand({ word, position, delay = 0 }: OutlineBrandProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: position.includes("left") ? -40 : 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 1, delay }}
      className={`pointer-events-none absolute ${position} hidden select-none sm:block`}
      aria-hidden
    >
      <span
        className="block text-[14vw] font-black leading-none tracking-tighter text-transparent dark:[-webkit-text-stroke:1.5px_rgba(255,255,255,0.18)]"
        style={{ WebkitTextStroke: "1.5px rgba(30,30,30,0.15)" }}
      >
        {word}
      </span>
    </motion.div>
  );
}

/* ────────── Section 3 미니 위젯 프리뷰 ────────── */

/** 미니 캘린더 — 28 도트, 일부 이벤트 표시. */
function MiniCalendarPreview() {
  const eventDays = new Set([3, 7, 8, 14, 17, 22, 23, 28]);
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {Array.from({ length: 28 }, (_, i) => {
        const day = i + 1;
        const isEvent = eventDays.has(day);
        return (
          <div
            key={day}
            className={`aspect-square rounded-sm ${
              isEvent ? "bg-lime-500 dark:bg-lime-300" : "bg-ink-900/8 dark:bg-white/8"
            }`}
          />
        );
      })}
    </div>
  );
}

/** 미니 지도 — SVG 격자 + 핀 5개. */
function MiniMapPreview() {
  const pins = [
    { x: 25, y: 30 },
    { x: 50, y: 20 },
    { x: 70, y: 45 },
    { x: 35, y: 65 },
    { x: 80, y: 75 },
  ];
  return (
    <svg viewBox="0 0 100 90" className="w-full">
      <defs>
        <pattern id="grid-light" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100" height="90" fill="url(#grid-light)" className="text-ink-900 dark:text-white" />
      {pins.map((pin, i) => (
        <g key={i}>
          <circle cx={pin.x} cy={pin.y} r="3" className="fill-hot-500 dark:fill-hot-400" />
          <circle cx={pin.x} cy={pin.y} r="6" className="fill-hot-500/20 dark:fill-hot-400/20" />
        </g>
      ))}
    </svg>
  );
}

/** 미니 랭킹 — TOP 3 행. */
function MiniRankingPreview() {
  const items = [
    { rank: 1, name: "젠틀몬스터", view: "4.2k" },
    { rank: 2, name: "마뗑킴", view: "3.1k" },
    { rank: 3, name: "디스이즈네버댓", view: "2.8k" },
  ];
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.rank} className="flex items-center gap-3 rounded-md bg-ink-900/5 px-3 py-2 dark:bg-white/8">
          <span className={`text-xs font-black ${item.rank === 1 ? "text-hot-500 dark:text-hot-400" : "text-ink-900/40 dark:text-white/40"}`}>
            {item.rank}
          </span>
          <span className="flex-1 text-xs font-medium text-ink-900 dark:text-cream-100">{item.name}</span>
          <span className="text-[10px] text-ink-700/50 dark:text-cream-100/50">{item.view}</span>
        </div>
      ))}
    </div>
  );
}

/* ────────── 콘텐츠 데이터 ────────── */

const HERO_FEATURE_ICONS = [
  { Icon: Calendar, label: "캘린더", sub: "이번 달 일정" },
  { Icon: MapPin, label: "지도", sub: "성수·한남·압구정" },
  { Icon: Crown, label: "랭킹", sub: "사람들이 보는 곳" },
];

type FeaturePreview = "calendar" | "map" | "ranking";

const BIG_FEATURES: Array<{
  Icon: typeof Calendar;
  title: string;
  desc: string;
  accent: string;
  preview: FeaturePreview;
}> = [
  { Icon: Calendar, title: "팝업 캘린더", desc: "이번 달, 다음 달 팝업을 한 화면에 펼쳐놨어요. 가고 싶은 거 미리 찜해두면 돼요.", accent: "text-lime-600 dark:text-lime-300", preview: "calendar" },
  { Icon: MapIcon, title: "지도", desc: "성수·한남·압구정 — 핀 찍힌 곳 클릭하면 길찾기까지 바로 연결돼요.", accent: "text-ink-900 dark:text-cream-100", preview: "map" },
  { Icon: Crown, title: "랭킹", desc: "지금 사람들이 많이 보는 팝업 순위. 뭐가 뜨고 있는지 궁금할 때.", accent: "text-hot-500 dark:text-hot-400", preview: "ranking" },
];

const UNIQUE_POINTS = [
  { Icon: Sparkles, title: "AI 코스 추천", desc: "분위기랑 인원 알려주면 그날 가기 좋은 코스 만들어 줘요." },
  { Icon: Users, title: "친구랑 같이 짜기", desc: "링크 보내서 같이 갈 친구랑 가고 싶은 곳 골라요." },
  { Icon: Stamp, title: "스탬프 패스포트", desc: "다녀온 팝업에 도장 찍으면 나만의 기록이 쌓여요." },
  { Icon: Zap, title: "혼잡도 정보", desc: "줄이 얼마나 긴지 가기 전에 확인하고 출발해요." },
];

const STAT_CARDS = [
  { Icon: Clock, title: "매일 새벽 4시", desc: "자동 수집", color: "lime" },
  { Icon: Calendar, title: "1~2달치", desc: "일정 미리보기", color: "blue" },
  { Icon: Sparkles, title: "24시간 안에", desc: "신고 응답", color: "hot" },
] as const;

const STAT_COLOR: Record<string, string> = {
  lime: "bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  hot: "bg-hot-100 text-hot-600 dark:bg-hot-500/15 dark:text-hot-300",
};

/* ────────── 메인 페이지 ────────── */

export default function IntroPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  useEffect(() => {
    try {
      setIsLoggedIn(!!localStorage.getItem("user"));
    } catch {
      setIsLoggedIn(false);
    }
  }, []);

  // 게스트 모드 7일 정책 — 첫 방문 기록 + 잔여 일수 + 만료 여부.
  const { mounted: guestReady, remainingDays, expired } = useGuestMode(isLoggedIn);

  /**
   * 사용자 상황 기반 진입 경로 — 진입 트리거 (CTA / Enter / 자동) 가 공유한다.
   *
   * <ul>
   *   <li>로그인 사용자 / 게스트 미만료 → 메인 페이지 (?entered=1)</li>
   *   <li>게스트 만료 → 회원가입 강제</li>
   * </ul>
   */
  const resolveNextRoute = (): string => {
    if (isLoggedIn) return "/?entered=1";
    if (guestReady && expired) return "/signup";
    return "/?entered=1";
  };

  const proceed = () => router.push(resolveNextRoute());

  /**
   * 첫 방문 cinema 시퀀스 — 매거진 인트로를 한 번 본 사용자는 재방문 시 즉시 메인으로 우회.
   *
   * <p>동작:
   * <ol>
   *   <li>이미 인트로를 본 적이 있거나 로그인된 사용자 → {@code router.replace} 로 메인 즉시 진입.</li>
   *   <li>첫 방문 사용자 → {@link INTRO_PLAYED_KEY} 마킹 + {@link CINEMA_DURATION_MS} 타이머 시작.</li>
   *   <li>사용자가 스크롤하면 cinema 자동 진입을 취소 — 매거진 구경 모드로 전환.</li>
   * </ol>
   */
  useEffect(() => {
    if (!mounted) return;

    const alreadyPlayed = (() => {
      try {
        return window.localStorage.getItem(INTRO_PLAYED_KEY) === "true";
      } catch {
        return false;
      }
    })();

    // 재방문자 / 이미 로그인 — 인트로 건너뛰고 즉시 메인.
    if (alreadyPlayed || isLoggedIn) {
      router.replace(resolveNextRoute());
      return;
    }

    // 첫 방문 — 인트로 시청 표시 + 자동 진입 타이머.
    try {
      window.localStorage.setItem(INTRO_PLAYED_KEY, "true");
    } catch {
      /* localStorage 비활성 — 무시 */
    }

    let interrupted = false;
    const cancelAutoEnter = () => {
      interrupted = true;
    };

    const timerId = window.setTimeout(() => {
      if (interrupted) return;
      router.push(resolveNextRoute());
    }, CINEMA_DURATION_MS);

    // 스크롤 = 매거진 탐색 의지로 보고 자동 진입 취소.
    window.addEventListener("scroll", cancelAutoEnter, { passive: true, once: true });

    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener("scroll", cancelAutoEnter);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolveNextRoute 는 매 렌더 새 함수라 deps 에 두면 매번 재시작됨. mount + 로그인/만료 변화만 추적.
  }, [mounted, isLoggedIn, guestReady, expired, router]);

  // Enter 키로도 진입 — 자동 진입 타이머와 동일한 라우팅 규칙 사용.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const next = isLoggedIn
        ? "/?entered=1"
        : guestReady && expired
        ? "/signup"
        : "/?entered=1";
      router.push(next);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isLoggedIn, router, guestReady, expired]);

  return (
    <>
      {/* 페이지 단위 fixed 배경 — 라이트/다크 분기 + 코너 광원 */}
      <div className="pointer-events-none fixed inset-0 z-0">
        {(!mounted || !isDark) ? <LightPageBackground /> : <DarkPageBackground />}
        <CornerConicRays />
      </div>
      <GrainTexture />
      <DustParticles />

      {/* 상단 컨트롤 — 게스트 잔여 일수 + 테마 토글 + Skip */}
      <div className="fixed right-5 top-5 z-[100] flex items-center gap-2 sm:right-6 sm:top-6">
        {/* 게스트 모드 잔여 일수 칩 — 로그인 안 한 사용자에게만 노출. mount 후에만 표시. */}
        {guestReady && !isLoggedIn && !expired && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-lime-500/15 px-3 py-1.5 text-[11px] font-medium text-lime-700 ring-1 ring-lime-500/40 backdrop-blur-md dark:bg-lime-300/15 dark:text-lime-300 dark:ring-lime-300/40"
            aria-label={`게스트 모드 ${remainingDays}일 남음`}
            title="회원가입하면 모든 기능을 이용할 수 있어요"
          >
            <span className="size-1.5 animate-pulse rounded-full bg-lime-500 dark:bg-lime-300" />
            게스트 {remainingDays}일
          </span>
        )}
        <button
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label={isDark ? "라이트 모드" : "다크 모드"}
          className="inline-flex size-9 items-center justify-center rounded-full bg-ink-900/10 text-ink-900 ring-1 ring-ink-900/20 backdrop-blur-md transition hover:bg-ink-900/20 active:scale-95 dark:bg-white/15 dark:text-cream-100 dark:ring-white/25 dark:hover:bg-white/25"
        >
          {mounted ? (isDark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />) : null}
        </button>
        <button
          type="button"
          onClick={proceed}
          className="rounded-full bg-ink-900/10 px-4 py-2 text-xs font-semibold text-ink-900 ring-1 ring-ink-900/20 backdrop-blur-md transition hover:bg-ink-900/20 active:scale-95 dark:bg-white/15 dark:text-cream-100 dark:ring-white/25 dark:hover:bg-white/25"
          aria-label="인트로 건너뛰기"
        >
          {isLoggedIn ? "Skip →" : "Login →"}
        </button>
      </div>

      {/* 스냅 스크롤 컨테이너 */}
      <div
        className="relative z-10 h-screen w-full overflow-y-scroll text-cream-100"
        style={{
          scrollSnapType: "y mandatory",
          scrollBehavior: "smooth",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* ============ SECTION 1: Hero ============ */}
        <section className="relative flex min-h-screen w-full items-center justify-center overflow-hidden" style={{ scrollSnapAlign: "start" }}>
          <SectionDecor meta={SECTION_META[0]} />

          <OutlineBrand word="POP" position="left-[-2vw] top-[10%]" delay={0.2} />
          <OutlineBrand word="SPOT" position="right-[-2vw] bottom-[12%]" delay={0.4} />

          <div className="pointer-events-none absolute inset-0 hidden sm:block">
            {HERO_POLAROIDS.map((card, idx) => (
              <PolaroidCard key={card.name} data={card} delay={0.6 + idx * 0.15} />
            ))}
          </div>

          <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 py-12 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-5 py-2 text-sm font-medium text-cream-100 shadow-lg dark:bg-lime-300 dark:text-ink-900"
            >
              <span className="size-1.5 rounded-full bg-lime-300 dark:bg-ink-900" />
              성수 · 한남 · 압구정
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="mt-6 text-6xl font-black leading-[1] tracking-tighter text-ink-900 drop-shadow-md dark:text-white dark:drop-shadow-2xl sm:text-8xl md:text-9xl"
            >
              POP<span className="text-hot-500 dark:text-hot-400">·</span>SPOT
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="mt-5 font-serif text-base italic text-ink-700/70 dark:text-cream-100/70 sm:text-lg"
            >
              Seoul Popup Store Platform
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.9 }}
              className="mt-6 max-w-md text-sm leading-relaxed text-ink-700/80 dark:text-cream-100/80 sm:text-base"
            >
              성수·한남·압구정에서 열리는 팝업을 한 곳에 모아 검색·매칭·기록까지
              제공하는 서울 팝업스토어 플랫폼입니다.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.1 }}
              className="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:gap-4"
            >
              <button
                onClick={proceed}
                className="group inline-flex items-center gap-2 rounded-full bg-ink-900 px-8 py-3.5 text-sm font-bold text-cream-100 shadow-lg shadow-ink-900/20 transition hover:scale-[1.03] hover:bg-ink-800 active:scale-[0.98] dark:bg-lime-300 dark:text-ink-900 dark:shadow-lime-300/30 dark:hover:bg-lime-200 sm:text-base"
              >
                {isLoggedIn ? (
                  <>
                    <span>들어가기</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    <span>로그인</span>
                  </>
                )}
              </button>

              {!isLoggedIn && (
                <button
                  onClick={() => router.push("/signup")}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-ink-900/15 bg-transparent px-8 py-3.5 text-sm font-bold text-ink-900 transition hover:scale-[1.03] hover:border-ink-900/30 hover:bg-ink-900/5 active:scale-[0.98] dark:border-white/25 dark:text-cream-100 dark:hover:border-white/50 dark:hover:bg-white/10 sm:text-base"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>회원가입</span>
                </button>
              )}
            </motion.div>
          </div>

          {/* 스크롤 인디케이터 + 자동 진입 안내 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 2.4 }}
            className="absolute bottom-20 left-1/2 z-20 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="flex flex-col items-center gap-1 text-ink-700/70 dark:text-cream-200/70"
            >
              <span className="text-xs">스크롤하면 더 보기</span>
              <ChevronDown className="h-5 w-5" />
            </motion.div>
          </motion.div>

          {/* 자동 진입 progress bar — 7초 후 메인 자동 진입 시각화. 사용자 스크롤 시 사라짐. */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ scaleX: { duration: CINEMA_DURATION_MS / 1000, ease: "linear" }, opacity: { duration: 0.6, delay: 0.4 } }}
            style={{ transformOrigin: "left" }}
            className="absolute bottom-12 left-0 z-20 h-[2px] w-full origin-left bg-gradient-to-r from-lime-500 via-hot-500 to-blue-500 dark:from-lime-300 dark:via-hot-400 dark:to-blue-400"
            aria-hidden
          />

          <MarqueeStrip />
        </section>

        {/* ============ SECTION 2: Why ============ */}
        <section className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6" style={{ scrollSnapAlign: "start" }}>
          <SectionDecor meta={SECTION_META[1]} />
          {SECTION_SIDE_POLAROIDS[2]?.map((p, i) => (
            <PolaroidCard key={p.name} data={p} delay={0.3 + i * 0.1} />
          ))}

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.5 }}
            transition={{ duration: 0.8 }}
            className="relative z-10 mx-auto max-w-4xl text-center"
          >
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: false }}
              transition={{ delay: 0.1 }}
              className="inline-block rounded-full bg-lime-500/10 px-4 py-1.5 text-sm font-medium text-lime-600 ring-1 ring-lime-500/40 dark:bg-lime-300/15 dark:text-lime-300 dark:ring-lime-300/40"
            >
              서비스 소개
            </motion.span>

            <h2 className="mt-6 text-4xl font-black leading-tight tracking-tight text-ink-900 dark:text-white dark:drop-shadow-2xl sm:text-5xl md:text-7xl">
              서울 팝업 정보를
              <br />
              <span className="text-lime-600 dark:text-lime-300">한 곳에서</span>
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-base text-ink-700/90 dark:text-cream-100/90 sm:text-lg">
              매일 새로 열리는 서울 팝업스토어 정보를 자동으로 수집하고 정리해
              <br className="hidden sm:inline" />
              한 화면에서 검색·매칭·기록할 수 있도록 만든 서비스입니다.
            </p>

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: false, amount: 0.3 }}
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.3 } } }}
              className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5"
            >
              {STAT_CARDS.map((item) => (
                <motion.div
                  key={item.title}
                  variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.6 } } }}
                  className="rounded-xl bg-white/80 p-5 text-left backdrop-blur-sm ring-1 ring-ink-900/8 dark:bg-ink-900/50 dark:ring-white/10"
                >
                  <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${STAT_COLOR[item.color]}`}>
                    <item.Icon className="size-4" strokeWidth={2.4} />
                  </div>
                  <div className="mt-3 text-lg font-bold text-ink-900 dark:text-white">{item.title}</div>
                  <div className="mt-0.5 text-xs text-ink-700/65 dark:text-cream-100/65">{item.desc}</div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* ============ SECTION 3: Core Features ============ */}
        <section className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 py-16" style={{ scrollSnapAlign: "start" }}>
          <SectionDecor meta={SECTION_META[2]} />
          {SECTION_SIDE_POLAROIDS[3]?.map((p, i) => (
            <PolaroidCard key={p.name} data={p} delay={0.3 + i * 0.1} />
          ))}

          <div className="relative z-10 mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.7 }}
              className="text-center"
            >
              <span className="inline-block rounded-full bg-white/60 px-4 py-1.5 text-sm font-medium text-ink-700/90 ring-1 ring-ink-900/15 backdrop-blur-sm dark:bg-white/10 dark:text-cream-100/90 dark:ring-white/20">
                주요 기능
              </span>
              <h2 className="mt-5 text-3xl font-black tracking-tight text-ink-900 dark:text-white dark:drop-shadow-2xl sm:text-5xl md:text-6xl">
                <span className="text-hot-500 dark:text-hot-400">3가지</span> 핵심 기능
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm text-ink-700/85 dark:text-cream-100/85 sm:text-base">
                팝업을 찾고, 가고, 기록할 때 가장 자주 쓰는 기능입니다.
              </p>
            </motion.div>

            <div className="mt-12 grid grid-cols-1 gap-4 sm:mt-16 sm:grid-cols-3 sm:gap-5">
              {BIG_FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.6, delay: i * 0.15 }}
                  className="rounded-2xl bg-white p-6 ring-1 ring-ink-900/10 transition hover:-translate-y-1 hover:ring-ink-900/20 dark:bg-ink-900/60 dark:ring-white/10 dark:hover:ring-white/20"
                >
                  <div className="flex items-center justify-between">
                    <f.Icon className={`h-7 w-7 ${f.accent}`} strokeWidth={2.2} />
                    <span className="font-mono text-[10px] uppercase tracking-wider text-ink-700/40 dark:text-cream-100/40">0{i + 1}</span>
                  </div>
                  <h3 className="mt-5 text-xl font-bold tracking-tight text-ink-900 dark:text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-700/75 dark:text-cream-100/75">{f.desc}</p>
                  <div className="mt-5">
                    {f.preview === "calendar" && <MiniCalendarPreview />}
                    {f.preview === "map" && <MiniMapPreview />}
                    {f.preview === "ranking" && <MiniRankingPreview />}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ============ SECTION 4: Unique ============ */}
        <section className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 py-16" style={{ scrollSnapAlign: "start" }}>
          <SectionDecor meta={SECTION_META[3]} />
          {SECTION_SIDE_POLAROIDS[4]?.map((p, i) => (
            <PolaroidCard key={p.name} data={p} delay={0.3 + i * 0.1} />
          ))}

          <div className="relative z-10 mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.7 }}
              className="text-center"
            >
              <span className="inline-block rounded-full bg-hot-400/15 px-4 py-1.5 text-sm font-medium text-hot-500 ring-1 ring-hot-400/40 dark:text-hot-400">
                차별점
              </span>
              <h2 className="mt-5 text-3xl font-black tracking-tight text-ink-900 dark:text-white dark:drop-shadow-2xl sm:text-5xl md:text-6xl">
                다른 곳엔 없는 <span className="text-hot-500 dark:text-hot-400">4가지</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm text-ink-700/85 dark:text-cream-100/85 sm:text-base">
                팝업 정보 사이트에서 보기 어려운, POP-SPOT 만의 부가 기능입니다.
              </p>
            </motion.div>

            <div className="mt-12 grid grid-cols-1 gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-5">
              {UNIQUE_POINTS.map((p, i) => {
                const barColor = ["bg-lime-300", "bg-hot-400", "bg-amber-300", "bg-blue-400"][i % 4];
                const iconBox = ["bg-lime-300/10", "bg-hot-400/10", "bg-amber-300/10", "bg-blue-400/10"][i % 4];
                const iconColor = [
                  "text-lime-600 dark:text-lime-300",
                  "text-hot-500 dark:text-hot-400",
                  "text-amber-600 dark:text-amber-300",
                  "text-blue-500 dark:text-blue-300",
                ][i % 4];
                return (
                  <motion.div
                    key={p.title}
                    initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: false, amount: 0.3 }}
                    transition={{ duration: 0.6, delay: i * 0.1 }}
                    className="group relative overflow-hidden rounded-2xl bg-white p-6 ring-1 ring-ink-900/10 transition hover:ring-ink-900/20 dark:bg-ink-900/60 dark:ring-white/10 dark:hover:ring-white/20"
                  >
                    <div className={`absolute left-0 top-0 h-full w-1 ${barColor}`} />
                    <div className="flex items-start gap-4">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconBox}`}>
                        <p.Icon className={`h-6 w-6 ${iconColor}`} strokeWidth={2.2} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-ink-900 dark:text-white">{p.title}</h3>
                          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-700/40 dark:text-cream-100/40">0{i + 1}</span>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-ink-700/75 dark:text-cream-100/75">{p.desc}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ============ SECTION 5: Final CTA ============ */}
        <section className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6" style={{ scrollSnapAlign: "start" }}>
          <SectionDecor meta={SECTION_META[4]} />

          <div className="pointer-events-none absolute -left-[10%] top-[5%] h-[400px] w-[400px] rounded-full bg-lime-200/40 blur-3xl dark:bg-lime-500/18" />
          <div className="pointer-events-none absolute -right-[8%] bottom-[5%] h-[450px] w-[450px] rounded-full bg-hot-200/40 blur-3xl dark:bg-hot-500/18" />

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.4 }}
            transition={{ duration: 0.8 }}
            className="relative z-10 mx-auto max-w-3xl text-center"
          >
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: false }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-4 py-1.5 text-xs font-medium text-cream-100 shadow dark:bg-cream-100 dark:text-ink-900"
            >
              <Clock className="size-3.5" />
              지금 바로
            </motion.span>

            <h2 className="mt-6 text-4xl font-black leading-tight tracking-tight text-ink-900 drop-shadow-sm dark:text-white dark:drop-shadow-2xl sm:text-6xl md:text-7xl">
              POP-SPOT <span className="text-hot-500 dark:text-hot-400">시작하기</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base text-ink-700/80 dark:text-cream-100/90 sm:text-lg">
              서울에서 열리는 팝업스토어, 한 곳에서 만나보세요.
              <br className="hidden sm:inline" />
              로그인 후 모든 기능을 이용할 수 있습니다.
            </p>

            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <motion.button
                onClick={proceed}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-9 py-4 text-base font-bold text-cream-100 shadow-xl shadow-ink-900/20 transition hover:bg-ink-800 dark:bg-lime-300 dark:text-ink-900 dark:shadow-lime-300/30 dark:hover:bg-lime-200 sm:px-12 sm:py-5 sm:text-lg"
              >
                {isLoggedIn ? (
                  <>
                    <span>POP-SPOT 시작하기</span>
                    <ArrowRight className="h-5 w-5" />
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5" />
                    <span>로그인</span>
                  </>
                )}
              </motion.button>
              {!isLoggedIn && (
                <motion.button
                  onClick={() => router.push("/signup")}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-ink-900/15 bg-transparent px-9 py-4 text-base font-bold text-ink-900 transition hover:border-ink-900/30 hover:bg-ink-900/5 dark:border-white/25 dark:text-cream-100 dark:hover:border-white/50 dark:hover:bg-white/10 sm:px-12 sm:py-5 sm:text-lg"
                >
                  <UserPlus className="h-5 w-5" />
                  <span>회원가입</span>
                </motion.button>
              )}
            </div>
            <p className="mt-8 text-xs text-ink-700/60 dark:text-cream-100/60">
              © {PUBLICATION_YEAR} POP-SPOT · 서울 팝업스토어, 한 곳에서.
            </p>
          </motion.div>
        </section>
      </div>
    </>
  );
}
