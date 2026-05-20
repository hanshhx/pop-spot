"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Calendar,
  MapPin,
  Crown,
  ArrowRight,
  LogIn,
  ChevronDown,
  Sparkles,
  Users,
  Stamp,
  Zap,
  Map as MapIcon,
  Video,
  VideoOff,
  Sun,
  Moon,
  Clock,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useGuestMode } from "@/lib/useGuestMode";

/* ============================================================================
 *  POP-SPOT — Cover / Intro Page  (v2.4)
 *
 *  · 기본: 영상 OFF (성능 우선). 파스텔 폴백 + 거대 POP-SPOT 워터마크.
 *  · 우측 상단 토글로 영상 ON 가능. localStorage 에 사용자 선호 저장.
 *  · 라이트/다크 모드 모두에서 폴백 디자인 지원 — 다크는 완전 검정이 아닌
 *    웜 그레이-퍼플 톤. 두 모드 모두 같은 파스텔 orb 6개 노출.
 *  · 영상 모드일 때는 영상이 fixed 배경, 콘텐츠는 위에 떠 있음.
 * ========================================================================== */

const VIDEO_SRC = "/14385-256955049.mp4";
const VIDEO_PREF_KEY = "popspot:intro:video"; // "on" | "off"

/* ────────── 콘텐츠 데이터 (디자인이 바뀌어도 카피는 그대로) ────────── */

const FEATURES = [
  { Icon: Calendar, label: "캘린더", sub: "이번 달 팝업 한눈에" },
  { Icon: MapPin, label: "지도", sub: "성수 · 한남 · 압구정" },
  { Icon: Crown, label: "랭킹", sub: "지금 핫한 팝업 TOP" },
];

const BIG_FEATURES = [
  {
    Icon: Calendar,
    title: "한 달 팝업 캘린더",
    desc: "이번 달과 다음 달 팝업을 캘린더에 펼쳐서 보고, 가고 싶은 곳을 미리 체크하세요.",
    accent: "lime",
  },
  {
    Icon: MapIcon,
    title: "위치 기반 지도",
    desc: "성수 · 한남 · 압구정 등 핫스팟을 지도에서 확인. 클릭 한 번에 길찾기까지.",
    accent: "violet",
  },
  {
    Icon: Crown,
    title: "실시간 랭킹",
    desc: "지금 가장 인기 있는 팝업 TOP 10. 트렌드를 놓치지 않는 가장 빠른 방법.",
    accent: "hot",
  },
] as const;

const UNIQUE_POINTS = [
  {
    Icon: Sparkles,
    title: "AI 코스 추천",
    desc: "오늘 데이트 분위기에 맞춰 AI 가 자동으로 팝업 코스를 짜드려요.",
  },
  {
    Icon: Users,
    title: "친구와 동선 계획",
    desc: "친구를 초대해 같이 가고 싶은 팝업을 정하고, 동선까지 함께 짜요.",
  },
  {
    Icon: Stamp,
    title: "팝업 스탬프 패스포트",
    desc: "다녀온 팝업을 인증하고 도장을 모아 나만의 팝업 패스포트를 완성하세요.",
  },
  {
    Icon: Zap,
    title: "실시간 혼잡도",
    desc: "지금 그 팝업, 줄이 얼마나 길까? 가기 전에 미리 확인하세요.",
  },
];

const ACCENT_TEXT = {
  lime: "text-lime-600 dark:text-lime-300",
  violet: "text-violet-600 dark:text-violet-300",
  hot: "text-hot-500 dark:text-hot-400",
} as const;

const ACCENT_RING = {
  lime: "ring-lime-300/40 dark:ring-lime-400/30",
  violet: "ring-violet-300/40 dark:ring-violet-400/30",
  hot: "ring-hot-300/40 dark:ring-hot-400/30",
} as const;

/* ────────── 배경 컴포넌트 ────────── */

