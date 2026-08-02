import type { Metadata } from 'next';
import LocalizedPolicyPage from '@/components/legal/LocalizedPolicyPage';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How POP-SPOT collects, uses, stores and deletes personal information.',
  alternates: {
    canonical: 'https://popspot.co.kr/en/privacy',
    languages: {
      'ko-KR': 'https://popspot.co.kr/privacy',
      en: 'https://popspot.co.kr/en/privacy',
      'ja-JP': 'https://popspot.co.kr/ja/privacy',
      'x-default': 'https://popspot.co.kr/privacy',
    },
  },
};

export default function EnglishPrivacyPage() {
  return <LocalizedPolicyPage locale="en" kind="privacy" />;
}
