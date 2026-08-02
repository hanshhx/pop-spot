import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'How POP-SPOT protects visitors',
  description:
    'Seven safeguards used by POP-SPOT for accounts, privacy, encrypted connections and content reports.',
  alternates: {
    canonical: 'https://popspot.co.kr/en/about',
    languages: {
      ko: 'https://popspot.co.kr/about',
      en: 'https://popspot.co.kr/en/about',
      ja: 'https://popspot.co.kr/ja/about',
    },
  },
};
export { default } from '../../about/page';
