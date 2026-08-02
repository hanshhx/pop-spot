import { describe, expect, it } from 'vitest';
import { localeFromPath, localizedPath } from './localePath';

describe('언어별 주소', () => {
  it('현재 기능 경로와 쿼리를 유지한 채 언어만 바꾼다', () => {
    expect(localizedPath('/en/popups/seongsu?sort=deadline', 'ja')).toBe(
      '/ja/popups/seongsu?sort=deadline',
    );
    expect(localizedPath('/ja/popup/12', 'ko')).toBe('/popup/12');
  });

  it('언어별 홈은 중복 슬래시 없이 만든다', () => {
    expect(localizedPath('/', 'en')).toBe('/en');
    expect(localizedPath('/ja', 'en')).toBe('/en');
  });

  it('API·관리자·외부 주소는 바꾸지 않는다', () => {
    expect(localizedPath('/api/popups', 'ja')).toBe('/api/popups');
    expect(localizedPath('/admin/security', 'en')).toBe('/admin/security');
    expect(localizedPath('https://example.com', 'en')).toBe('https://example.com');
  });

  it('주소에서 언어를 판별한다', () => {
    expect(localeFromPath('/en/popup/1')).toBe('en');
    expect(localeFromPath('/ja')).toBe('ja');
    expect(localeFromPath('/popup/1')).toBe('ko');
  });
});

