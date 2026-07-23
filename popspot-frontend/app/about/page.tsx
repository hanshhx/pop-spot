'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  KeyRound,
  Lock,
  ShieldCheck,
  Network,
  Gauge,
  FileText,
  Timer,
  ArrowRight,
} from 'lucide-react';

/**
 * /about — POP-SPOT 운영 안내 + 보안 안전장치 마케팅 페이지.
 *
 * <p>상용화 / 앱 출시 직전 사용자 신뢰도 확보용. 백엔드에 실제 적용된 7대 안전장치를
 * 일반 사용자 언어로 풀어 카드 형태로 노출. README §정책 안전장치와 1:1 매칭.
 */

interface SecurityCard {
  Icon: typeof KeyRound;
  title: string;
  shortDesc: string;
  detail: string;
  accent: 'lime' | 'hot' | 'blue' | 'amber' | 'violet' | 'rose' | 'cream';
}

const SECURITY_CARDS: SecurityCard[] = [
  {
    Icon: KeyRound,
    title: 'JWT 토큰 안전 발급',
    shortDesc: 'HS256 · 32바이트 이상 시크릿',
    detail:
      '로그인 토큰은 HMAC-SHA256 으로 서명하고, 시크릿이 32바이트보다 짧으면 서버가 부팅하지 않도록 검증합니다. brute-force 로 토큰을 위조할 수 없게 설계.',
    accent: 'lime',
  },
  {
    Icon: Lock,
    title: '비밀번호 강력 해싱',
    shortDesc: 'BCrypt strength 12',
    detail:
      '비밀번호는 BCrypt 12 라운드로 해싱해 저장합니다. 기본값 (10) 대비 해싱 비용이 4배 — 데이터 유출이 발생해도 평문 비밀번호로 복원하기 매우 어렵습니다.',
    accent: 'hot',
  },
  {
    Icon: Network,
    title: '허용된 도메인만 접근',
    shortDesc: 'CORS 패턴 화이트리스트',
    detail:
      '공식 도메인 (popspot.co.kr 및 Vercel preview) 외에는 API 호출이 차단됩니다. 위변조 사이트가 사용자 정보를 가로채는 시도를 원천 차단.',
    accent: 'blue',
  },
  {
    Icon: Gauge,
    title: '무차별 시도 차단',
    shortDesc: '로그인 5회/분 · 이메일 5회/시간',
    detail:
      'Bucket4j 토큰 버킷으로 로그인 5회/분, 이메일 인증코드 발송 5회/시간 으로 제한합니다. 자동화 봇의 brute-force 공격을 즉시 차단.',
    accent: 'amber',
  },
  {
    Icon: FileText,
    title: 'PIPA 준수 처리방침',
    shortDesc: '만 14세 이상 · 별도 동의 분리',
    detail:
      '개인정보 처리방침을 PIPA(개인정보보호법) 기준으로 작성하고, 가입 시 약관 / 개인정보 동의를 분리해 받습니다. 만 14세 미만은 가입할 수 없습니다.',
    accent: 'violet',
  },
  {
    Icon: Timer,
    title: '24시간 신고 응답',
    shortDesc: 'Takedown · 즉시 노출 차단',
    detail:
      '저작권 · 정보 오류 신고는 접수 즉시 노출이 차단되고, 24시간 안에 운영자 검토를 진행합니다. 악의적 takedown 방어를 위해 영구 삭제는 검토 후 별도 처리.',
    accent: 'rose',
  },
  {
    Icon: ShieldCheck,
    title: '전 구간 HTTPS',
    shortDesc: 'Tailscale Funnel · 자동 인증서 갱신',
    detail:
      'Tailscale Funnel 로 백엔드 진입 구간까지 HTTPS 가 자동 인증서로 발급/갱신됩니다. 사용자 ↔ 서버 사이 트래픽은 항상 암호화.',
    accent: 'cream',
  },
];

const ACCENT_BG: Record<SecurityCard['accent'], string> = {
  lime: 'bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300',
  hot: 'bg-hot-100 text-hot-600 dark:bg-hot-500/15 dark:text-hot-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  cream: 'bg-ink-900/8 text-ink-900 dark:bg-white/12 dark:text-cream-100',
};

