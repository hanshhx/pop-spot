// @vitest-environment jsdom

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LocaleSwitcher from './LocaleSwitcher';

vi.mock('next/navigation', () => ({
  usePathname: () => '/popup/4093',
  useSearchParams: () => new URLSearchParams('from=search'),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe('LocaleSwitcher 모바일 메뉴', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.overflow = 'hidden';
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.querySelectorAll('[role="menu"]').forEach((menu) => menu.remove());
  });

  it('잘리는 상세 사진 영역 밖에 메뉴를 열고 같은 상세의 번역 주소로 이동한다', async () => {
    await act(async () => root.render(<LocaleSwitcher locale="ko" />));

    const button = container.querySelector<HTMLButtonElement>('button[aria-label="Language"]');
    expect(button).not.toBeNull();

    await act(async () => button?.click());

    const menu = document.body.querySelector<HTMLElement>('[role="menu"]');
    expect(menu).not.toBeNull();
    expect(container.contains(menu)).toBe(false);

    const english = Array.from(menu?.querySelectorAll('a') ?? []).find(
      (link) => link.textContent?.trim() === 'English',
    );
    expect(english?.getAttribute('href')).toBe('/en/popup/4093?from=search');
  });
});
