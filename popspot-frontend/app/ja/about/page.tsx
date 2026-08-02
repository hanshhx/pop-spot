import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'POP-SPOTの安全対策',
  description:
    'アカウント、個人情報、暗号化通信、掲載情報の申請に関する7つの安全対策をご案内します。',
  alternates: {
    canonical: 'https://popspot.co.kr/ja/about',
    languages: {
      ko: 'https://popspot.co.kr/about',
      en: 'https://popspot.co.kr/en/about',
      ja: 'https://popspot.co.kr/ja/about',
    },
  },
};
export { default } from '../../about/page';
