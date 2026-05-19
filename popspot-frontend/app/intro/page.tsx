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
  Clock,
  Map as MapIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  POP-SPOT — Cover / Intro Page (Persistent Video Background)               */
/*                                                                            */
/*  비디오는 페이지 전체에 fixed 로 깔리고, 각 섹션은 반투명 오버레이만 갖습니다.    */
/*    옵션 1) "/14385-256955049.mp4"                                           */
/*    옵션 2) "/215246.mp4"                                                    */
/* -------------------------------------------------------------------------- */
const VIDEO_SRC = "/14385-256955049.mp4";

const FEATURES = [
  { Icon: Calendar, label: "캘린더", sub: "이번 달 팝업 한눈에" },
  { Icon: MapPin,   label: "지도",   sub: "성수 · 한남 · 압구정" },
  { Icon: Crown,    label: "랭킹",   sub: "지금 핫한 팝업 TOP" },
];

const BIG_FEATURES = [
  {
    Icon: Calendar,
    title: "한 달 팝업 캘린더",
    desc: "이번 달과 다음 달 팝업을 캘린더에 펼쳐서 보고, 가고 싶은 곳을 미리 체크하세요.",
    accent: "text-lime-300",
    glow: "ring-lime-300/30",
  },
  {
    Icon: MapIcon,
    title: "위치 기반 지도",
    desc: "성수 · 한남 · 압구정 등 핫스팟을 지도에서 확인. 클릭 한 번에 길찾기까지.",
    accent: "text-violet-300",
    glow: "ring-violet-300/30",
  },
  {
    Icon: Crown,
    title: "실시간 랭킹",
    desc: "지금 가장 인기 있는 팝업 TOP 10. 트렌드를 놓치지 않는 가장 빠른 방법.",
    accent: "text-hot-400",
    glow: "ring-hot-400/30",
  },
];

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

