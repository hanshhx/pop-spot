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
  Play,
  Pause,
  Sun,
  Moon,
} from "lucide-react";
import { useEffect, useState } from "react";

/**
 * 라이트 모드 배경 — SK 스타일 파스텔 그라데이션 blob 3개를 겹쳐서 부드러운 3D 무드.
 * filter:blur 로 외부 자산 없이 흐릿한 색 덩어리를 만든다.
 */
function LightModeBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-cream-100 via-cream-200/60 to-white">
      <div className="pointer-events-none absolute right-[-10%] top-[10%] h-[500px] w-[500px] rounded-full bg-hot-300/40 blur-3xl" />
      <div className="pointer-events-none absolute left-[-10%] top-[40%] h-[450px] w-[450px] rounded-full bg-lime-300/35 blur-3xl" />
      <div className="pointer-events-none absolute right-[20%] bottom-[10%] h-[380px] w-[380px] rounded-full bg-blue-300/30 blur-3xl" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  POP-SPOT — Cover / Intro Page (Persistent Video Background)               */
/*                                                                            */
/*  비디오는 페이지 전체에 fixed 로 깔리고, 각 섹션은 반투명 오버레이만 갖습니다.    */
/*  현재: "/212404.mp4" (12초 loop, 2160x1440) — 5초짜리 4K 보다 반복 덜 티남    */
/*    옵션) "/14385-256955049.mp4" (4K · 5초)                                  */
/*    옵션) "/215246.mp4"                                                     */
/* -------------------------------------------------------------------------- */
const VIDEO_SRC = "/212404.mp4";

const FEATURES = [
  { Icon: Calendar, label: "캘린더", sub: "이번 달 일정" },
  { Icon: MapPin,   label: "지도",   sub: "성수·한남·압구정" },
  { Icon: Crown,    label: "랭킹",   sub: "사람들이 보는 곳" },
];

/**
 * 폴라로이드 스타일 카드 — 메인 페이지의 팝업 카드 미니 프리뷰. 실제 팝업 브랜드명을 라벨로 사용.
 * 회전 + 그림자로 손으로 흩뿌린 콜라주 느낌. 그라데이션은 사진 자리 placeholder.
 */
const HERO_POLAROIDS: Array<{
  name: string;
  location: string;
  gradient: string;
  rotate: string;
  position: string;
}> = [
  {
    name: "젠틀몬스터",
    location: "성수동 · 카페",
    gradient: "from-hot-400/80 to-hot-300/50",
    rotate: "-rotate-6",
    position: "left-[4%] top-[10%]",
  },
  {
    name: "마뗑킴",
    location: "한남 · 패션",
    gradient: "from-lime-300/80 to-lime-200/40",
    rotate: "rotate-3",
    position: "right-[6%] top-[14%]",
  },
  {
    name: "포켓몬스터",
    location: "압구정 · 캐릭터",
    gradient: "from-amber-300/80 to-hot-300/40",
    rotate: "-rotate-3",
    position: "left-[8%] bottom-[12%]",
  },
  {
    name: "디스이즈네버댓",
    location: "성수 · 굿즈",
    gradient: "from-ink-700/70 to-ink-500/40",
    rotate: "rotate-6",
    position: "right-[5%] bottom-[16%]",
  },
];

type FeaturePreview = "calendar" | "map" | "ranking";

const BIG_FEATURES: Array<{
  Icon: typeof Calendar;
  title: string;
  desc: string;
  accent: string;
  preview: FeaturePreview;
}> = [
  {
    Icon: Calendar,
    title: "팝업 캘린더",
    desc: "이번 달, 다음 달 팝업을 한 화면에 펼쳐놨어요. 가고 싶은 거 미리 찜해두면 돼요.",
    accent: "text-lime-500 dark:text-lime-300",
    preview: "calendar",
  },
  {
    Icon: MapIcon,
    title: "지도",
    desc: "성수·한남·압구정 — 핀 찍힌 곳 클릭하면 길찾기까지 바로 연결돼요.",
    accent: "text-ink-900 dark:text-cream-100",
    preview: "map",
  },
  {
    Icon: Crown,
    title: "랭킹",
    desc: "지금 사람들이 많이 보는 팝업 순위. 뭐가 뜨고 있는지 궁금할 때.",
    accent: "text-hot-500 dark:text-hot-400",
    preview: "ranking",
  },
];

