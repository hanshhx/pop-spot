import type { Metadata } from 'next';
import { MapPageForLocale } from '../../map/page';

const title = 'Seoul Pop-up Store Map';
const description =
  'Find active pop-up stores across Seoul on one map, with dates and closing days. Free and no sign-in required.';
export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: 'https://popspot.co.kr/en/map',
    languages: {
      ko: 'https://popspot.co.kr/map',
      en: 'https://popspot.co.kr/en/map',
      ja: 'https://popspot.co.kr/ja/map',
    },
  },
  openGraph: { title, description, url: 'https://popspot.co.kr/en/map' },
};

export default function EnglishMapPage() {
  return <MapPageForLocale locale="en" />;
}
