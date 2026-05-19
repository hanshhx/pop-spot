"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import {
  Calendar,
  Crown,
  ArrowRight,
  LogIn,
  UserPlus,
  Sparkles,
  Users,
  Stamp,
  Zap,
  Map as MapIcon,
  Sun,
  Moon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useGuestMode } from "@/lib/useGuestMode";

/* ============================================================================ */
/*  POP-SPOT — Intro Cinema Page                                                */
/*                                                                              */
/*  첫 방문 사용자에게 영상처럼 흘러가는 5단계 시네마 시퀀스를 보여주고 자동으로     */
/*  메인 페이지로 진입시킨다. 재방문자는 인트로 자체를 거치지 않고 즉시 메인.       */
/* ============================================================================ */

const INTRO_PLAYED_KEY = "popspot:intro:played";

/** 각 슬라이드 노출 시간 (ms). 합계 약 12초. */
const PHASE_TIMINGS = {
  logo: 2200,
  tagline: 2500,
  core: 2600,
  unique: 2600,
  cta: 3000,
} as const;

type Phase = keyof typeof PHASE_TIMINGS;
const PHASE_ORDER: Phase[] = ["logo", "tagline", "core", "unique", "cta"];

const PUBLICATION_YEAR = 2026;

/* ────────── 페이지 단위 배경 (라이트/다크) ────────── */

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

function DarkPageBackground() {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: "linear-gradient(135deg, #1a1820 0%, #221e2a 50%, #1a1820 100%)" }}
    >
      <div className="pointer-events-none absolute right-[-10%] top-[5%] h-[520px] w-[520px] rounded-full bg-hot-500/30 blur-3xl" />
      <div className="pointer-events-none absolute left-[-10%] top-[15%] h-[480px] w-[480px] rounded-full bg-lime-500/22 blur-3xl" />
      <div className="pointer-events-none absolute left-[35%] top-[45%] h-[420px] w-[420px] rounded-full bg-amber-400/22 blur-3xl" />
      <div className="pointer-events-none absolute right-[20%] top-[60%] h-[460px] w-[460px] rounded-full bg-blue-500/25 blur-3xl" />
      <div className="pointer-events-none absolute left-[5%] bottom-[10%] h-[400px] w-[400px] rounded-full bg-violet-500/22 blur-3xl" />
      <div className="pointer-events-none absolute right-[-5%] bottom-[5%] h-[440px] w-[440px] rounded-full bg-rose-500/25 blur-3xl" />
    </div>
  );
}

/** 부유하는 dust 파티클 — 정적인 시퀀스에 미세한 살아있음. */
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

/* ────────── 슬라이드 페이드 공통 props (한 곳에서 관리) ────────── */

const SLIDE_TRANSITION = {
  duration: 0.7,
  ease: "easeOut" as const,
};
const SLIDE_INITIAL = { opacity: 0, y: 30 };
const SLIDE_ANIMATE = { opacity: 1, y: 0 };
const SLIDE_EXIT = { opacity: 0, y: -30, transition: { duration: 0.4 } };

/* ────────── Phase 1: Logo ────────── */

function PhaseLogo() {
  return (
    <motion.div
      initial={SLIDE_INITIAL}
      animate={SLIDE_ANIMATE}
      exit={SLIDE_EXIT}
      transition={SLIDE_TRANSITION}
      className="flex flex-col items-center text-center"
    >
      <motion.span
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-5 py-2 text-sm font-medium text-cream-100 shadow-lg dark:bg-lime-300 dark:text-ink-900"
      >
        <span className="size-1.5 rounded-full bg-lime-300 dark:bg-ink-900" />
        성수 · 한남 · 압구정
      </motion.span>

      <motion.h1
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.35, duration: 0.7 }}
        className="mt-6 text-6xl font-black leading-[1] tracking-tighter text-ink-900 drop-shadow-md dark:text-white dark:drop-shadow-2xl sm:text-8xl md:text-9xl"
      >
        POP<span className="text-hot-500 dark:text-hot-400">·</span>SPOT
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="mt-5 font-serif text-base italic text-ink-700/70 dark:text-cream-100/70 sm:text-lg"
      >
        Seoul Popup Store Platform
      </motion.p>
    </motion.div>
  );
}

/* ────────── Phase 2: Tagline + Polaroids ────────── */

const TAGLINE_POLAROIDS = [
  { name: "젠틀몬스터", location: "성수동", gradient: "from-hot-400/80 to-hot-300/50", rotate: "-rotate-6" },
  { name: "마뗑킴", location: "한남", gradient: "from-lime-300/80 to-lime-200/40", rotate: "rotate-3" },
  { name: "포켓몬스터", location: "압구정", gradient: "from-amber-300/80 to-hot-300/40", rotate: "-rotate-3" },
  { name: "디스이즈네버댓", location: "성수", gradient: "from-violet-400/70 to-blue-300/50", rotate: "rotate-6" },
];

