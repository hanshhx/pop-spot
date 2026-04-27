import type { Config } from "tailwindcss";

/**
 * Tailwind v4 에서는 색상/폰트/radius 토큰을 globals.css 의 @theme 블록에서 관리합니다.
 * 이 파일은 (1) content scan 경로 (2) darkMode 설정만 담당합니다.
 *
 * 새 토큰을 추가/수정하려면 → app/globals.css 의 @theme 블록을 수정하세요.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
