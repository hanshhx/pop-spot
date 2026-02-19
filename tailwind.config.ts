import type { Config } from "tailwindcss";

const config: Config = {
  // [필수] 버튼으로 다크모드 제어
  darkMode: "class", 

  content: [
    // [매우 중요] 사용자님 폴더 구조에 맞춰 경로 수정
    "./app/**/*.{js,ts,jsx,tsx,mdx}",        // 루트에 있는 app 폴더 (여기에 메인 페이지 있음)
    "./src/**/*.{js,ts,jsx,tsx,mdx}",        // src 안에 있는 components 폴더
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",      // 혹시 모를 대비
    "./components/**/*.{js,ts,jsx,tsx,mdx}", // 혹시 모를 대비
  ],
  theme: {
    extend: {
      colors: {
        primary: "#00ff88",
        secondary: "#ff0088",
        background: "#000000",
        surface: "#111111",
        text: "#ffffff",
        muted: "#888888",
      },
    },
  },
  plugins: [],
};
export default config;