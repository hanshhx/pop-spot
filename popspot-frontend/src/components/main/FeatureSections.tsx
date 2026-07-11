"use client";

import { motion, type Variants } from "framer-motion";
import { Route, Music, Ticket, Users, ArrowRight } from "lucide-react";

/**
 * 기능 소개.
 *
 * <p>코스는 풀폭 다크 섹션(작전지도)으로 유지({@link FeatureSections} 기본 export). 음악·여권·동행은 실시간
 * 랭킹·캘린더·혼잡도와 같은 크기의 타일 3열({@link FeatureTiles})로, 디자인(다크+액센트+미니 비주얼)은 유지한다.
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

/* =============================== 코스 풀폭 섹션 =============================== */

/** 코스 — 점선 경로 + 번호 핀 미니 지도. */
function CourseVisual() {
  return (
    <div className="rounded-xl border border-black/10 bg-cream-100 p-4 dark:border-ink-700 dark:bg-ink-900" style={DOTS}>
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
      <div className="mt-3 flex items-center justify-between px-1 text-[11px] text-ink-400 dark:text-cream-200/50">
        <span>추천 코스</span>
        <span className="font-mono uppercase tracking-wider">3 stops · 2.4km</span>
      </div>
    </div>
  );
}

interface Accent {
  glow: string;
  pill: string;
  btn: string;
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
      className="relative overflow-hidden rounded-[2rem] border border-black/[0.06] bg-white px-6 py-12 text-ink-900 shadow-pop lg:rounded-[2.5rem] lg:px-14 lg:py-16 dark:border-transparent dark:bg-ink-900 dark:text-cream-200"
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
          <p className="mb-7 text-sm leading-relaxed text-ink-500 lg:text-base dark:text-cream-200/60">{desc}</p>
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

/* ===================== 기능 타일 (음악·여권·동행) — 랭킹/캘린더/혼잡도 크기 ===================== */

/** 음악 — 미니 파형. */
function MusicMini() {
  return (
    <div className="flex h-9 items-end gap-1">
      {[50, 80, 35, 95, 60, 80, 45, 90, 40, 70, 55, 85, 48, 72].map((h, i) => (
        <span key={i} className="flex-1 rounded-full bg-hot-400/70" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

/** 여권 — 미니 스탬프. */
function PassportMini() {
  return (
    <div className="flex gap-1.5">
      {[1, 1, 1, 0, 1, 0].map((s, i) => (
        <span
          key={i}
          className={`grid h-7 w-7 place-items-center rounded-full border-2 border-dashed text-[10px] font-black ${
            s ? "border-amber-300/60 bg-amber-300/15 text-amber-300" : "border-ink-700 text-cream-200/25"
          }`}
        >
          {s ? "✓" : "?"}
        </span>
      ))}
    </div>
  );
}

/** 동행 — 미니 아바타 + 매칭. */
function MateMini() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {["bg-lime-300", "bg-hot-400", "bg-sky-400"].map((c, i) => (
          <span key={i} className={`h-7 w-7 rounded-full ring-2 ring-ink-900 ${c}`} />
        ))}
      </div>
      <span className="rounded-pill bg-sky-400/15 px-2 py-0.5 text-[10px] font-bold text-sky-300">
        매칭중 · 2/4
      </span>
    </div>
  );
}

interface TileAccent {
  glow: string;
  chip: string;
  text: string;
}

interface TileProps {
  Icon: typeof Route;
  eyebrow: string;
  title: string;
  desc: string;
  cta: string;
  onClick: () => void;
  accent: TileAccent;
  visual: React.ReactNode;
}

function FeatureTile({ Icon, eyebrow, title, desc, cta, onClick, accent, visual }: TileProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      variants={reveal}
      className="group relative col-span-1 flex h-[340px] flex-col justify-between overflow-hidden rounded-[2rem] bg-ink-900 p-5 text-left text-cream-200 shadow-pop transition hover:scale-[1.02] active:scale-[0.99] md:p-6 lg:col-span-4"
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-[60px] ${accent.glow}`}
      />
      <div className="relative z-10">
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${accent.chip}`}>
          <Icon size={18} />
        </span>
        <p className={`mt-4 text-[10px] font-bold tracking-[0.25em] ${accent.text}`}>{eyebrow}</p>
        <h3 className="mt-1 text-lg font-black leading-tight text-cream-200">{title}</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-cream-200/55">{desc}</p>
      </div>
      <div className="relative z-10">{visual}</div>
      <span className={`relative z-10 inline-flex items-center gap-1 text-xs font-bold ${accent.text}`}>
        {cta} <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </motion.button>
  );
}

interface Props {
  onNavigate: (tab: string) => void;
}

/** 음악·여권·동행 타일 3열 — 실시간 랭킹/캘린더/혼잡도와 같은 크기(col-4, h-340). */
export function FeatureTiles({ onNavigate }: Props) {
  return (
    <motion.section
      aria-label="기능 바로가기"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
      className="mb-10 grid grid-cols-1 gap-4 lg:grid-cols-12"
    >
      <FeatureTile
        Icon={Music}
        eyebrow="POP·MUSIC"
        title="듣는 곡으로 찾는 팝업"
        desc="지금 노래의 분위기에 맞는 팝업을 추천받아요."
        cta="음악으로 찾기"
        onClick={() => onNavigate("MUSIC")}
        visual={<MusicMini />}
        accent={{ glow: "bg-hot-400/25", chip: "bg-hot-400 text-white", text: "text-hot-400" }}
      />
      <FeatureTile
        Icon={Ticket}
        eyebrow="PASSPORT"
        title="채워지는 나의 기록"
        desc="다녀올수록 도장이 쌓이는 디지털 팝업 여권."
        cta="내 여권 보기"
        onClick={() => onNavigate("PASSPORT")}
        visual={<PassportMini />}
        accent={{ glow: "bg-amber-300/25", chip: "bg-amber-300 text-ink-900", text: "text-amber-300" }}
      />
      <FeatureTile
        Icon={Users}
        eyebrow="MATE"
        title="같이 갈 사람 찾기"
        desc="관심사 맞는 사람과 매칭하고 채팅으로 시간 조율."
        cta="동행 찾으러 가기"
        onClick={() => onNavigate("MATE")}
        visual={<MateMini />}
        accent={{ glow: "bg-sky-400/25", chip: "bg-sky-400 text-ink-900", text: "text-sky-300" }}
      />
    </motion.section>
  );
}

/* =============================== 코스 풀폭 (default export) =============================== */

export default function FeatureSections({ onNavigate }: Props) {
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
          pill: "border-lime-500/40 bg-lime-400/15 text-lime-700 dark:border-lime-300/40 dark:bg-lime-300/15 dark:text-lime-300",
          btn: "bg-lime-300 text-ink-900 hover:bg-lime-400",
        }}
      />
    </div>
  );
}