function PhaseTagline() {
  return (
    <motion.div
      initial={SLIDE_INITIAL}
      animate={SLIDE_ANIMATE}
      exit={SLIDE_EXIT}
      transition={SLIDE_TRANSITION}
      className="flex flex-col items-center text-center"
    >
      <h2 className="text-5xl font-black leading-[1.1] tracking-tight text-ink-900 dark:text-white dark:drop-shadow-2xl sm:text-7xl md:text-8xl">
        서울 팝업,
        <br />
        <span className="text-hot-500 dark:text-hot-400">한 곳에서</span>
      </h2>

      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.4 } } }}
        className="mt-12 flex flex-wrap justify-center gap-4"
      >
        {TAGLINE_POLAROIDS.map((p) => (
          <motion.div
            key={p.name}
            variants={{
              hidden: { opacity: 0, y: 20, rotate: 0 },
              show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
            }}
            className={`${p.rotate} w-24 rounded-md bg-white p-1.5 shadow-xl shadow-ink-900/15 ring-1 ring-ink-900/10 dark:bg-ink-800 dark:shadow-black/40 dark:ring-white/15 sm:w-32`}
          >
            <div className={`aspect-[4/5] rounded-sm bg-gradient-to-br ${p.gradient}`} />
            <div className="mt-1.5 px-1 pb-0.5">
              <div className="text-[10px] font-bold text-ink-900 dark:text-cream-100 sm:text-xs">{p.name}</div>
              <div className="text-[8px] text-ink-700/60 dark:text-cream-100/55 sm:text-[10px]">{p.location}</div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

/* ────────── Phase 3: 3가지 핵심 기능 ────────── */

const CORE_ITEMS = [
  { Icon: Calendar, title: "팝업 캘린더", desc: "이번 달 일정 한눈에" },
  { Icon: MapIcon, title: "지도", desc: "성수·한남·압구정" },
  { Icon: Crown, title: "랭킹", desc: "지금 인기 있는 팝업" },
];

function PhaseCore() {
  return (
    <motion.div
      initial={SLIDE_INITIAL}
      animate={SLIDE_ANIMATE}
      exit={SLIDE_EXIT}
      transition={SLIDE_TRANSITION}
      className="flex w-full max-w-5xl flex-col items-center text-center"
    >
      <span className="inline-block rounded-full bg-white/60 px-4 py-1.5 text-sm font-medium text-ink-700/90 ring-1 ring-ink-900/15 backdrop-blur-sm dark:bg-white/10 dark:text-cream-100/90 dark:ring-white/20">
        주요 기능
      </span>
      <h2 className="mt-5 text-3xl font-black tracking-tight text-ink-900 dark:text-white dark:drop-shadow-2xl sm:text-5xl md:text-6xl">
        <span className="text-hot-500 dark:text-hot-400">3가지</span> 핵심 기능
      </h2>

      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.15, delayChildren: 0.3 } } }}
        className="mt-10 grid w-full grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5"
      >
        {CORE_ITEMS.map((item, i) => (
          <motion.div
            key={item.title}
            variants={{
              hidden: { opacity: 0, y: 30 },
              show: { opacity: 1, y: 0, transition: { duration: 0.55 } },
            }}
            className="rounded-2xl bg-white p-6 text-left ring-1 ring-ink-900/10 dark:bg-ink-900/60 dark:ring-white/10"
          >
            <div className="flex items-center justify-between">
              <item.Icon className="h-7 w-7 text-hot-500 dark:text-hot-400" strokeWidth={2.2} />
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-700/40 dark:text-cream-100/40">
                0{i + 1}
              </span>
            </div>
            <h3 className="mt-4 text-lg font-bold text-ink-900 dark:text-white">{item.title}</h3>
            <p className="mt-1 text-sm text-ink-700/75 dark:text-cream-100/75">{item.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

/* ────────── Phase 4: 다른 곳엔 없는 4가지 ────────── */

const UNIQUE_ITEMS = [
  { Icon: Sparkles, title: "AI 코스 추천", color: "lime" },
  { Icon: Users, title: "친구랑 같이 짜기", color: "hot" },
  { Icon: Stamp, title: "스탬프 패스포트", color: "amber" },
  { Icon: Zap, title: "혼잡도 정보", color: "blue" },
] as const;

const UNIQUE_BAR: Record<string, string> = {
  lime: "bg-lime-400",
  hot: "bg-hot-400",
  amber: "bg-amber-400",
  blue: "bg-blue-400",
};
const UNIQUE_ICON: Record<string, string> = {
  lime: "text-lime-600 dark:text-lime-300",
  hot: "text-hot-500 dark:text-hot-400",
  amber: "text-amber-600 dark:text-amber-300",
  blue: "text-blue-500 dark:text-blue-300",
};
const UNIQUE_ICON_BG: Record<string, string> = {
  lime: "bg-lime-300/10",
  hot: "bg-hot-400/10",
  amber: "bg-amber-300/10",
  blue: "bg-blue-400/10",
};

function PhaseUnique() {
  return (
    <motion.div
      initial={SLIDE_INITIAL}
      animate={SLIDE_ANIMATE}
      exit={SLIDE_EXIT}
      transition={SLIDE_TRANSITION}
      className="flex w-full max-w-4xl flex-col items-center text-center"
    >
      <span className="inline-block rounded-full bg-hot-400/15 px-4 py-1.5 text-sm font-medium text-hot-500 ring-1 ring-hot-400/40 dark:text-hot-400">
        차별점
      </span>
      <h2 className="mt-5 text-3xl font-black tracking-tight text-ink-900 dark:text-white dark:drop-shadow-2xl sm:text-5xl md:text-6xl">
        다른 곳엔 없는 <span className="text-hot-500 dark:text-hot-400">4가지</span>
      </h2>

      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.3 } } }}
        className="mt-10 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5"
      >
        {UNIQUE_ITEMS.map((item, i) => (
          <motion.div
            key={item.title}
            variants={{
              hidden: { opacity: 0, x: i % 2 === 0 ? -24 : 24 },
              show: { opacity: 1, x: 0, transition: { duration: 0.55 } },
            }}
            className="relative overflow-hidden rounded-2xl bg-white p-5 text-left ring-1 ring-ink-900/10 dark:bg-ink-900/60 dark:ring-white/10"
          >
            <div className={`absolute left-0 top-0 h-full w-1 ${UNIQUE_BAR[item.color]}`} />
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${UNIQUE_ICON_BG[item.color]}`}>
                <item.Icon className={`h-5 w-5 ${UNIQUE_ICON[item.color]}`} strokeWidth={2.2} />
              </div>
              <h3 className="text-base font-bold text-ink-900 dark:text-white sm:text-lg">{item.title}</h3>
              <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-ink-700/40 dark:text-cream-100/40">
                0{i + 1}
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

/* ────────── Phase 5: CTA ────────── */

interface PhaseCtaProps {
  isLoggedIn: boolean;
  onPrimary: () => void;
  onSignup: () => void;
}

function PhaseCta({ isLoggedIn, onPrimary, onSignup }: PhaseCtaProps) {
  return (
    <motion.div
      initial={SLIDE_INITIAL}
      animate={SLIDE_ANIMATE}
      exit={SLIDE_EXIT}
      transition={SLIDE_TRANSITION}
      className="flex flex-col items-center text-center"
    >
      <h2 className="text-5xl font-black leading-tight tracking-tight text-ink-900 dark:text-white dark:drop-shadow-2xl sm:text-7xl md:text-8xl">
        POP-SPOT
        <br />
        <span className="text-hot-500 dark:text-hot-400">시작하기</span>
      </h2>

      <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-ink-700/80 dark:text-cream-100/80 sm:text-base">
        서울에서 열리는 팝업스토어, 한 곳에서 만나보세요.
      </p>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:gap-4"
      >
        <button
          onClick={onPrimary}
          className="group inline-flex items-center gap-2 rounded-full bg-ink-900 px-9 py-4 text-base font-bold text-cream-100 shadow-xl shadow-ink-900/20 transition hover:scale-[1.03] hover:bg-ink-800 active:scale-[0.98] dark:bg-lime-300 dark:text-ink-900 dark:shadow-lime-300/30 dark:hover:bg-lime-200 sm:text-lg"
        >
          {isLoggedIn ? (
            <>
              <span>들어가기</span>
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </>
          ) : (
            <>
              <LogIn className="h-5 w-5" />
              <span>로그인</span>
            </>
          )}
        </button>
        {!isLoggedIn && (
          <button
            onClick={onSignup}
            className="inline-flex items-center gap-2 rounded-full border-2 border-ink-900/15 bg-transparent px-9 py-4 text-base font-bold text-ink-900 transition hover:scale-[1.03] hover:border-ink-900/30 hover:bg-ink-900/5 active:scale-[0.98] dark:border-white/25 dark:text-cream-100 dark:hover:border-white/50 dark:hover:bg-white/10 sm:text-lg"
          >
            <UserPlus className="h-5 w-5" />
            <span>회원가입</span>
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ────────── 슬라이드 진행 바 (하단 고정) ────────── */

interface ProgressBarProps {
  currentIdx: number;
  total: number;
}

function ProgressBar({ currentIdx, total }: ProgressBarProps) {
  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 gap-2"
      aria-hidden
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1 rounded-full transition-all duration-500 ${
            i === currentIdx
              ? "w-10 bg-hot-500 dark:bg-hot-400"
              : i < currentIdx
              ? "w-5 bg-ink-900/40 dark:bg-cream-100/40"
              : "w-5 bg-ink-900/15 dark:bg-cream-100/15"
          }`}
        />
      ))}
    </div>
  );
}

