import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

/**
 * ESLint 설정 — Next.js 권장 + TypeScript + Clean Code 보강.
 *
 * 추가 규칙:
 *  - import 정렬 / 그룹화 (가독성)
 *  - 사용 안 하는 변수 / import 경고
 *  - React Hook 의존성 배열 누락 경고 (next-vitals 가 이미 잡지만 명시)
 *  - any 사용 경고 (단, 외부 라이브러리 어쩔 수 없는 경우는 inline disable)
 *
 * Prettier 와의 책임 분담:
 *  - 포맷 (들여쓰기, 줄바꿈, 따옴표) → Prettier
 *  - 정적 분석 (사용 안 하는 변수, 잘못된 hook 사용) → ESLint
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      // 사용 안 하는 변수 / import — error 가 아닌 warn 으로 (개발 흐름 방해 최소화)
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // any 는 경고만 (Kakao Map SDK 등 외부 d.ts 가 부족한 경우 회피용)
      '@typescript-eslint/no-explicit-any': 'warn',

      // console.log 경고 (운영 코드에서 빠뜨리기 쉬움). console.warn / console.error 는 허용
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],

      // React hook 의존성 누락 명시
      'react-hooks/exhaustive-deps': 'warn',

      // === 안 쓰는 표현식 / 빈 함수 ===
      '@typescript-eslint/no-empty-function': 'warn',
      'no-empty-pattern': 'warn',
    },
  },

  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'node_modules/**',
    'public/**',
    '*.config.{js,mjs,ts}',
  ]),
]);

export default eslintConfig;