const ACCENT_BAR: Record<SecurityCard['accent'], string> = {
  lime: 'bg-lime-400',
  hot: 'bg-hot-400',
  blue: 'bg-blue-400',
  amber: 'bg-amber-400',
  violet: 'bg-violet-400',
  rose: 'bg-rose-400',
  cream: 'bg-ink-900/30 dark:bg-cream-100/40',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-cream-100 px-6 py-16 text-ink-900 dark:bg-ink-900 dark:text-cream-100 sm:px-10 sm:py-24">
      <div className="mx-auto max-w-5xl">
        {/* 헤더 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-4 py-1.5 text-xs font-medium text-cream-100 dark:bg-cream-100 dark:text-ink-900">
            <ShieldCheck className="size-3.5" />
            안전한 서비스
          </span>
          <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight sm:text-5xl md:text-6xl">
            POP-SPOT 의 <span className="text-hot-500 dark:text-hot-400">7가지</span>
            <br />
            안전장치
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm text-ink-700/80 dark:text-cream-100/80 sm:text-base">
            서비스 출시 전 백엔드에 실제 적용한 보안·정책 안전장치입니다. 사용자의 정보와 권리를
            보호하기 위해 모든 항목을 운영 환경에 반영했습니다.
          </p>
        </motion.div>

        {/* 카드 그리드 */}
        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SECURITY_CARDS.map((card, i) => (
            <motion.article
              key={card.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: (i % 6) * 0.08 }}
              className="group relative overflow-hidden rounded-2xl bg-white p-6 ring-1 ring-ink-900/8 transition hover:-translate-y-1 hover:ring-ink-900/20 dark:bg-ink-800/60 dark:ring-white/10 dark:hover:ring-white/20"
            >
              <div className={`absolute left-0 top-0 h-full w-1 ${ACCENT_BAR[card.accent]}`} />
              <div
                className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${ACCENT_BG[card.accent]}`}
              >
                <card.Icon className="size-5" strokeWidth={2.2} />
              </div>
              <div className="mt-5 flex items-center gap-2">
                <h3 className="text-lg font-bold tracking-tight">{card.title}</h3>
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink-700/40 dark:text-cream-100/40">
                  0{i + 1}
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-ink-700/65 dark:text-cream-100/60">
                {card.shortDesc}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-700/85 dark:text-cream-100/80">
                {card.detail}
              </p>
            </motion.article>
          ))}
        </div>

        {/* 하단 안내 + 링크 */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-20 rounded-2xl border border-ink-900/10 bg-white/60 p-8 backdrop-blur-sm dark:border-white/10 dark:bg-ink-800/40 sm:p-12"
        >
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">더 자세한 내용은</h2>
          <p className="mt-3 max-w-xl text-sm text-ink-700/80 dark:text-cream-100/80 sm:text-base">
            이용약관과 개인정보 처리방침에 모든 항목이 명시되어 있습니다. 저작권 / 정보 오류 신고는
            각 팝업 상세 페이지의 신고 버튼이나 아래 이메일로 연락 주시면 24시간 안에 응답드립니다.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/terms"
              className="inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-5 py-2.5 text-sm font-bold text-cream-100 transition hover:bg-ink-800 dark:bg-cream-100 dark:text-ink-900 dark:hover:bg-cream-200"
            >
              이용약관
              <ArrowRight className="size-3.5" />
            </Link>
            <Link
              href="/privacy"
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink-900/15 bg-transparent px-5 py-2.5 text-sm font-bold transition hover:border-ink-900/30 hover:bg-ink-900/5 dark:border-white/25 dark:hover:border-white/50 dark:hover:bg-white/10"
            >
              개인정보 처리방침
              <ArrowRight className="size-3.5" />
            </Link>
            <a
              href="mailto:reo4321@naver.com"
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink-900/15 bg-transparent px-5 py-2.5 text-sm font-bold transition hover:border-ink-900/30 hover:bg-ink-900/5 dark:border-white/25 dark:hover:border-white/50 dark:hover:bg-white/10"
            >
              문의하기
              <ArrowRight className="size-3.5" />
            </a>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
