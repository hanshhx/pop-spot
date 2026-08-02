import type { Metadata } from 'next';
import LocalizedPolicyPage from '@/components/legal/LocalizedPolicyPage';

export const metadata: Metadata = {
  title: 'プライバシーポリシー',
  description: 'POP-SPOTにおける個人情報の収集・利用・保管・削除についてご案内します。',
  alternates: {
    canonical: 'https://popspot.co.kr/ja/privacy',
    languages: {
      'ko-KR': 'https://popspot.co.kr/privacy',
      en: 'https://popspot.co.kr/en/privacy',
      'ja-JP': 'https://popspot.co.kr/ja/privacy',
      'x-default': 'https://popspot.co.kr/privacy',
    },
  },
};

export default function JapanesePrivacyPage() {
  return <LocalizedPolicyPage locale="ja" kind="privacy" />;
}
