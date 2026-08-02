import Link from 'next/link';

type PolicyLocale = 'en' | 'ja';
type PolicyKind = 'privacy' | 'terms';

const COPY = {
  en: {
    home: 'Back to home',
    convenience:
      'This is a convenience translation for international visitors. If wording differs, the Korean original governs.',
    original: 'Read the Korean original',
    privacy: {
      title: 'Privacy Policy',
      updated: 'Effective August 2, 2026',
      sections: [
        [
          'Information we collect',
          'Email, encrypted password, nickname and Korean mobile number for email sign-up; profile details supplied by Google, Kakao or Naver for social login; service activity such as saved pop-ups, stamps and played tracks; anonymous visit ID, page path, browser/device details and visit time. Visitor analytics do not store an IP address or member profile.',
        ],
        [
          'Why we use it',
          'To create and secure accounts, provide saved lists and community features, process payments when used, prevent abuse, answer requests, and improve reliability.',
        ],
        [
          'Storage and deletion',
          'Account information is deleted when the account is closed unless Korean law requires a longer period. Security and dispute records are kept only for the periods stated in the Korean policy, then securely deleted or anonymized.',
        ],
        [
          'Service providers and overseas processing',
          'POP-SPOT uses Google, Kakao, Naver, PortOne, Vercel and Sentry for login, search, payment, hosting and error monitoring. Only the information required for each task is sent.',
        ],
        [
          'Your choices and rights',
          'You may view, correct or delete your information, withdraw consent, close your account, or ask how your information is handled. Contact the address below.',
        ],
        ['Contact', 'Privacy officer: Kim Donghyun · reo4321@naver.com'],
      ],
    },
    terms: {
      title: 'Terms of Service',
      updated: 'Last revised July 22, 2026',
      sections: [
        [
          'Pop-up information',
          'Listings may be registered by the operator, submitted by users, or organized from public Naver and Kakao search results. Automatically collected listings show their original source. POP-SPOT does not guarantee that dates, locations or availability are complete or current.',
        ],
        [
          'Original sources and copyright',
          'POP-SPOT does not reproduce source articles in bulk. Use the source link on a pop-up detail page to check the original. Rights holders may request a correction or removal.',
        ],
        [
          'Reports and removal',
          'A report temporarily blocks the disputed listing from public display. The operator reviews the request and normally responds within 24 hours. Permanent deletion requires review to prevent abusive reports.',
        ],
        [
          'External websites and reservations',
          'Official and reservation buttons open a third-party website. POP-SPOT does not control that site, its inventory, purchases, refunds or privacy practices.',
        ],
        [
          'Member content',
          'Users are responsible for mate posts, tips and chat messages they submit. Do not post unlawful, harmful or rights-infringing content. Member content is kept out of search indexing under the current policy.',
        ],
        [
          'Accounts and service changes',
          'You must be at least 14 years old. The service may limit abusive activity, suspend accounts that violate these terms, and announce material policy changes before they take effect.',
        ],
      ],
    },
  },
  ja: {
    home: 'ホームに戻る',
    convenience: '海外の利用者向けの参考訳です。表現に違いがある場合は韓国語の原文が優先されます。',
    original: '韓国語の原文を見る',
    privacy: {
      title: 'プライバシーポリシー',
      updated: '施行日：2026年8月2日',
      sections: [
        [
          '収集する情報',
          'メール登録ではメールアドレス、暗号化されたパスワード、ニックネーム、韓国の携帯電話番号を収集します。ソーシャルログインではGoogle・Kakao・Naverが提供するプロフィール情報を受け取ります。保存したポップアップ、スタンプ、再生した曲などの利用記録も含まれます。訪問統計にはIPアドレスや会員プロフィールを保存しません。',
        ],
        [
          '利用目的',
          'アカウントの作成と保護、保存リストやコミュニティ機能の提供、必要な場合の決済処理、不正利用防止、お問い合わせ対応、サービスの安定性向上に利用します。',
        ],
        [
          '保管と削除',
          '退会時にアカウント情報を削除します。ただし韓国法で保存が必要な記録は定められた期間だけ保管し、その後安全に削除または匿名化します。',
        ],
        [
          '委託先と国外処理',
          'ログイン、検索、決済、ホスティング、エラー確認のためGoogle、Kakao、Naver、PortOne、Vercel、Sentryを利用します。各業務に必要な情報だけを送信します。',
        ],
        [
          '利用者の権利',
          '情報の確認・訂正・削除、同意の撤回、退会、処理内容の問い合わせができます。下記の連絡先をご利用ください。',
        ],
        ['連絡先', '個人情報保護責任者：Kim Donghyun · reo4321@naver.com'],
      ],
    },
    terms: {
      title: '利用規約',
      updated: '最終改定日：2026年7月22日',
      sections: [
        [
          'ポップアップ情報',
          '掲載情報は運営者による登録、利用者からの投稿、Naver・Kakaoの公開検索結果を整理したものを含みます。自動収集された情報には原文の出典を表示します。日程・場所・開催状況の完全性や最新性は保証しません。',
        ],
        [
          '原文と著作権',
          '出典記事の本文を大量に複製しません。詳細ページの出典リンクから原文をご確認ください。権利者は修正・削除を依頼できます。',
        ],
        [
          '通報と削除',
          '通報を受けた情報は一時的に非表示となり、運営者が確認します。通常24時間以内の対応を目標とします。悪用防止のため、完全削除は確認後に行います。',
        ],
        [
          '外部サイトと予約',
          '公式サイト・予約ボタンは外部サイトへ移動します。POP-SPOTは外部サイトの在庫、購入、返金、個人情報処理を管理しません。',
        ],
        [
          '会員が作成する内容',
          '同行募集、訪問情報、チャットの内容は投稿者が責任を負います。違法・有害・権利侵害となる内容を投稿してはいけません。現在の方針では会員投稿を検索結果に表示しません。',
        ],
        [
          'アカウントとサービス変更',
          '14歳以上の方のみ登録できます。不正利用には機能制限やアカウント停止を行う場合があります。重要な規約変更は施行前にお知らせします。',
        ],
      ],
    },
  },
} as const;

export default function LocalizedPolicyPage({
  locale,
  kind,
}: {
  locale: PolicyLocale;
  kind: PolicyKind;
}) {
  const copy = COPY[locale];
  const policy = copy[kind];
  const originalPath = kind === 'privacy' ? '/privacy' : '/terms';

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
        <header className="mb-10">
          <Link href={`/${locale}`} className="text-sm text-muted-foreground hover:text-lime-500">
            ← {copy.home}
          </Link>
          <h1 className="mt-4 text-3xl font-black tracking-tight lg:text-4xl">{policy.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{policy.updated}</p>
          <div className="mt-5 rounded-xl border border-amber-300/40 bg-amber-100/40 p-4 text-sm leading-relaxed dark:bg-amber-300/5">
            <p>{copy.convenience}</p>
            <Link
              href={originalPath}
              hrefLang="ko"
              className="mt-2 inline-block font-bold underline"
            >
              {copy.original}
            </Link>
          </div>
        </header>
        <article className="space-y-9 leading-relaxed">
          {policy.sections.map(([title, body]) => (
            <section key={title}>
              <h2 className="mb-3 text-xl font-bold">{title}</h2>
              <p className="text-foreground/80">{body}</p>
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
