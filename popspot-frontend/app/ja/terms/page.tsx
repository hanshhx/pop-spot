import type { Metadata } from 'next';
import LocalizedPolicyPage from '@/components/legal/LocalizedPolicyPage';

export const metadata: Metadata = {
  title: '利用規約',
  description: '掲載情報、出典、通報、外部サイト、会員投稿に関するPOP-SPOTの利用規約です。',
  alternates: {
    canonical: 'https://popspot.co.kr/ja/terms',
    languages: {
      'ko-KR': 'https://popspot.co.kr/terms',
      en: 'https://popspot.co.kr/en/terms',
      'ja-JP': 'https://popspot.co.kr/ja/terms',
      'x-default': 'https://popspot.co.kr/terms',
    },
  },
};

export default function JapaneseTermsPage() {
  return <LocalizedPolicyPage locale="ja" kind="terms" />;
}
