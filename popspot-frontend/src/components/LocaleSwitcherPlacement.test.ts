import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const detailPage = readFileSync(
  join(process.cwd(), 'app/popup/[id]/PopupDetailClient.tsx'),
  'utf8',
);
const seoLandingPage = readFileSync(join(process.cwd(), 'app/popups/[slug]/page.tsx'), 'utf8');

describe('language menu placement', () => {
  it('keeps the language menu mounted on popup detail pages', () => {
    expect(detailPage).toContain('<LocaleSwitcher locale={locale}');
  });

  it('keeps the language menu mounted behind Suspense on SEO landing pages', () => {
    expect(seoLandingPage).toMatch(
      /<Suspense[\s\S]*?<LocaleSwitcher locale=\{locale\}[\s\S]*?<\/Suspense>/,
    );
  });
});
