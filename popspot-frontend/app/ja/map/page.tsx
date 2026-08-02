import type { Metadata } from 'next';
import { MapPageForLocale } from '../../map/page';

const title = 'ソウルのポップアップストア地図';
const description =
  'ソウルで開催中のポップアップストアを地図で確認。開催期間と終了日も、ログインなしで無料で見られます。';
export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: 'https://popspot.co.kr/ja/map',
    languages: {
      ko: 'https://popspot.co.kr/map',
      en: 'https://popspot.co.kr/en/map',
      ja: 'https://popspot.co.kr/ja/map',
    },
  },
  openGraph: { title, description, url: 'https://popspot.co.kr/ja/map' },
};

export default function JapaneseMapPage() {
  return <MapPageForLocale locale="ja" />;
}
