// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/popup/4093',
  useSearchParams: () => new URLSearchParams('from=search'),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/i18n', () => ({
  LOCALES: [
    { code: 'ko', label: '한국어' },
    { code: 'en', label: 'English' },
    { code: 'ja', label: '日本語' },
  ],
  useLocale: () => ({ setLocale: vi.fn() }),
}));

import LocaleSwitcher from './LocaleSwitcher';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('LocaleSwitcher', () => {
  it('renders the mobile menu outside a clipping parent and keeps the current query', async () => {
    const clippedParent = document.createElement('div');
    clippedParent.style.overflow = 'hidden';
    document.body.appendChild(clippedParent);
    const root = createRoot(clippedParent);

    await act(async () => {
      root.render(<LocaleSwitcher locale="ko" />);
    });

    const button = clippedParent.querySelector<HTMLButtonElement>('button[aria-label="Language"]');
    expect(button).not.toBeNull();

    await act(async () => {
      button?.click();
    });

    const menu = document.body.querySelector<HTMLElement>('[role="menu"]');
    expect(menu).not.toBeNull();
    expect(clippedParent.contains(menu)).toBe(false);

    const englishLink = menu?.querySelector<HTMLAnchorElement>('a[href^="/en/"]');
    expect(englishLink?.getAttribute('href')).toBe('/en/popup/4093?from=search');

    await act(async () => {
      root.unmount();
    });
  });
});
