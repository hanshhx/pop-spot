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
/*    옵션 1) "/14385-256955049.mp4"                                           */
/*    옵션 2) "/215246.mp4"                                                    */
/* -------------------------------------------------------------------------- */
const VIDEO_SRC = "/14385-256955049.mp4";

const FEATURES = [
  { Icon: Calendar, label: "캘린더", sub: "이번 달 일정" },
  { Icon: MapPin,   label: "지도",   sub: "성수·한남·압구정" },
  { Icon: Crown,    label: "랭킹",   sub: "사람들이 보는 곳" },
];

const BIG_FEATURES = [
  {
    Icon: Calendar,
    title: "팝업 캘린더",
    desc: "이번 달, 다음 달 팝업을 한 화면에 펼쳐놨어요. 가고 싶은 거 미리 찜해두면 돼요.",
    accent: "text-lime-300",
  },
  {
    Icon: MapIcon,
    title: "지도",
    desc: "성수·한남·압구정 — 핀 찍힌 곳 클릭하면 길찾기까지 바로 연결돼요.",
    accent: "text-cream-100",
  },
  {
    Icon: Crown,
    title: "랭킹",
    desc: "지금 사람들이 많이 보는 팝업 순위. 뭐가 뜨고 있는지 궁금할 때.",
    accent: "text-hot-400",
  },
];

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
      {/* 페이지 전체 고정 배경 — 다크일 땐 영상 (또는 정적 다크 그라데이션), 라이트일 땐 파스텔 blob. */}
      <div className="pointer-events-none fixed inset-0 z-0">
        {isDark ? (
          motionOn ? (
            <video
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              onCanPlay={() => setVideoReady(true)}
              className={`h-full w-full object-cover bg-ink-900 transition-opacity duration-700 ${
                videoReady ? "opacity-100" : "opacity-0"
              }`}
            >
              <source src={VIDEO_SRC} type="video/mp4" />
            </video>
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-ink-900 via-ink-800 to-hot-900/30" />
          )
        ) : (
          <LightModeBackground />
        )}
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
          {/* Hero 전용 그라데이션 (투명 → 어두움) — 클릭 흡수 차단 */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60" />

          <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 py-12 text-center">
            <motion.div
              initial={{ opacity: 0, y: -24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="mb-3"
            >
              <h1 className="text-5xl font-black tracking-tight text-ink-900 dark:text-white sm:text-7xl md:text-8xl">
                POP<span className="text-lime-300">·</span>SPOT
              </h1>
              <p className="mt-2 text-sm text-ink-700/80 dark:text-cream-200/80 sm:text-base">
                서울 팝업스토어, 한 곳에서.
              </p>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mt-6 text-xl font-semibold text-ink-900 dark:text-white sm:text-2xl md:text-3xl"
            >
              서울 팝업, <span className="text-hot-400">여기서 찾아요</span>
            </motion.h2>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.2 }}
              className="mt-5 max-w-xl space-y-1 text-sm text-ink-700/85 dark:text-cream-100/85 sm:text-base"
            >
              <p>성수에서 한남, 압구정까지 — 흩어진 팝업 정보를 모아뒀어요.</p>
              <p>줄 길이 보고 가고, 친구랑 코스 짜고, 다녀온 곳은 도장으로 남기고.</p>
            </motion.div>

            <motion.div
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.12, delayChildren: 0.8 } },
              }}
              className="mt-10 grid grid-cols-3 gap-4 sm:gap-8"
            >
              {FEATURES.map(({ Icon, label, sub }) => (
                <motion.div
                  key={label}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.6 } },
                  }}
                  className="flex flex-col items-center"
                >
                  <Icon className="h-7 w-7 text-lime-300 sm:h-8 sm:w-8" strokeWidth={2} />
                  <div className="mt-2 text-sm font-semibold text-ink-900 dark:text-white sm:text-base">{label}</div>
                  <div className="mt-0.5 text-[11px] text-ink-700/70 dark:text-cream-200/70 sm:text-xs">{sub}</div>
                </motion.div>
              ))}
            </motion.div>

            <motion.button
              onClick={proceed}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 1.6 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="group mt-16 inline-flex items-center gap-3 rounded-full bg-lime-300 px-9 py-4 text-base font-bold text-ink-900 shadow-2xl shadow-lime-300/30 ring-2 ring-ink-900/20 dark:ring-white/20 transition hover:bg-lime-200 hover:shadow-lime-300/50 sm:mt-20 sm:px-12 sm:py-5 sm:text-lg"
              aria-label={isLoggedIn ? "POP-SPOT 메인 페이지로 이동" : "로그인 페이지로 이동"}
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
            </motion.button>

            {!isLoggedIn && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 2.0 }}
                className="mt-5 text-sm text-ink-700/80 dark:text-cream-100/80"
              >
                처음 오셨나요?{" "}
                <button
                  onClick={() => router.push("/signup")}
                  className="font-semibold text-lime-300 underline-offset-4 transition hover:underline"
                >
                  회원가입
                </button>
              </motion.p>
            )}
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
          <div className="pointer-events-none absolute inset-0 bg-cream-100/65 dark:bg-ink-900/65 backdrop-blur-[2px]" />
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
              왜 만들었냐면요
            </motion.span>

            <h2 className="mt-6 text-4xl font-black leading-tight tracking-tight text-ink-900 dark:text-white drop-shadow-2xl sm:text-5xl md:text-7xl">
              팝업 정보,
              <br />
              <span className="text-lime-300">한 군데서</span> 끝내자.
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-base text-ink-700/90 dark:text-cream-100/90 drop-shadow-lg sm:text-lg">
              팝업 정보 찾겠다고 인스타 계정 30개 팔로우 안 해도 돼요.
              <br className="hidden sm:inline" />
              매일 열리는 서울 팝업, 여기 하나만 보면 충분해요.
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
          <div className="pointer-events-none absolute inset-0 bg-cream-100/70 dark:bg-ink-900/70 backdrop-blur-[2px]" />

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
                주로 이렇게들 <span className="text-hot-400">써요</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm text-ink-700/85 dark:text-cream-100/85 drop-shadow-lg sm:text-base">
                찾고, 가고, 기록하기 — 세 가지면 충분하더라고요.
              </p>
            </motion.div>

            {/* Bento 레이아웃 — 첫 번째 카드가 가로로 길게, 나머지 둘이 옆에 작게. 모든 카드 동일 크기를 깨서 AI 티 ↓ */}
            <div className="mt-12 grid grid-cols-1 gap-4 sm:mt-16 sm:grid-cols-3 sm:gap-5">
              {BIG_FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.6, delay: i * 0.15 }}
                  className={`rounded-2xl bg-white dark:bg-ink-900/85 p-6 ring-1 ring-ink-900/10 dark:ring-white/10 transition hover:-translate-y-1 hover:ring-ink-900/20 dark:ring-white/20 ${
                    i === 0 ? "sm:col-span-2 sm:p-8" : ""
                  }`}
                >
                  <f.Icon className={`h-7 w-7 ${f.accent}`} strokeWidth={2.2} />
                  <h3 className="mt-5 text-xl font-bold tracking-tight text-ink-900 dark:text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-700/75 dark:text-cream-100/75">{f.desc}</p>
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
          <div className="absolute inset-0 bg-cream-100/75 dark:bg-ink-900/75" />
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
                여기에만 있는 것
              </span>
              <h2 className="mt-5 text-3xl font-black tracking-tight text-ink-900 dark:text-white drop-shadow-2xl sm:text-5xl md:text-6xl">
                이건 <span className="text-hot-400">여기에만</span> 있어요
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm text-ink-700/85 dark:text-cream-100/85 drop-shadow-lg sm:text-base">
                직접 다녀보면서 "이건 좀 있었으면" 했던 것들.
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
                  className="flex gap-4 rounded-2xl bg-white dark:bg-ink-900/85 p-6 ring-1 ring-ink-900/10 dark:ring-white/10 transition hover:ring-ink-900/20 dark:ring-white/20"
                >
                  <p.Icon className="h-7 w-7 shrink-0 text-hot-400" strokeWidth={2.2} />
                  <div>
                    <h3 className="text-lg font-bold text-ink-900 dark:text-white">{p.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-700/75 dark:text-cream-100/75">{p.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* SECTION 5 — Final CTA (핫핑크 틴트, 영상은 살짝 비치게)                 */}
        {/* =================================================================== */}
        <section
          className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6"
          style={{ scrollSnapAlign: "start" }}
        >
          {/* 핫핑크 틴트 오버레이 — 영상이 약간 비치도록 */}
          <div className="pointer-events-none absolute inset-0 bg-hot-500/75 backdrop-blur-[1px]" />
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
            className="relative z-10 mx-auto max-w-3xl text-center text-ink-900 dark:text-white"
          >
            <Clock className="mx-auto h-12 w-12 text-ink-900 dark:text-white/95 drop-shadow-lg" strokeWidth={1.8} />

            <h2 className="mt-6 text-4xl font-black leading-tight tracking-tight drop-shadow-2xl sm:text-6xl md:text-7xl">
              한번 둘러볼래요?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base text-ink-700 dark:text-white/95 drop-shadow-lg sm:text-lg">
              지금 이 순간에도 서울 어딘가에서 팝업이 열리고 있어요.
              <br className="hidden sm:inline" />
              먼저 와본 사람한테 들켜도 모르는 척, 슬쩍 들어와요.
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
                  {/* 아이콘-텍스트 순서를 로그인 버튼과 통일. */}
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
