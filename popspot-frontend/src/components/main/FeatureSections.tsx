"use client";

import { motion, type Variants } from "framer-motion";
import { Route, Music, Ticket, Users, ArrowRight, Play } from "lucide-react";

/**
 * 기능 소개 개별 섹션 (코스 · 음악 · 여권 · 동행).
 *
 * <p>"작전지도" 프로모처럼 풀폭 다크 섹션을 쓰되, 4개를 한 컨셉으로 찍어내지 않고 각각 다른 <b>액센트 컬러 +
 * 비주얼 목업 + 좌우 교차 레이아웃</b>으로 다른 느낌을 준다. 스크롤 시 부드럽게 등장.
 */

const reveal: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
};

const DOTS: React.CSSProperties = {
  backgroundImage:
    "radial-gradient(circle, rgba(245,243,238,0.07) 1px, transparent 1px)",
  backgroundSize: "16px 16px",
};

interface Accent {
  glow: string;
  pill: string;
  btn: string;
  ring: string;
}

interface ShellProps {
  eyebrow: string;
  EyeIcon: typeof Route;
  title: React.ReactNode;
  desc: string;
  cta: string;
  onCta: () => void;
  visual: React.ReactNode;
  accent: Accent;
  flip?: boolean;
}

function FeatureShell({
  eyebrow,
  EyeIcon,
  title,
  desc,
  cta,
  onCta,
  visual,
  accent,
  flip,
}: ShellProps) {
  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={reveal}
      className="relative mb-6 overflow-hidden rounded-[2rem] bg-ink-900 px-6 py-12 text-cream-200 shadow-pop lg:rounded-[2.5rem] lg:px-14 lg:py-16"
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute -top-20 h-64 w-64 rounded-full blur-[90px] ${accent.glow} ${flip ? "-left-16" : "-right-16"}`}
      />
      <div
        className={`relative z-10 flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between ${flip ? "lg:flex-row-reverse" : ""}`}
      >
        <div className="max-w-lg flex-1">
          <span
            className={`mb-5 inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[11px] font-semibold lg:text-xs ${accent.pill}`}
          >
            <EyeIcon size={13} /> {eyebrow}
          </span>
          <h2 className="mb-4 text-2xl font-black leading-tight md:text-4xl">{title}</h2>
          <p className="mb-7 text-sm leading-relaxed text-cream-200/60 lg:text-base">{desc}</p>
          <button
            type="button"
            onClick={onCta}
            className={`group inline-flex items-center gap-2 rounded-pill px-6 py-3 font-semibold transition-colors lg:px-7 lg:py-3.5 ${accent.btn}`}
          >
            {cta}
            <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
          </button>
        </div>
        <div className="w-full max-w-md flex-1">{visual}</div>
      </div>
    </motion.section>
  );
}

/* =============================== 비주얼 목업 =============================== */

/** 코스 — 점선 경로 + 번호 핀 미니 지도. */
function CourseVisual() {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900 p-4" style={DOTS}>
      <div className="relative h-48 lg:h-52">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 320 200"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M 44 40 Q 120 62 160 108 T 276 158"
            fill="none"
            stroke="var(--color-lime-300)"
            strokeWidth="2.5"
            strokeDasharray="6 6"
            strokeLinecap="round"
            opacity="0.85"
          />
        </svg>
        {[
          { top: "14%", left: "10%", n: "1", label: "성수" },
          { top: "50%", left: "45%", n: "2", label: "한남" },
          { top: "74%", left: "78%", n: "3", label: "압구정" },
        ].map((p) => (
          <div key={p.n} className="absolute flex items-center gap-1.5" style={{ top: p.top, left: p.left }}>
            <span className="grid h-6 w-6 place-items-center rounded-full bg-lime-300 text-[11px] font-black text-ink-900 ring-2 ring-ink-900">
              {p.n}
            </span>
            <span className="rounded bg-ink-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-cream-200">
              {p.label}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between px-1 text-[11px] text-cream-200/50">
        <span>추천 코스</span>
        <span className="font-mono uppercase tracking-wider">3 stops · 2.4km</span>
      </div>
    </div>
  );
}

/** 음악 — LP + 파형. */
function MusicVisual() {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900 p-5">
      <div className="flex items-center gap-4">
        <div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full bg-gradient-to-br from-hot-400 to-fuchsia-700 shadow-lg">
          <div className="absolute inset-2 rounded-full border border-white/10" />
          <div className="absolute inset-5 rounded-full border border-white/10" />
          <div className="grid h-6 w-6 place-items-center rounded-full bg-ink-900 text-hot-400">
            <Play size={11} fill="currentColor" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-hot-400">now playing</p>
          <p className="truncate text-sm font-bold text-cream-200">감성 시티팝 무드</p>
          <p className="truncate text-[11px] text-cream-200/50">이 분위기에 어울리는 팝업 8곳</p>
        </div>
      </div>
      <div className="mt-4 flex h-10 items-end gap-1">
        {[40, 70, 30, 90, 55, 75, 45, 85, 35, 65, 50, 80, 42, 72, 28, 60].map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-full bg-hot-400/70"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/** 여권 — 스탬프 그리드 + 진행바. */
function PassportVisual() {
  const stamps = [1, 1, 1, 1, 1, 0, 1, 0]; // 1=획득, 0=잠금
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">POP·PASSPORT</p>
        <span className="rounded-pill bg-amber-300/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
          Lv.3
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2.5">
        {stamps.map((s, i) => (
          <div
            key={i}
            className={`grid aspect-square place-items-center rounded-full border-2 border-dashed text-[10px] font-black ${
              s
                ? "border-amber-300/60 bg-amber-300/15 text-amber-300"
                : "border-ink-700 text-cream-200/25"
            }`}
          >
            {s ? "✓" : "?"}
          </div>
        ))}
      </div>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-[10px] text-cream-200/50">
          <span>스탬프</span>
          <span className="font-mono">12 / 30</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
          <div className="h-full rounded-full bg-amber-300" style={{ width: "40%" }} />
        </div>
      </div>
    </div>
  );
}

/** 동행 — 채팅 + 매칭. */
function MateVisual() {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center -space-x-2">
          {["bg-lime-300", "bg-hot-400", "bg-sky-400"].map((c, i) => (
            <span key={i} className={`h-7 w-7 rounded-full ring-2 ring-ink-900 ${c}`} />
          ))}
          <span className="ml-3 text-[11px] text-cream-200/60">성수 같이 갈 사람 · 2/4</span>
        </div>
        <span className="rounded-pill bg-sky-400/15 px-2 py-0.5 text-[10px] font-bold text-sky-300">
          매칭중
        </span>
      </div>
      <div className="space-y-2">
        <div className="max-w-[75%] rounded-2xl rounded-tl-sm bg-ink-800 px-3 py-2 text-[12px] text-cream-200/80">
          토요일 2시 성수 어때요?
        </div>
        <div className="ml-auto max-w-[75%] rounded-2xl rounded-tr-sm bg-sky-400 px-3 py-2 text-[12px] font-medium text-ink-900">
          좋아요! 저 그 팝업 완전 가고 싶었어요 🙌
        </div>
        <div className="max-w-[60%] rounded-2xl rounded-tl-sm bg-ink-800 px-3 py-2 text-[12px] text-cream-200/80">
          그럼 확정할게요~
        </div>
      </div>
    </div>
  );
}

/**
 * 섹션 사이 브레이커 — 다크 섹션이 연속으로 나오는 단조로움을 끊는 라이트 인터스티셜.
 * 짧은 인용/스탯/한마디를 중앙 정렬로. 다음 섹션 액센트로 divider·eyebrow 를 물들여 자연스레 이어준다.
 */
function Interstitial({
  eyebrow,
  title,
  sub,
  accentText,
  accentBar,
}: {
  eyebrow: string;
  title: React.ReactNode;
  sub: string;
  accentText: string;
  accentBar: string;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={reveal}
      className="relative flex flex-col items-center gap-3 px-6 py-14 text-center lg:py-20"
    >
      <span className={`h-px w-12 ${accentBar}`} />
      <span className={`text-[11px] font-bold tracking-[0.3em] ${accentText}`}>{eyebrow}</span>
      <p className="max-w-xl text-xl font-black leading-snug text-foreground md:text-3xl">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground md:text-base">{sub}</p>
    </motion.div>
  );
}

/* =============================== 배열 렌더 =============================== */

interface FeatureSectionsProps {
  onNavigate: (tab: string) => void;
}

export default function FeatureSections({ onNavigate }: FeatureSectionsProps) {
  return (
    <div className="mb-16">
      <FeatureShell
        eyebrow="나만의 하루 동선"
        EyeIcon={Route}
        title={
          <>
            가고 싶은 팝업,
            <br />
            <span className="text-lime-300">하나의 코스</span>로 잇다
          </>
        }
        desc="찜한 팝업들을 지도 위에서 순서대로 이어 나만의 하루 코스로. 이동 거리·시간까지 한눈에 계산해드려요."
        cta="코스 짜러 가기"
        onCta={() => onNavigate("COURSE")}
        visual={<CourseVisual />}
        accent={{
          glow: "bg-lime-300/20",
          pill: "border-lime-300/40 bg-lime-300/15 text-lime-300",
          btn: "bg-lime-300 text-ink-900 hover:bg-lime-400",
          ring: "ring-lime-300/40",
        }}
      />

      <Interstitial
        eyebrow="유저 후기"
        title={
          <>
            “주말마다 팝스팟 켜고,
            <br className="hidden md:block" /> 성수부터 한 바퀴 돌아요.”
          </>
        }
        sub="— 20대 팝스팟 유저"
        accentText="text-hot-400"
        accentBar="bg-hot-400/60"
      />

      <FeatureShell
        flip
        eyebrow="POP·MUSIC"
        EyeIcon={Music}
        title={
          <>
            듣는 곡으로 찾는
            <br />
            <span className="text-hot-400">오늘의 팝업</span>
          </>
        }
        desc="지금 듣는 노래의 분위기를 읽어, 그 무드에 어울리는 팝업을 추천해드려요. Spotify 검색부터 풀 재생까지."
        cta="음악으로 찾기"
        onCta={() => onNavigate("MUSIC")}
        visual={<MusicVisual />}
        accent={{
          glow: "bg-hot-400/20",
          pill: "border-hot-400/40 bg-hot-400/15 text-hot-400",
          btn: "bg-hot-400 text-white hover:bg-hot-500",
          ring: "ring-hot-400/40",
        }}
      />

      <Interstitial
        eyebrow="매일 업데이트"
        title={<>04시 · 16시, 하루 두 번</>}
        sub="서울에 새로 뜬 팝업이 지도에 자동으로 쌓여요."
        accentText="text-amber-300"
        accentBar="bg-amber-300/60"
      />

      <FeatureShell
        eyebrow="디지털 팝업 여권"
        EyeIcon={Ticket}
        title={
          <>
            방문할수록 채워지는
            <br />
            <span className="text-amber-300">나의 기록</span>
          </>
        }
        desc="다녀온 팝업마다 도장을 쿵. 스탬프를 모아 레벨을 올리고, 한정 배지를 잠금 해제하세요."
        cta="내 여권 보기"
        onCta={() => onNavigate("PASSPORT")}
        visual={<PassportVisual />}
        accent={{
          glow: "bg-amber-300/20",
          pill: "border-amber-300/40 bg-amber-300/15 text-amber-300",
          btn: "bg-amber-300 text-ink-900 hover:bg-amber-200",
          ring: "ring-amber-300/40",
        }}
      />

      <Interstitial
        eyebrow="놓치지 마세요"
        title={
          <>
            마감이 다가오는 팝업,
            <br className="hidden md:block" /> 알림으로 먼저
          </>
        }
        sub="위시리스트에 담으면 마감 D-3에 알려드려요."
        accentText="text-sky-300"
        accentBar="bg-sky-400/60"
      />

      <FeatureShell
        flip
        eyebrow="같이 갈 사람 찾기"
        EyeIcon={Users}
        title={
          <>
            혼자 가긴 애매한 그 팝업,
            <br />
            <span className="text-sky-300">같이</span> 가요
          </>
        }
        desc="관심사 맞는 사람과 매칭하고, 채팅으로 시간을 맞춰 함께 다녀오세요. 동행이 있으면 팝업이 두 배 재밌어요."
        cta="동행 찾으러 가기"
        onCta={() => onNavigate("MATE")}
        visual={<MateVisual />}
        accent={{
          glow: "bg-sky-400/20",
          pill: "border-sky-400/40 bg-sky-400/15 text-sky-300",
          btn: "bg-sky-400 text-ink-900 hover:bg-sky-300",
          ring: "ring-sky-400/40",
        }}
      />
    </div>
  );
}
