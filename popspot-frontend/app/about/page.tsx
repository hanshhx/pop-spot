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
import { useLocale, type Locale } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';

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

const SECURITY_CARDS_KO: SecurityCard[] = [
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
    shortDesc: 'Takedown · 관리자 검토',
    detail:
      '저작권 · 정보 오류 신고는 관리자 검토 대기열에 등록하고 24시간 안에 확인합니다. 명백한 권리 침해나 긴급 피해가 확인된 경우에만 검토 중 숨기며, 영구 삭제는 권리 관계 확인 후 처리합니다.',
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

const SECURITY_CARDS_EN: SecurityCard[] = [
  {
    Icon: KeyRound,
    title: 'Signed login tokens',
    shortDesc: 'A long, private signing key',
    detail:
      'Every login token is signed. The server refuses to start if its private signing key is too short, making forged tokens much harder to create.',
    accent: 'lime',
  },
  {
    Icon: Lock,
    title: 'Protected passwords',
    shortDesc: 'Passwords are never stored as plain text',
    detail:
      'Passwords are converted with BCrypt before storage. Even if stored data is exposed, the original password is deliberately expensive to recover.',
    accent: 'hot',
  },
  {
    Icon: Network,
    title: 'Approved websites only',
    shortDesc: 'Requests are limited to trusted domains',
    detail:
      'The API accepts browser requests only from POP-SPOT and approved preview addresses, reducing the risk of a fake site using a visitor’s session.',
    accent: 'blue',
  },
  {
    Icon: Gauge,
    title: 'Repeated attempts are limited',
    shortDesc: 'Limits on login and verification attempts',
    detail:
      'Fast repeated login attempts and email-code requests are restricted so automated guessing cannot continue without delay.',
    accent: 'amber',
  },
  {
    Icon: FileText,
    title: 'Privacy choices are separated',
    shortDesc: 'Age check and separate consent',
    detail:
      'Terms and privacy consent are requested separately. People under 14 cannot create an account, in line with the Korean privacy policy.',
    accent: 'violet',
  },
  {
    Icon: Timer,
    title: 'Reports reviewed within 24 hours',
    shortDesc: 'Disputed listings are hidden first',
    detail:
      'A copyright or accuracy report hides the listing while the operator reviews it. Permanent deletion happens only after review to reduce malicious reports.',
    accent: 'rose',
  },
  {
    Icon: ShieldCheck,
    title: 'Encrypted connections',
    shortDesc: 'HTTPS from the browser to the server',
    detail:
      'Traffic between visitors and the service is protected with HTTPS, including the connection to the backend server.',
    accent: 'cream',
  },
];

const SECURITY_CARDS_JA: SecurityCard[] = [
  {
    Icon: KeyRound,
    title: 'ログイン情報を安全に発行',
    shortDesc: '十分に長い秘密鍵で署名',
    detail:
      'ログイン情報には署名を付け、秘密鍵が短い場合はサーバーが起動しないようにしています。偽のログイン情報を作りにくくします。',
    accent: 'lime',
  },
  {
    Icon: Lock,
    title: 'パスワードを保護',
    shortDesc: 'そのままの文字では保存しません',
    detail:
      'パスワードはBCryptで変換してから保存します。保存データが漏れた場合でも、元の文字を簡単には戻せません。',
    accent: 'hot',
  },
  {
    Icon: Network,
    title: '許可したサイトだけ接続',
    shortDesc: '信頼できるドメインに限定',
    detail:
      'ブラウザーからのAPI接続はPOP-SPOTと許可済みの確認用アドレスだけに限定し、偽サイトからの利用を防ぎます。',
    accent: 'blue',
  },
  {
    Icon: Gauge,
    title: '連続した試行を制限',
    shortDesc: 'ログインと認証コードに回数制限',
    detail: '短時間のログイン試行や認証メール送信を制限し、自動プログラムによる推測を遅らせます。',
    accent: 'amber',
  },
  {
    Icon: FileText,
    title: '同意を分けて確認',
    shortDesc: '年齢確認と個別の同意',
    detail:
      '利用規約と個人情報への同意を別々に確認します。韓国の方針に基づき、14歳未満は登録できません。',
    accent: 'violet',
  },
  {
    Icon: Timer,
    title: '24時間以内に申請を確認',
    shortDesc: '確認中は対象情報を非表示',
    detail:
      '著作権や情報の誤りに関する申請を受けると掲載を隠し、運営者が確認します。悪意ある申請を防ぐため、完全削除は確認後に行います。',
    accent: 'rose',
  },
  {
    Icon: ShieldCheck,
    title: '通信を暗号化',
    shortDesc: 'ブラウザーからサーバーまでHTTPS',
    detail: '利用者とサービスの間の通信は、バックエンドサーバーへの接続を含めてHTTPSで保護します。',
    accent: 'cream',
  },
];

const PAGE_COPY: Record<
  Locale,
  {
    badge: string;
    heading: string;
    highlight: string;
    intro: string;
    more: string;
    moreText: string;
    terms: string;
    privacy: string;
    contact: string;
    cards: SecurityCard[];
  }
> = {
  ko: {
    badge: '안전한 서비스',
    heading: 'POP-SPOT의',
    highlight: '7가지 안전장치',
    intro:
      '서비스에 실제 적용한 보안·정책 안전장치입니다. 사용자의 정보와 권리를 보호하기 위해 운영 환경에 반영했습니다.',
    more: '더 자세한 내용은',
    moreText:
      '이용약관과 개인정보 처리방침에서 확인할 수 있습니다. 저작권이나 정보 오류는 각 팝업 상세 화면의 신고 버튼 또는 이메일로 알려주시면 24시간 안에 확인합니다.',
    terms: '이용약관',
    privacy: '개인정보 처리방침',
    contact: '문의하기',
    cards: SECURITY_CARDS_KO,
  },
  en: {
    badge: 'How we protect the service',
    heading: 'POP-SPOT has',
    highlight: '7 safeguards',
    intro:
      'These safeguards are used in the live service to protect visitors, accounts, and content owners.',
    more: 'Read the details',
    moreText:
      'The Terms and Privacy Policy explain these measures. Report copyright or listing errors from the pop-up page or by email; we aim to review them within 24 hours.',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    contact: 'Contact us',
    cards: SECURITY_CARDS_EN,
  },
  ja: {
    badge: 'サービスの安全対策',
    heading: 'POP-SPOTの',
    highlight: '7つの安全対策',
    intro: '利用者の情報・アカウント・権利を守るため、実際のサービスで使用している対策です。',
    more: '詳しい内容',
    moreText:
      '利用規約とプライバシーポリシーで確認できます。著作権や掲載情報の誤りは、詳細画面の申請ボタンまたはメールでお知らせください。24時間以内の確認を目指します。',
    terms: '利用規約',
    privacy: 'プライバシーポリシー',
    contact: 'お問い合わせ',
    cards: SECURITY_CARDS_JA,
  },
};

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
  const { locale } = useLocale();
  const copy = PAGE_COPY[locale];
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
            {copy.badge}
          </span>
          <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight sm:text-5xl md:text-6xl">
            {copy.heading} <span className="text-hot-500 dark:text-hot-400">{copy.highlight}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm text-ink-700/80 dark:text-cream-100/80 sm:text-base">
            {copy.intro}
          </p>
        </motion.div>

        {/* 카드 그리드 */}
        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {copy.cards.map((card, i) => (
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
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{copy.more}</h2>
          <p className="mt-3 max-w-xl text-sm text-ink-700/80 dark:text-cream-100/80 sm:text-base">
            {copy.moreText}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={localizedPath('/terms', locale)}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-5 py-2.5 text-sm font-bold text-cream-100 transition hover:bg-ink-800 dark:bg-cream-100 dark:text-ink-900 dark:hover:bg-cream-200"
            >
              {copy.terms}
              <ArrowRight className="size-3.5" />
            </Link>
            <Link
              href={localizedPath('/privacy', locale)}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink-900/15 bg-transparent px-5 py-2.5 text-sm font-bold transition hover:border-ink-900/30 hover:bg-ink-900/5 dark:border-white/25 dark:hover:border-white/50 dark:hover:bg-white/10"
            >
              {copy.privacy}
              <ArrowRight className="size-3.5" />
            </Link>
            <a
              href="mailto:reo4321@naver.com"
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink-900/15 bg-transparent px-5 py-2.5 text-sm font-bold transition hover:border-ink-900/30 hover:bg-ink-900/5 dark:border-white/25 dark:hover:border-white/50 dark:hover:bg-white/10"
            >
              {copy.contact}
              <ArrowRight className="size-3.5" />
            </a>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