/* ────────── 메인 IntroPage ────────── */

export default function IntroPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  useEffect(() => {
    try {
      setIsLoggedIn(!!localStorage.getItem("user"));
    } catch {
      setIsLoggedIn(false);
    }
  }, []);

  const { mounted: guestReady, expired } = useGuestMode(isLoggedIn);

  /** 사용자 상황에 따라 다음 라우트 결정 — 자동 진입 / Skip / CTA 모두 공유. */
  const resolveNextRoute = (): string => {
    if (isLoggedIn) return "/?entered=1";
    if (guestReady && expired) return "/signup";
    return "/?entered=1";
  };

  /** 재방문자 / 로그인 사용자는 인트로 건너뛰고 즉시 메인. */
  useEffect(() => {
    if (!mounted) return;
    let alreadyPlayed = false;
    try {
      alreadyPlayed = window.localStorage.getItem(INTRO_PLAYED_KEY) === "true";
    } catch {
      /* localStorage 비활성 */
    }
    if (alreadyPlayed || isLoggedIn) {
      setRedirecting(true);
      router.replace(resolveNextRoute());
    } else {
      try {
        window.localStorage.setItem(INTRO_PLAYED_KEY, "true");
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolveNextRoute 는 매 렌더 새 함수.
  }, [mounted, isLoggedIn, router]);

  /** 5단계 자동 전환 — 각 슬라이드 노출 시간이 끝나면 다음으로. 마지막 단계 후 메인 진입. */
  useEffect(() => {
    if (!mounted || redirecting) return;
    if (phaseIdx >= PHASE_ORDER.length) {
      router.push(resolveNextRoute());
      return;
    }
    const phase = PHASE_ORDER[phaseIdx];
    const timer = window.setTimeout(() => setPhaseIdx((idx) => idx + 1), PHASE_TIMINGS[phase]);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, phaseIdx, redirecting, router]);

  const currentPhase = PHASE_ORDER[phaseIdx];

  const handleSkip = () => router.push(resolveNextRoute());
  const handleSignup = () => router.push("/signup");

  return (
    <>
      {/* 페이지 단위 배경 */}
      <div className="pointer-events-none fixed inset-0 z-0">
        {(!mounted || !isDark) ? <LightPageBackground /> : <DarkPageBackground />}
      </div>
      <DustParticles />

      {/* 상단 컨트롤 — 테마 토글 + Skip */}
      <div className="fixed right-5 top-5 z-[100] flex items-center gap-2 sm:right-6 sm:top-6">
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
          onClick={handleSkip}
          className="rounded-full bg-ink-900/10 px-4 py-2 text-xs font-semibold text-ink-900 ring-1 ring-ink-900/20 backdrop-blur-md transition hover:bg-ink-900/20 active:scale-95 dark:bg-white/15 dark:text-cream-100 dark:ring-white/25 dark:hover:bg-white/25"
          aria-label="인트로 건너뛰기"
        >
          {isLoggedIn ? "Skip →" : "건너뛰기 →"}
        </button>
      </div>

      {/* 5단계 슬라이드 영역 — AnimatePresence 로 한 화면에서 페이드 전환 */}
      <main className="relative z-10 flex min-h-screen w-full items-center justify-center px-6 py-12">
        <AnimatePresence mode="wait">
          {currentPhase === "logo" && <PhaseLogo key="logo" />}
          {currentPhase === "tagline" && <PhaseTagline key="tagline" />}
          {currentPhase === "core" && <PhaseCore key="core" />}
          {currentPhase === "unique" && <PhaseUnique key="unique" />}
          {currentPhase === "cta" && (
            <PhaseCta
              key="cta"
              isLoggedIn={isLoggedIn}
              onPrimary={handleSkip}
              onSignup={handleSignup}
            />
          )}
        </AnimatePresence>
      </main>

      {/* 슬라이드 도트 진행 표시 */}
      <ProgressBar currentIdx={phaseIdx} total={PHASE_ORDER.length} />

      {/* 발행 메타 — 좌하단 작은 글씨 */}
      <span className="pointer-events-none fixed bottom-6 left-6 z-[50] hidden font-mono text-[10px] uppercase tracking-widest text-ink-700/40 dark:text-cream-100/35 sm:block">
        © {PUBLICATION_YEAR} POP-SPOT
      </span>
    </>
  );
}
