import type { ReactNode } from 'react';

import { SiteChrome } from '@/components/layout/SiteChrome';

/** 근거는 한국어판(app/popups/layout.tsx) 주석에 있다. 세 언어가 같은 껍데기를 쓴다. */
export default function JaPopupsLandingLayout({ children }: { children: ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
