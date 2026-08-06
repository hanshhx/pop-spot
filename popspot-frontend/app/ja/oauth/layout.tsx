import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ログイン処理',
  robots: { index: false, follow: false },
};

export default function PrivateRouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
