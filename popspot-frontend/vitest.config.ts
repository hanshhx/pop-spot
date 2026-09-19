import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      /*
       * tsconfig 의 paths 와 <b>같은 두 줄</b>이어야 한다. 한쪽에만 있으면 타입체크는 통과하는데
       * 테스트만 "Cannot find package" 로 죽는다 — 2026-09-19 에 실제로 그랬다.
       *
       * '@/app' 이 '@' 보다 <b>먼저</b> 와야 한다. 앞에서부터 맞춰 보므로 순서가 바뀌면
       * '@/app/x' 가 'src/app/x' 로 잘못 풀린다.
       */
      '@/app': fileURLToPath(new URL('./app', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