export default function IntroPage() {
  const router = useRouter();
  const [videoReady, setVideoReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    try {
      setIsLoggedIn(!!localStorage.getItem("user"));
    } catch {
      setIsLoggedIn(false);
    }
  }, []);

  const proceed = () => {
    if (isLoggedIn) {
      router.push("/?entered=1");
    } else {
      router.push("/login");
    }
  };

  return (
    <>
      {/* =================================================================== */}
      {/* 페이지 전체 고정 배경 비디오 (모든 섹션 뒤에 깔림)                       */}
      {/* =================================================================== */}
      <div className="fixed inset-0 z-0 bg-ink-900">
        <video
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

      {/* =================================================================== */}
      {/* 상단 고정: SKIP / Login 버튼                                          */}
      {/* =================================================================== */}
      <button
        onClick={proceed}
        className="fixed right-5 top-5 z-50 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-cream-100 backdrop-blur-md ring-1 ring-white/20 transition hover:bg-white/20 sm:right-6 sm:top-6"
        aria-label="인트로 건너뛰기"
      >
        {isLoggedIn ? "Skip →" : "Login →"}
      </button>

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
          {/* Hero 전용 그라데이션 (투명 → 어두움) */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60" />

          <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 py-12 text-center">
            <motion.div
              initial={{ opacity: 0, y: -24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="mb-3"
            >
              <h1 className="text-5xl font-black tracking-tight text-white sm:text-7xl md:text-8xl">
                POP<span className="text-lime-300">·</span>SPOT
              </h1>
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.3em] text-cream-200/80 sm:text-sm">
                Seoul Popup Store Intelligence
              </p>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mt-6 text-xl font-semibold text-white sm:text-2xl md:text-3xl"
            >
              서울의 모든 팝업, <span className="text-hot-400">한 화면에</span>
            </motion.h2>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.2 }}
              className="mt-5 max-w-xl space-y-1 text-sm text-cream-100/85 sm:text-base"
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
                  <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-md ring-1 ring-white/20 transition hover:bg-white/15 sm:p-4">
                    <Icon className="h-6 w-6 text-lime-300 sm:h-7 sm:w-7" strokeWidth={2} />
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white sm:text-base">{label}</div>
                  <div className="mt-0.5 text-[11px] text-cream-200/70 sm:text-xs">{sub}</div>
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
              className="group mt-12 inline-flex items-center gap-3 rounded-full bg-lime-300 px-9 py-4 text-base font-bold text-ink-900 shadow-2xl shadow-lime-300/30 ring-2 ring-white/20 transition hover:bg-lime-200 hover:shadow-lime-300/50 sm:px-12 sm:py-5 sm:text-lg"
              aria-label={isLoggedIn ? "POP-SPOT 메인 페이지로 이동" : "로그인 페이지로 이동"}
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
                transition={{ duration: 0.8, delay: 2.0 }}
                className="mt-5 text-sm text-cream-100/80"
              >
                아직 회원이 아니신가요?{" "}
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
              className="flex flex-col items-center gap-1 text-cream-200/70"
            >
              <span className="font-mono text-[10px] uppercase tracking-widest">Scroll</span>
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
          <div className="absolute inset-0 bg-ink-900/65 backdrop-blur-[2px]" />
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
              className="inline-block rounded-full bg-lime-300/15 px-4 py-1.5 font-mono text-xs uppercase tracking-widest text-lime-300 ring-1 ring-lime-300/40 backdrop-blur-md"
            >
              Why POP-SPOT
            </motion.span>

            <h2 className="mt-6 text-4xl font-black leading-tight tracking-tight text-white drop-shadow-2xl sm:text-5xl md:text-7xl">
              서울 팝업,
              <br />
              <span className="text-lime-300">더 이상</span> 놓치지 마세요.
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-base text-cream-100/90 drop-shadow-lg sm:text-lg">
              인스타그램 수십 개 계정을 팔로우하지 않아도,
              <br className="hidden sm:inline" />
              매일 새로 열리는 서울 팝업을 한 화면에서.
            </p>

            <div className="mt-14 grid grid-cols-3 gap-4 sm:gap-12">
              {[
                { num: "60+", label: "추적 키워드" },
                { num: "1~2", label: "달치 캘린더" },
                { num: "24h", label: "신고 처리" },
              ].map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false }}
                  transition={{ duration: 0.6, delay: 0.3 + i * 0.15 }}
                  className="rounded-2xl bg-black/30 p-4 backdrop-blur-md ring-1 ring-white/10 sm:p-6"
                >
                  <div className="text-3xl font-black text-lime-300 sm:text-5xl md:text-6xl">{s.num}</div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-cream-100/80 sm:text-xs">
                    {s.label}
                  </div>
                </motion.div>
              ))}
            </div>
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
          <div className="absolute inset-0 bg-ink-900/70 backdrop-blur-[2px]" />

          <div className="relative z-10 mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.7 }}
              className="text-center"
            >
              <span className="inline-block rounded-full bg-white/10 px-4 py-1.5 font-mono text-xs uppercase tracking-widest text-cream-100/90 ring-1 ring-white/20 backdrop-blur-md">
                Core Features
              </span>
              <h2 className="mt-5 text-3xl font-black tracking-tight text-white drop-shadow-2xl sm:text-5xl md:text-6xl">
                가장 많이 쓰는 <span className="text-hot-400">3가지 기능</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm text-cream-100/85 drop-shadow-lg sm:text-base">
                팝업을 찾고, 가고, 기록하는 모든 단계를 한 앱에서.
              </p>
            </motion.div>

            <div className="mt-12 grid grid-cols-1 gap-5 sm:mt-16 sm:grid-cols-3 sm:gap-6">
              {BIG_FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.6, delay: i * 0.15 }}
                  className={`rounded-3xl bg-white/10 p-7 backdrop-blur-xl ring-1 ${f.glow} transition hover:-translate-y-1 hover:bg-white/15`}
                >
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur-md">
                    <f.Icon className={`h-7 w-7 ${f.accent}`} strokeWidth={2.2} />
                  </div>
                  <h3 className="mt-5 text-xl font-black tracking-tight text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-cream-100/85">{f.desc}</p>
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
          <div className="absolute inset-0 bg-ink-900/70 backdrop-blur-[2px]" />
          <div className="pointer-events-none absolute -left-20 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-violet-400/15 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 top-1/4 h-[400px] w-[400px] rounded-full bg-hot-400/15 blur-3xl" />

          <div className="relative z-10 mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.7 }}
              className="text-center"
            >
              <span className="inline-block rounded-full bg-violet-400/15 px-4 py-1.5 font-mono text-xs uppercase tracking-widest text-violet-300 ring-1 ring-violet-400/40 backdrop-blur-md">
                Only on POP-SPOT
              </span>
              <h2 className="mt-5 text-3xl font-black tracking-tight text-white drop-shadow-2xl sm:text-5xl md:text-6xl">
                다른 곳엔 없는 <span className="text-violet-300">4가지</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm text-cream-100/85 drop-shadow-lg sm:text-base">
                단순한 리스트가 아닌, 진짜 팝업 투어를 위한 도구.
              </p>
            </motion.div>

            <div className="mt-12 grid grid-cols-1 gap-5 sm:mt-16 sm:grid-cols-2 sm:gap-6">
              {UNIQUE_POINTS.map((p, i) => (
                <motion.div
                  key={p.title}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.6, delay: i * 0.1 }}
                  className="flex gap-4 rounded-2xl bg-white/8 p-6 backdrop-blur-xl ring-1 ring-white/15 transition hover:bg-white/12"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-400/20 ring-1 ring-violet-400/40 backdrop-blur-md">
                    <p.Icon className="h-6 w-6 text-violet-300" strokeWidth={2.2} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{p.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-cream-100/85">{p.desc}</p>
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
          <div className="absolute inset-0 bg-hot-500/75 backdrop-blur-[1px]" />
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
              지금 바로 시작하세요
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base text-white/95 drop-shadow-lg sm:text-lg">
              오늘도 새로운 팝업이 서울 어딘가에서 열리고 있어요.
              <br className="hidden sm:inline" />
              POP-SPOT 과 함께 가장 먼저 만나보세요.
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
                  회원가입
                  <ArrowRight className="h-5 w-5" />
                </motion.button>
              )}
            </div>

            <p className="mt-8 font-mono text-[11px] uppercase tracking-widest text-white/70 drop-shadow-lg sm:text-xs">
              © {new Date().getFullYear()} POP-SPOT · Seoul Popup Store Intelligence
            </p>
          </motion.div>
        </section>
      </div>
    </>
  );
}
