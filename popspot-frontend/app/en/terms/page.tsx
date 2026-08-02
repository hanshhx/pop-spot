import type { Metadata } from 'next';
import LocalizedPolicyPage from '@/components/legal/LocalizedPolicyPage';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'POP-SPOT terms for listings, source links, reports, external sites and member content.',
  alternates: {
    canonical: 'https://popspot.co.kr/en/terms',
    languages: {
      'ko-KR': 'https://popspot.co.kr/terms',
      en: 'https://popspot.co.kr/en/terms',
      'ja-JP': 'https://popspot.co.kr/ja/terms',
      'x-default': 'https://popspot.co.kr/terms',
    },
  },
};

export default function EnglishTermsPage() {
  return <LocalizedPolicyPage locale="en" kind="terms" />;
}
