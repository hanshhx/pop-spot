import { describe, expect, it } from 'vitest';

import { contextualMoreItem } from './BottomDock';

describe('contextualMoreItem', () => {
  it('keeps the regular More item on primary tabs', () => {
    expect(contextualMoreItem('MAP')).toBeNull();
    expect(contextualMoreItem('MY')).toBeNull();
  });

  it('shows the active secondary feature in the final dock slot', () => {
    expect(contextualMoreItem('MUSIC')?.key).toBe('MUSIC');
    expect(contextualMoreItem('PASSPORT')?.key).toBe('PASSPORT');
  });
});