/** 파스텔 폴백 배경 — 라이트/다크 둘 다 동일한 6 orb 레이아웃. */
function PastelBackground({ isDark }: { isDark: boolean }) {
  if (isDark) {
    return (
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1a1820 0%, #221e2a 50%, #1a1820 100%)" }}
      >
        <div className="pointer-events-none absolute right-[-10%] top-[5%] h-[520px] w-[520px] rounded-full bg-hot-500/30 blur-3xl" />
        <div className="pointer-events-none absolute left-[-10%] top-[15%] h-[480px] w-[480px] rounded-full bg-lime-500/22 blur-3xl" />
        <div className="pointer-events-none absolute left-[30%] top-[42%] h-[420px] w-[420px] rounded-full bg-amber-400/22 blur-3xl" />
        <div className="pointer-events-none absolute right-[15%] top-[60%] h-[460px] w-[460px] rounded-full bg-blue-500/25 blur-3xl" />
        <div className="pointer-events-none absolute left-[5%] bottom-[8%] h-[400px] w-[400px] rounded-full bg-violet-500/22 blur-3xl" />
        <div className="pointer-events-none absolute right-[-5%] bottom-[2%] h-[440px] w-[440px] rounded-full bg-rose-500/25 blur-3xl" />
      </div>
    );
  }
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-cream-200 via-cream-100 to-cream-200">
      <div className="pointer-events-none absolute right-[-10%] top-[5%] h-[520px] w-[520px] rounded-full bg-hot-300/55 blur-3xl" />
      <div className="pointer-events-none absolute left-[-10%] top-[15%] h-[480px] w-[480px] rounded-full bg-lime-200/65 blur-3xl" />
      <div className="pointer-events-none absolute left-[30%] top-[42%] h-[420px] w-[420px] rounded-full bg-amber-200/55 blur-3xl" />
      <div className="pointer-events-none absolute right-[15%] top-[60%] h-[460px] w-[460px] rounded-full bg-blue-200/55 blur-3xl" />
      <div className="pointer-events-none absolute left-[5%] bottom-[8%] h-[400px] w-[400px] rounded-full bg-violet-200/45 blur-3xl" />
      <div className="pointer-events-none absolute right-[-5%] bottom-[2%] h-[440px] w-[440px] rounded-full bg-rose-200/55 blur-3xl" />
    </div>
  );
}

/** 거대 POP-SPOT 워터마크 — 화면 가운데에 옅게 깔린다 (영상 OFF 모드 전용). */
function GiantWordmark({ isDark }: { isDark: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[1] flex select-none items-center justify-center overflow-hidden">
      <span
        className="font-display-en font-extrabold tracking-tighter leading-none whitespace-nowrap"
        style={{
          fontSize: "clamp(7rem, 22vw, 26rem)",
          color: isDark ? "rgba(252, 246, 235, 0.06)" : "rgba(26, 24, 32, 0.05)",
        }}
      >
        POP·SPOT
      </span>
    </div>
  );
}

/* ────────── 메인 페이지 ────────── */

