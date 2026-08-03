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
      updated: 'Effective August 10, 2026',
      sections: [
        [
          'Information we collect',
          'Email, encrypted password, nickname and Korean mobile number for email sign-up; profile details supplied by Google, Kakao or Naver for social login; the accepted Terms and Privacy Policy versions, consent time and confirmation that the user is at least 14; service activity such as saved pop-ups, stamps and played tracks; anonymous visit ID, page path, browser/device details and visit time. POP-SPOT does not collect a birth date or gender, and visitor analytics do not store an IP address or member profile.',
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
          'POP-SPOT uses Google, Kakao, Naver, SK Telecom TMAP, PortOne, Vercel, Sentry, Groq, Spotify, Pexels, Apple, GitHub and FOSSGIS for login, search, payment, hosting, monitoring, music, images, map labels and route calculation. Only the information required for each task is sent. TMAP and OSRM receive start and destination coordinates only when a route is requested. The backend, database and uploaded files are stored on a dedicated server in South Korea.',
        ],
        [
          'Your choices and rights',
          'You may view, correct or delete your information, withdraw consent, close your account, revoke optional external-video consent in this policy page, or ask how your information is handled. Contact the address below.',
        ],
        ['Contact', 'Privacy officer: Kim Donghyun · reo4321@naver.com'],
      ],
    },
    terms: {
      title: 'Terms of Service',
      updated: 'Last revised August 3, 2026 · Effective August 10, 2026',
      sections: [
        [
          'Pop-up information',
          'Listings may be registered by the operator, submitted by users, or organized from public Naver and Kakao search results. Automatically collected listings show their original source. POP-SPOT does not guarantee that dates, locations or availability are complete or current.',
        ],
        [
          'Original sources and copyright',
          'POP-SPOT does not directly fetch or reproduce the body of source articles. It organizes only the title, summary, link and publication date supplied by the search APIs. Use the source link on a pop-up detail page to check the original. Rights holders may request a correction or removal.',
        ],
        [
          'Reports and removal',
          'A report enters an administrator review queue and is normally reviewed within 24 hours. A listing may be hidden during review only when a clear rights violation or urgent harm is confirmed. Permanent deletion requires review to prevent abusive reports.',
        ],
        [
          'External websites and reservations',
          'Official and reservation buttons open a third-party website. POP-SPOT does not control that site, its inventory, purchases, refunds or privacy practices.',
        ],
        [
          'External music and video',
          'Music and video features may use Spotify, Apple iTunes and YouTube. Available tracks link back to their original service. YouTube content is connected only after consent, and the provider’s own terms and privacy policy apply.',
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
      updated: '施行日：2026年8月10日',
      sections: [
        [
          '収集する情報',
          'メール登録ではメールアドレス、暗号化されたパスワード、ニックネーム、韓国の携帯電話番号を収集します。ソーシャルログインではGoogle・Kakao・Naverが提供するプロフィール情報を受け取ります。利用規約・プライバシーポリシーの同意版、同意時刻、14歳以上の確認、保存したポップアップ、スタンプ、再生した曲などの利用記録も含まれます。生年月日と性別は収集せず、訪問統計にはIPアドレスや会員プロフィールを保存しません。',
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
          'ログイン、検索、決済、ホスティング、監視、音楽、画像、地図表示、経路計算のためGoogle、Kakao、Naver、SK Telecom TMAP、PortOne、Vercel、Sentry、Groq、Spotify、Pexels、Apple、GitHub、FOSSGISを利用します。必要な情報だけを送信し、TMAPとOSRMには経路を求めた時だけ出発・到着座標を送ります。バックエンド、データベース、アップロードされたファイルは韓国内の専用サーバーに保存します。',
        ],
        [
          '利用者の権利',
          '情報の確認・訂正・削除、同意の撤回、退会、このページでの任意の外部動画接続同意の撤回、処理内容の問い合わせができます。下記の連絡先をご利用ください。',
        ],
        ['連絡先', '個人情報保護責任者：Kim Donghyun · reo4321@naver.com'],
      ],
    },
    terms: {
      title: '利用規約',
      updated: '最終改定日：2026年8月3日 · 施行日：2026年8月10日',
      sections: [
        [
          'ポップアップ情報',
          '掲載情報は運営者による登録、利用者からの投稿、Naver・Kakaoの公開検索結果を整理したものを含みます。自動収集された情報には原文の出典を表示します。日程・場所・開催状況の完全性や最新性は保証しません。',
        ],
        [
          '原文と著作権',
          '出典記事の本文を直接取得・複製せず、検索APIが提供するタイトル、要約、リンク、掲載日だけを整理します。詳細ページの出典リンクから原文をご確認ください。権利者は修正・削除を依頼できます。',
        ],
        [
          '通報と削除',
          '通報は管理者の確認待ちとして記録され、通常24時間以内に確認します。明白な権利侵害または緊急の被害が確認された場合に限り、確認中は一時的に非表示にします。悪用防止のため、完全削除は確認後に行います。',
        ],
        [
          '外部サイトと予約',
          '公式サイト・予約ボタンは外部サイトへ移動します。POP-SPOTは外部サイトの在庫、購入、返金、個人情報処理を管理しません。',
        ],
        [
          '外部の音楽・動画',
          '音楽・動画機能ではSpotify、Apple iTunes、YouTubeを利用する場合があります。利用できる曲には元サービスへのリンクを表示します。YouTubeは同意後にのみ接続され、各提供者の利用規約とプライバシーポリシーが適用されます。',
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