/** 미니 캘린더 그리드 — 6주 × 7일 도트. 일부 날짜에 컬러 도트로 "팝업 예정" 표시. */
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
              isEvent
                ? "bg-lime-500 dark:bg-lime-300"
                : "bg-ink-900/8 dark:bg-white/8"
            }`}
          />
        );
      })}
    </div>
  );
}

/** 미니 지도 프리뷰 — SVG 격자 위에 핀 5개. */
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
      {/* 격자 배경 */}
      <defs>
        <pattern id="grid-light" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100" height="90" fill="url(#grid-light)" className="text-ink-900 dark:text-white" />
      {/* 핀들 */}
      {pins.map((pin, i) => (
        <g key={i}>
          <circle cx={pin.x} cy={pin.y} r="3" className="fill-hot-500 dark:fill-hot-400" />
          <circle cx={pin.x} cy={pin.y} r="6" className="fill-hot-500/20 dark:fill-hot-400/20" />
        </g>
      ))}
    </svg>
  );
}

/** 미니 랭킹 프리뷰 — TOP 3 행. */
function MiniRankingPreview() {
  const items = [
    { rank: 1, name: "젠틀몬스터", view: "4.2k" },
    { rank: 2, name: "마뗑킴", view: "3.1k" },
    { rank: 3, name: "디스이즈네버댓", view: "2.8k" },
  ];
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.rank}
          className="flex items-center gap-3 rounded-md bg-ink-900/5 px-3 py-2 dark:bg-white/8"
        >
          <span
            className={`text-xs font-black ${
              item.rank === 1
                ? "text-hot-500 dark:text-hot-400"
                : "text-ink-900/40 dark:text-white/40"
            }`}
          >
            {item.rank}
          </span>
          <span className="flex-1 text-xs font-medium text-ink-900 dark:text-cream-100">
            {item.name}
          </span>
          <span className="text-[10px] text-ink-700/50 dark:text-cream-100/50">
            {item.view}
          </span>
        </div>
      ))}
    </div>
  );
}

const UNIQUE_POINTS = [
  {
    Icon: Sparkles,
    title: "AI 코스 추천",
    desc: "분위기랑 인원 알려주면 그날 가기 좋은 코스 만들어 줘요.",
  },
  {
    Icon: Users,
    title: "친구랑 같이 짜기",
    desc: "링크 보내서 같이 갈 친구랑 가고 싶은 곳 골라요.",
  },
  {
    Icon: Stamp,
    title: "스탬프 패스포트",
    desc: "다녀온 팝업에 도장 찍으면 나만의 기록이 쌓여요.",
  },
  {
    Icon: Zap,
    title: "혼잡도 정보",
    desc: "줄이 얼마나 긴지 가기 전에 확인하고 출발해요.",
  },
];

// 배경 영상 + 모션 토글 상태 localStorage 키 — prefers-reduced-motion OS 설정과 별개로 사용자가 직접 끌 수 있게.
const MOTION_PREF_KEY = "popspot:intro:motion";

export default function IntroPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // 모션 ON/OFF — 기본 ON, 사용자가 끄면 localStorage 에 저장돼 다음 방문에도 유지.
  const [motionOn, setMotionOn] = useState(true);

  // SSR 시점엔 테마 미정. mount 후에만 실제 테마 반영해서 hydration mismatch 회피.
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  useEffect(() => {
    try {
      setIsLoggedIn(!!localStorage.getItem("user"));
      const saved = localStorage.getItem(MOTION_PREF_KEY);
      if (saved === "off") setMotionOn(false);
    } catch {
      setIsLoggedIn(false);
    }
  }, []);

  const toggleMotion = () => {
    setMotionOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MOTION_PREF_KEY, next ? "on" : "off");
      } catch {
        /* localStorage 비활성 환경 — 무시 */
      }
      return next;
    });
  };

  const proceed = () => {
    if (isLoggedIn) {
      router.push("/?entered=1");
    } else {
      router.push("/login");
    }
  };

  // Enter 키로도 진입할 수 있게 글로벌 키 핸들러 등록.
  // proceed 를 deps 에 안 넣고 안에 인라인한 이유: proceed 는 매 렌더마다 새 함수라
  // deps 로 넣으면 이벤트 리스너가 매 렌더마다 다시 붙는다. router/isLoggedIn 만 보면 충분.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (isLoggedIn) {
        router.push("/?entered=1");
      } else {
        router.push("/login");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isLoggedIn, router]);

  return (
    <>
      {/* 페이지 전체 고정 배경 — 다크일 땐 영상, 라이트일 땐 파스텔 blob.
          중요: video 는 display:none → block 토글로 autoplay 가 안 살아나니, isDark 일 때만 fresh mount.
          mounted 가드를 두는 이유는 SSR 시점엔 테마 미확정이라 hydration mismatch 회피용. */}
      <div className="pointer-events-none fixed inset-0 z-0">
        {mounted && isDark && motionOn && (
          <video
            key="intro-bg-video"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            onCanPlay={() => setVideoReady(true)}
            className="h-full w-full object-cover bg-ink-900"
          >
            <source src={VIDEO_SRC} type="video/mp4" />
          </video>
        )}
        {mounted && isDark && !motionOn && (
          <div className="h-full w-full bg-gradient-to-br from-ink-900 via-ink-800 to-hot-900/30" />
        )}
        {(!mounted || !isDark) && <LightModeBackground />}
      </div>

      {/* 상단 고정 컨트롤 — 테마 토글 + 모션 토글 + Skip/Login.
          기본 클래스 = 라이트 모드, dark: 프리픽스 = 다크 모드 (next-themes 의 .dark 클래스 토글 기반). */}
      <div className="fixed right-5 top-5 z-[100] flex items-center gap-2 sm:right-6 sm:top-6">
        <button
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label={isDark ? "라이트 모드" : "다크 모드"}
          title={isDark ? "라이트 모드" : "다크 모드"}
          className="inline-flex size-9 items-center justify-center rounded-full bg-ink-900/10 text-ink-900 ring-1 ring-ink-900/20 backdrop-blur-md transition hover:bg-ink-900/20 active:scale-95 dark:bg-white/15 dark:text-cream-100 dark:ring-white/25 dark:hover:bg-white/25"
        >
          {mounted ? (isDark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />) : null}
        </button>
        <button
          type="button"
          onClick={toggleMotion}
          aria-label={motionOn ? "배경 영상 끄기" : "배경 영상 켜기"}
          title={motionOn ? "배경 영상 끄기" : "배경 영상 켜기"}
          className="inline-flex size-9 items-center justify-center rounded-full bg-ink-900/10 text-ink-900 ring-1 ring-ink-900/20 backdrop-blur-md transition hover:bg-ink-900/20 active:scale-95 dark:bg-white/15 dark:text-cream-100 dark:ring-white/25 dark:hover:bg-white/25"
        >
          {motionOn ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
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

      {/* =================================================================== */}
      {/* 스냅 스크롤 컨테이너                                                    */}
      {/* =================================================================== */}
      <div
        className="relative z-10 h-screen w-full overflow-y-scroll text-cream-100"
        style={{
          scrollSnapType: "y mandatory",
          scrollBehavior: "smooth",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* =================================================================== */}
        {/* SECTION 1 — Hero (오버레이 가장 옅음, 영상 가장 잘 보임)                */}
        {/* =================================================================== */}
        <section
          className="relative flex min-h-screen w-full items-center justify-center overflow-hidden"
          style={{ scrollSnapAlign: "start" }}
        >
          {/* 다크 모드용 그라데이션 오버레이 — 영상이 비치되 텍스트 가독성은 확보. 이전 60% → 30% 로 낮춤. */}
          <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-b from-black/20 via-black/10 to-black/30 dark:block" />

          {/* 좌측 거대 outline 영문 — DU 70주년 스타일. 다크/라이트 양쪽 모두 노출, stroke 색만 분기. */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="pointer-events-none absolute left-[-2vw] top-[10%] hidden select-none sm:block"
            aria-hidden
          >
            <span
              className="block text-[14vw] font-black leading-none tracking-tighter text-transparent dark:[-webkit-text-stroke:1.5px_rgba(255,255,255,0.18)]"
              style={{ WebkitTextStroke: "1.5px rgba(30,30,30,0.15)" }}
            >
              POP
            </span>
          </motion.div>

          {/* 우측 거대 outline 영문 */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="pointer-events-none absolute right-[-2vw] bottom-[12%] hidden select-none sm:block"
            aria-hidden
          >
            <span
              className="block text-[14vw] font-black leading-none tracking-tighter text-transparent dark:[-webkit-text-stroke:1.5px_rgba(255,255,255,0.18)]"
              style={{ WebkitTextStroke: "1.5px rgba(30,30,30,0.15)" }}
            >
              SPOT
            </span>
          </motion.div>

          {/* 폴라로이드 카드 콜라주 — 실제 팝업 브랜드 미니 프리뷰. 양쪽 모드 모두 노출. */}
          <div className="pointer-events-none absolute inset-0 hidden sm:block">
            {HERO_POLAROIDS.map((card, idx) => (
              <motion.div
                key={card.name}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 + idx * 0.15 }}
                className={`absolute ${card.position} ${card.rotate} w-32 rounded-md bg-white p-2 shadow-xl shadow-ink-900/15 ring-1 ring-ink-900/10 dark:bg-ink-800 dark:shadow-black/40 dark:ring-white/15 md:w-40`}
              >
                <div className={`aspect-[4/5] rounded-sm bg-gradient-to-br ${card.gradient}`} />
                <div className="mt-2 px-1 pb-1">
                  <div className="text-[11px] font-bold text-ink-900 dark:text-cream-100 md:text-xs">
                    {card.name}
                  </div>
                  <div className="mt-0.5 text-[9px] text-ink-700/60 dark:text-cream-100/55 md:text-[10px]">
                    {card.location}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* 중앙 컨텐츠 — 컬러 pill + 거대 한글 슬로건 + CTA */}
          <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 py-12 text-center">
            {/* DU 70주년 컬러 pill 스타일 — 위치/지역 강조 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-5 py-2 text-sm font-medium text-cream-100 shadow-lg dark:bg-lime-300 dark:text-ink-900"
            >
              <span className="size-1.5 rounded-full bg-lime-300 dark:bg-ink-900" />
              성수 · 한남 · 압구정
            </motion.div>

            {/* 거대 브랜드 메인 — 프로젝트 이름을 영문 그대로 노출 */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="mt-6 text-6xl font-black leading-[1] tracking-tighter text-ink-900 drop-shadow-md dark:text-white dark:drop-shadow-2xl sm:text-8xl md:text-9xl"
            >
              POP<span className="text-hot-500 dark:text-hot-400">·</span>SPOT
            </motion.h1>

            {/* 영문 부제 — Greencar 의 'Create a Better Life' 스타일 */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="mt-5 font-serif text-base italic text-ink-700/70 dark:text-cream-100/70 sm:text-lg"
            >
              Seoul Popup Store Platform
            </motion.p>

            {/* 한 줄 소개 — 마케팅 톤 줄이고 사실 그대로 */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.9 }}
              className="mt-6 max-w-md text-sm leading-relaxed text-ink-700/80 dark:text-cream-100/80 sm:text-base"
            >
              성수·한남·압구정에서 열리는 팝업을 한 곳에 모아 검색·매칭·기록까지
              제공하는 서울 팝업스토어 플랫폼입니다.
            </motion.p>

            {/* CTA 버튼 그룹 */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.1 }}
              className="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:gap-4"
            >
              <button
                onClick={proceed}
                className="group inline-flex items-center gap-2 rounded-full bg-ink-900 px-8 py-3.5 text-sm font-bold text-cream-100 shadow-lg shadow-ink-900/20 transition hover:scale-[1.03] hover:bg-ink-800 active:scale-[0.98] dark:bg-lime-300 dark:text-ink-900 dark:shadow-lime-300/30 dark:hover:bg-lime-200 sm:text-base"
                aria-label={isLoggedIn ? "메인 페이지로 이동" : "로그인 페이지로 이동"}
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

          {/* 스크롤 인디케이터 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 2.4 }}
            className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="flex flex-col items-center gap-1 text-ink-700/70 dark:text-cream-200/70"
            >
              <span className="text-xs">스크롤</span>
              <ChevronDown className="h-5 w-5" />
            </motion.div>
          </motion.div>
        </section>

        {/* =================================================================== */}
        {/* SECTION 2 — Why POP-SPOT (라임 후광 + 어두운 오버레이)                  */}
        {/* =================================================================== */}
        <section
          className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6"
          style={{ scrollSnapAlign: "start" }}
        >
          {/* 배경 — 라임 후광이 보이도록 어둡지만 영상은 비치게 */}
          <div className="pointer-events-none absolute inset-0 bg-cream-100/65 dark:bg-ink-900/40" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-300/15 blur-3xl" />

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
              className="inline-block rounded-full bg-lime-300/15 px-4 py-1.5 text-sm font-medium text-lime-300 ring-1 ring-lime-300/40"
            >
              서비스 소개
            </motion.span>

            <h2 className="mt-6 text-4xl font-black leading-tight tracking-tight text-ink-900 dark:text-white drop-shadow-2xl sm:text-5xl md:text-7xl">
              서울 팝업 정보를
              <br />
              <span className="text-lime-300">한 곳에서</span>
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-base text-ink-700/90 dark:text-cream-100/90 drop-shadow-lg sm:text-lg">
              매일 새로 열리는 서울 팝업스토어 정보를 자동으로 수집하고 정리해
              <br className="hidden sm:inline" />
              한 화면에서 검색·매칭·기록할 수 있도록 만든 서비스입니다.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-12 inline-flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-700/85 dark:text-cream-100/85 sm:text-base"
            >
              <span>매일 새벽 4시에 새 팝업 수집</span>
              <span className="text-ink-700/30 dark:text-cream-100/30">·</span>
              <span>1~2달치 일정 미리보기</span>
              <span className="text-ink-700/30 dark:text-cream-100/30">·</span>
              <span>신고는 24시간 안에</span>
            </motion.div>
          </motion.div>
        </section>

        {/* =================================================================== */}
        {/* SECTION 3 — Core Features (3카드, 글래스모피즘)                          */}
        {/* =================================================================== */}
        <section
          className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 py-16"
          style={{ scrollSnapAlign: "start" }}
        >
          {/* 어두운 오버레이 — 카드 가독성 확보 */}
          <div className="pointer-events-none absolute inset-0 bg-cream-100/70 dark:bg-ink-900/45" />

          <div className="relative z-10 mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.7 }}
              className="text-center"
            >
              <span className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-ink-700/90 dark:text-cream-100/90 ring-1 ring-ink-900/20 dark:ring-white/20">
                주요 기능
              </span>
              <h2 className="mt-5 text-3xl font-black tracking-tight text-ink-900 dark:text-white drop-shadow-2xl sm:text-5xl md:text-6xl">
                <span className="text-hot-500 dark:text-hot-400">3가지</span> 핵심 기능
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm text-ink-700/85 dark:text-cream-100/85 drop-shadow-lg sm:text-base">
                팝업을 찾고, 가고, 기록할 때 가장 자주 쓰는 기능입니다.
              </p>
            </motion.div>

            {/* 3 카드 — 메인 페이지 위젯의 미니 프리뷰. 카드 안에 실제 UI 축소판. */}
            <div className="mt-12 grid grid-cols-1 gap-4 sm:mt-16 sm:grid-cols-3 sm:gap-5">
              {BIG_FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.6, delay: i * 0.15 }}
                  className="rounded-2xl bg-white dark:bg-ink-900/60 p-6 ring-1 ring-ink-900/10 dark:ring-white/10 transition hover:-translate-y-1 hover:ring-ink-900/20 dark:hover:ring-white/20"
                >
                  <div className="flex items-center justify-between">
                    <f.Icon className={`h-7 w-7 ${f.accent}`} strokeWidth={2.2} />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-ink-700/40 dark:text-cream-100/40">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-bold tracking-tight text-ink-900 dark:text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-700/75 dark:text-cream-100/75">{f.desc}</p>
                  {/* 미니 위젯 프리뷰 — 카드 하단에 메인 페이지 UI 축소판 */}
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

        {/* =================================================================== */}
        {/* SECTION 4 — Only on POP-SPOT (보라/핫 후광)                            */}
        {/* =================================================================== */}
        <section
          className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 py-16"
          style={{ scrollSnapAlign: "start" }}
        >
          <div className="absolute inset-0 bg-cream-100/75 dark:bg-ink-900/50" />
          <div className="pointer-events-none absolute -right-20 top-1/4 h-[400px] w-[400px] rounded-full bg-hot-400/12 blur-3xl" />

          <div className="relative z-10 mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.7 }}
              className="text-center"
            >
              <span className="inline-block rounded-full bg-hot-400/15 px-4 py-1.5 text-sm font-medium text-hot-400 ring-1 ring-hot-400/40">
                차별점
              </span>
              <h2 className="mt-5 text-3xl font-black tracking-tight text-ink-900 dark:text-white drop-shadow-2xl sm:text-5xl md:text-6xl">
                다른 곳엔 없는 <span className="text-hot-400">4가지</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm text-ink-700/85 dark:text-cream-100/85 drop-shadow-lg sm:text-base">
                팝업 정보 사이트에서 보기 어려운, POP-SPOT 만의 부가 기능입니다.
              </p>
            </motion.div>

            <div className="mt-12 grid grid-cols-1 gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-5">
              {UNIQUE_POINTS.map((p, i) => (
                <motion.div
                  key={p.title}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.6, delay: i * 0.1 }}
                  className="group relative overflow-hidden rounded-2xl bg-white dark:bg-ink-900/60 p-6 ring-1 ring-ink-900/10 dark:ring-white/10 transition hover:ring-ink-900/20 dark:hover:ring-white/20"
                >
                  {/* 좌측 컬러 액센트 바 — 카드마다 다른 색 */}
                  <div
                    className={`absolute left-0 top-0 h-full w-1 ${
                      ["bg-lime-300", "bg-hot-400", "bg-amber-300", "bg-blue-400"][i % 4]
                    }`}
                  />
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                        ["bg-lime-300/10", "bg-hot-400/10", "bg-amber-300/10", "bg-blue-400/10"][i % 4]
                      }`}
                    >
                      <p.Icon
                        className={`h-6 w-6 ${
                          ["text-lime-600 dark:text-lime-300", "text-hot-500 dark:text-hot-400", "text-amber-600 dark:text-amber-300", "text-blue-500 dark:text-blue-300"][i % 4]
                        }`}
                        strokeWidth={2.2}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-ink-900 dark:text-white">{p.title}</h3>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-ink-700/40 dark:text-cream-100/40">
                          0{i + 1}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-ink-700/75 dark:text-cream-100/75">{p.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 5 — Final CTA */}
        <section
          className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6"
          style={{ scrollSnapAlign: "start" }}
        >
          <div className="pointer-events-none absolute inset-0 bg-hot-500/55" />
          <div
            className="pointer-events-none absolute inset-0 opacity-15"
            style={{
              backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.4 }}
            transition={{ duration: 0.8 }}
            className="relative z-10 mx-auto max-w-3xl text-center text-white"
          >
            <Clock className="mx-auto h-12 w-12 text-white/95 drop-shadow-lg" strokeWidth={1.8} />
            <h2 className="mt-6 text-4xl font-black leading-tight tracking-tight drop-shadow-2xl sm:text-6xl md:text-7xl">
              POP-SPOT 시작하기
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base text-white/95 drop-shadow-lg sm:text-lg">
              서울에서 열리는 팝업스토어, 한 곳에서 만나보세요.
              <br className="hidden sm:inline" />
              로그인 후 모든 기능을 이용할 수 있습니다.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <motion.button
                onClick={proceed}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 rounded-full bg-white px-9 py-4 text-base font-bold text-hot-500 shadow-2xl shadow-black/30 ring-2 ring-white/40 transition hover:bg-cream-100 sm:px-12 sm:py-5 sm:text-lg"
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
                  className="inline-flex items-center gap-2 rounded-full bg-ink-900/25 px-9 py-4 text-base font-bold text-white backdrop-blur-md ring-2 ring-white/40 transition hover:bg-ink-900/35 sm:px-12 sm:py-5 sm:text-lg"
                >
                  <UserPlus className="h-5 w-5" />
                  <span>회원가입</span>
                </motion.button>
              )}
            </div>
            <p className="mt-8 text-xs text-white/70 drop-shadow-lg">
              © {new Date().getFullYear()} POP-SPOT · 서울 팝업스토어, 한 곳에서.
            </p>
          </motion.div>
        </section>
      </div>
    </>
  );
}