export default function IntroPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setIsLoggedIn(!!localStorage.getItem("user"));
      const pref = localStorage.getItem(VIDEO_PREF_KEY);
      setVideoOn(pref === "on"); // 기본은 OFF (성능 우선)
    } catch {
      /* SSR 등 안전 폴백 */
    }
  }, []);

  /* 게스트 7일 카운트다운 — 비로그인 사용자 한정. */
  const { mounted: guestMounted, remainingDays, expired: guestExpired } = useGuestMode(isLoggedIn);

  /* 만료 게스트가 인트로에 머무를 일은 거의 없지만, 들어오면 즉시 가입 페이지로. */
  useEffect(() => {
    if (guestMounted && !isLoggedIn && guestExpired) {
      router.replace("/signup?reason=guest_expired");
    }
  }, [guestMounted, isLoggedIn, guestExpired, router]);

  const isDark = mounted && theme === "dark";

  const toggleVideo = () => {
    setVideoOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(VIDEO_PREF_KEY, next ? "on" : "off");
      } catch {}
      if (!next) setVideoReady(false);
      return next;
    });
  };

  const proceed = () => {
    if (isLoggedIn) router.push("/?entered=1");
    else if (guestExpired) router.push("/signup?reason=guest_expired");
    else router.push("/?entered=1"); // 게스트 7일 이내 — 메인 진입 허용
  };

  /* 영상 ON 일 때 카드/텍스트는 흰색 톤, OFF 일 때는 모드별 톤. */
  const txtPrimary = videoOn ? "text-white" : "text-ink-900 dark:text-cream-100";
  const txtMuted = videoOn ? "text-cream-100/85" : "text-ink-700/75 dark:text-cream-100/75";
  const cardBg = videoOn
    ? "bg-white/10 backdrop-blur-xl ring-1 ring-white/15"
    : "bg-white/75 ring-1 ring-ink-900/8 dark:bg-ink-800/55 dark:ring-white/10";

  return (
    <>
      {/* 페이지 배경 — 영상 ON 일 땐 비디오, OFF 일 땐 파스텔 폴백 */}
      <div className="fixed inset-0 z-0">
        {videoOn ? (
          <div className="absolute inset-0 bg-ink-900">
            <video
              key="intro-bg-video"
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              onCanPlay={() => setVideoReady(true)}
              className={`h-full w-full object-cover transition-opacity duration-700 ${
                videoReady ? "opacity-100" : "opacity-0"
              }`}
            >
              <source src={VIDEO_SRC} type="video/mp4" />
            </video>
          </div>
        ) : (
          <PastelBackground isDark={isDark} />
        )}
      </div>

      {/* 거대 워터마크 — 영상 꺼져있을 때만 */}
      {!videoOn && <GiantWordmark isDark={isDark} />}

      {/* 상단 컨트롤 — 게스트 카운트다운 / 영상 토글 / 테마 토글 / Skip */}
      <div className="fixed right-4 top-4 z-[60] flex items-center gap-2 sm:right-6 sm:top-6">
        {guestMounted && !isLoggedIn && !guestExpired && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-lime-300 px-3 py-1.5 text-[11px] font-bold text-ink-900 ring-1 ring-ink-900/15 shadow-sm dark:bg-lime-400 dark:ring-ink-900/30"
            title="7일 무료 체험 후 회원가입이 필요해요"
            aria-label={`게스트 잔여 ${remainingDays}일`}
          >
            <Clock className="size-3" aria-hidden />
            게스트 D-{remainingDays}
          </span>
        )}
        <IconButton
          onClick={toggleVideo}
          ariaLabel={videoOn ? "배경 영상 끄기" : "배경 영상 켜기"}
          videoOn={videoOn}
        >
          {videoOn ? <VideoOff className="size-4" aria-hidden /> : <Video className="size-4" aria-hidden />}
        </IconButton>
        <IconButton
          onClick={() => setTheme(isDark ? "light" : "dark")}
          ariaLabel={isDark ? "라이트 모드" : "다크 모드"}
          videoOn={videoOn}
        >
          {mounted ? (
            isDark ? (
              <Sun className="size-4" aria-hidden />
            ) : (
              <Moon className="size-4" aria-hidden />
            )
          ) : null}
        </IconButton>
        <button
          onClick={proceed}
          aria-label="인트로 건너뛰기"
          className={
            videoOn
              ? "rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white ring-1 ring-white/25 backdrop-blur-md transition hover:bg-white/25"
              : "rounded-full bg-ink-900/10 px-3.5 py-1.5 text-xs font-semibold text-ink-900 ring-1 ring-ink-900/15 backdrop-blur-md transition hover:bg-ink-900/15 dark:bg-white/15 dark:text-cream-100 dark:ring-white/25 dark:hover:bg-white/25"
          }
        >
          {isLoggedIn ? "Skip →" : "Login →"}
        </button>
      </div>

      {/* 스냅 스크롤 컨테이너 */}
      <div
        className={`relative z-10 h-screen w-full overflow-y-scroll ${videoOn ? "text-cream-100" : "text-ink-900 dark:text-cream-100"}`}
        style={{
          scrollSnapType: "y mandatory",
          scrollBehavior: "smooth",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* ──────────── Section 1 — Hero ──────────── */}
        <section
          className="relative flex min-h-screen w-full items-center justify-center overflow-hidden"
          style={{ scrollSnapAlign: "start" }}
        >
          {videoOn && (
            <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/15 to-black/55" />
          )}

          <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 py-12 text-center">
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <h1
                className={`text-5xl font-black tracking-tight sm:text-7xl md:text-8xl ${
                  videoOn ? "text-white" : txtPrimary
                }`}
              >
                POP<span className="text-lime-500 dark:text-lime-300">·</span>SPOT
              </h1>
              <p className={`mt-2 text-xs tracking-[0.25em] sm:text-sm ${txtMuted}`}>
                서울 팝업스토어 플랫폼
              </p>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className={`mt-6 text-xl font-semibold sm:text-2xl md:text-3xl ${
                videoOn ? "text-white" : txtPrimary
              }`}
            >
              서울의 모든 팝업, <span className="text-hot-500 dark:text-hot-400">한 화면에</span>
            </motion.h2>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.8 }}
              className={`mt-5 max-w-xl space-y-1 text-sm sm:text-base ${txtMuted}`}
            >
              <p>성수 · 한남 · 압구정 — 서울 모든 팝업을 한 곳에서</p>
              <p>실시간 혼잡도와 AI 코스 추천으로 똑똑한 팝업 투어</p>
              <p>친구와 함께 동선을 짜고, 같이 도장을 모으세요</p>
            </motion.div>

            <motion.div
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.1, delayChildren: 0.6 } },
              }}
              className="mt-10 grid grid-cols-3 gap-4 sm:gap-8"
            >
              {FEATURES.map(({ Icon, label, sub }) => (
                <motion.div
                  key={label}
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
                  }}
                  className="flex flex-col items-center"
                >
                  <div className={`rounded-2xl p-3 sm:p-4 transition ${cardBg}`}>
                    <Icon
                      className={`h-6 w-6 sm:h-7 sm:w-7 ${
                        videoOn ? "text-lime-300" : "text-lime-600 dark:text-lime-300"
                      }`}
                      strokeWidth={2}
                    />
                  </div>
                  <div className={`mt-2 text-sm font-semibold sm:text-base ${txtPrimary}`}>
                    {label}
                  </div>
                  <div className={`mt-0.5 text-[11px] sm:text-xs ${txtMuted}`}>{sub}</div>
                </motion.div>
              ))}
            </motion.div>

            <motion.button
              onClick={proceed}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 1.1 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="group mt-12 inline-flex items-center gap-3 rounded-full bg-lime-400 px-9 py-4 text-base font-bold text-ink-900 shadow-lg shadow-lime-400/25 transition hover:bg-lime-300 hover:shadow-lime-300/40 sm:px-12 sm:py-5 sm:text-lg"
            >
              {isLoggedIn ? (
                <>
                  <span>ENTER</span>
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  <span>로그인하러 가기</span>
                </>
              )}
            </motion.button>

            {!isLoggedIn && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 1.4 }}
                className={`mt-5 text-sm ${txtMuted}`}
              >
                아직 회원이 아니신가요?{" "}
                <button
                  onClick={() => router.push("/signup")}
                  className="font-semibold text-lime-600 underline-offset-4 transition hover:underline dark:text-lime-300"
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
            transition={{ duration: 1, delay: 1.8 }}
            className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className={`flex flex-col items-center gap-1 ${txtMuted}`}
            >
              <span className="text-[10px] tracking-widest">스크롤</span>
              <ChevronDown className="h-5 w-5" />
            </motion.div>
          </motion.div>
        </section>

        {/* ──────────── Section 2 — 왜 POP-SPOT ──────────── */}
        <section
          className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6"
          style={{ scrollSnapAlign: "start" }}
        >
          {videoOn && <div className="absolute inset-0 bg-ink-900/55 backdrop-blur-[2px]" />}

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.5 }}
            transition={{ duration: 0.7 }}
            className="relative z-10 mx-auto max-w-4xl text-center"
          >
            <h2
              className={`text-4xl font-black leading-tight tracking-tight sm:text-5xl md:text-7xl ${
                videoOn ? "text-white" : txtPrimary
              }`}
            >
              서울 팝업,
              <br />
              <span className="text-lime-600 dark:text-lime-300">더 이상</span> 놓치지 마세요
            </h2>

            <p
              className={`mx-auto mt-6 max-w-2xl text-base sm:text-lg ${
                videoOn ? "text-cream-100/90" : txtMuted
              }`}
            >
              인스타그램 수십 개 계정을 팔로우하지 않아도,
              <br className="hidden sm:inline" />
              매일 새로 열리는 서울 팝업을 한 화면에서.
            </p>

            <div className={`mx-auto mt-12 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4`}>
              {[
                { num: "60+", label: "추적 키워드" },
                { num: "1~2", label: "달치 캘린더" },
                { num: "24h", label: "신고 처리" },
              ].map((s) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false }}
                  transition={{ duration: 0.5 }}
                  className={`rounded-xl px-5 py-4 ${cardBg}`}
                >
                  <div
                    className={`text-2xl font-black sm:text-3xl ${
                      videoOn ? "text-lime-300" : "text-lime-600 dark:text-lime-300"
                    }`}
                  >
                    {s.num}
                  </div>
                  <div className={`mt-0.5 text-xs sm:text-sm ${txtMuted}`}>{s.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ──────────── Section 3 — 핵심 3가지 ──────────── */}
        <section
          className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 py-16"
          style={{ scrollSnapAlign: "start" }}
        >
          {videoOn && <div className="absolute inset-0 bg-ink-900/55 backdrop-blur-[2px]" />}

          <div className="relative z-10 mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <h2
                className={`text-3xl font-black tracking-tight sm:text-5xl md:text-6xl ${
                  videoOn ? "text-white" : txtPrimary
                }`}
              >
                가장 많이 쓰는 <span className="text-hot-500 dark:text-hot-400">3가지 기능</span>
              </h2>
              <p className={`mx-auto mt-4 max-w-xl text-sm sm:text-base ${txtMuted}`}>
                팝업을 찾고, 가고, 기록하는 모든 단계를 한 앱에서.
              </p>
            </motion.div>

            <div className="mt-12 grid grid-cols-1 gap-5 sm:mt-16 sm:grid-cols-3 sm:gap-6">
              {BIG_FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.55, delay: i * 0.12 }}
                  className={`rounded-3xl p-7 transition hover:-translate-y-1 ${cardBg} ${ACCENT_RING[f.accent]}`}
                >
                  <div
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${
                      videoOn
                        ? "bg-white/15 ring-1 ring-white/20"
                        : "bg-ink-900/5 ring-1 ring-ink-900/10 dark:bg-white/10 dark:ring-white/15"
                    }`}
                  >
                    <f.Icon className={`h-6 w-6 ${ACCENT_TEXT[f.accent]}`} strokeWidth={2.2} />
                  </div>
                  <h3 className={`mt-5 text-xl font-black tracking-tight ${txtPrimary}`}>
                    {f.title}
                  </h3>
                  <p className={`mt-2 text-sm leading-relaxed ${txtMuted}`}>{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ──────────── Section 4 — 다른 곳엔 없는 4가지 ──────────── */}
        <section
          className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 py-16"
          style={{ scrollSnapAlign: "start" }}
        >
          {videoOn && <div className="absolute inset-0 bg-ink-900/55 backdrop-blur-[2px]" />}

          <div className="relative z-10 mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <h2
                className={`text-3xl font-black tracking-tight sm:text-5xl md:text-6xl ${
                  videoOn ? "text-white" : txtPrimary
                }`}
              >
                다른 곳엔 없는 <span className="text-violet-600 dark:text-violet-300">4가지</span>
              </h2>
              <p className={`mx-auto mt-4 max-w-xl text-sm sm:text-base ${txtMuted}`}>
                단순한 리스트가 아닌, 진짜 팝업 투어를 위한 도구.
              </p>
            </motion.div>

            <div className="mt-12 grid grid-cols-1 gap-5 sm:mt-16 sm:grid-cols-2 sm:gap-6">
              {UNIQUE_POINTS.map((p, i) => (
                <motion.div
                  key={p.title}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -24 : 24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.55, delay: i * 0.08 }}
                  className={`flex gap-4 rounded-2xl p-6 transition ${cardBg}`}
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                      videoOn
                        ? "bg-violet-400/20 ring-1 ring-violet-400/35"
                        : "bg-violet-200/55 ring-1 ring-violet-300/40 dark:bg-violet-500/20 dark:ring-violet-400/30"
                    }`}
                  >
                    <p.Icon
                      className={`h-6 w-6 ${
                        videoOn ? "text-violet-300" : "text-violet-600 dark:text-violet-300"
                      }`}
                      strokeWidth={2.2}
                    />
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${txtPrimary}`}>{p.title}</h3>
                    <p className={`mt-1 text-sm leading-relaxed ${txtMuted}`}>{p.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ──────────── Section 5 — CTA (빨간 풀배경 제거, 부드러운 톤) ──────────── */}
        <section
          className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6"
          style={{ scrollSnapAlign: "start" }}
        >
          {videoOn && <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-[2px]" />}

          {/* 코너 액센트 글로우만 — 이전 빨간 풀배경 대체 */}
          <div className="pointer-events-none absolute -right-32 -top-32 h-[460px] w-[460px] rounded-full bg-hot-300/35 blur-3xl dark:bg-hot-500/22" />
          <div className="pointer-events-none absolute -bottom-32 -left-32 h-[420px] w-[420px] rounded-full bg-amber-300/30 blur-3xl dark:bg-amber-500/20" />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.4 }}
            transition={{ duration: 0.7 }}
            className="relative z-10 mx-auto max-w-3xl text-center"
          >
            <h2
              className={`text-4xl font-black leading-tight tracking-tight sm:text-6xl md:text-7xl ${
                videoOn ? "text-white" : txtPrimary
              }`}
            >
              지금 바로 시작하세요
            </h2>
            <p
              className={`mx-auto mt-5 max-w-xl text-base sm:text-lg ${
                videoOn ? "text-cream-100/95" : txtMuted
              }`}
            >
              오늘도 새로운 팝업이 서울 어딘가에서 열리고 있어요.
              <br className="hidden sm:inline" />
              POP-SPOT 과 함께 가장 먼저 만나보세요.
            </p>

            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <motion.button
                onClick={proceed}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 rounded-full bg-lime-400 px-9 py-4 text-base font-bold text-ink-900 shadow-lg shadow-lime-400/25 transition hover:bg-lime-300 sm:px-12 sm:py-5 sm:text-lg"
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
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className={
                    videoOn
                      ? "inline-flex items-center gap-2 rounded-full bg-white/15 px-9 py-4 text-base font-bold text-white ring-1 ring-white/30 backdrop-blur-md transition hover:bg-white/25 sm:px-12 sm:py-5 sm:text-lg"
                      : "inline-flex items-center gap-2 rounded-full bg-ink-900/8 px-9 py-4 text-base font-bold text-ink-900 ring-1 ring-ink-900/15 transition hover:bg-ink-900/12 dark:bg-white/10 dark:text-cream-100 dark:ring-white/20 dark:hover:bg-white/15 sm:px-12 sm:py-5 sm:text-lg"
                  }
                >
                  회원가입
                  <ArrowRight className="h-5 w-5" />
                </motion.button>
              )}
            </div>

            <p className={`mt-8 text-[11px] tracking-widest sm:text-xs ${txtMuted}`}>
              © {new Date().getFullYear()} POP-SPOT · 서울 팝업스토어 플랫폼
            </p>
          </motion.div>
        </section>
      </div>
    </>
  );
}

/* ────────── 작은 헬퍼 ────────── */

interface IconButtonProps {
  onClick: () => void;
  ariaLabel: string;
  videoOn: boolean;
  children: React.ReactNode;
}

function IconButton({ onClick, ariaLabel, videoOn, children }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={
        videoOn
          ? "inline-flex size-9 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-md transition hover:bg-white/25 active:scale-95"
          : "inline-flex size-9 items-center justify-center rounded-full bg-ink-900/10 text-ink-900 ring-1 ring-ink-900/15 backdrop-blur-md transition hover:bg-ink-900/15 active:scale-95 dark:bg-white/15 dark:text-cream-100 dark:ring-white/25 dark:hover:bg-white/25"
      }
    >
      {children}
    </button>
  );
}
