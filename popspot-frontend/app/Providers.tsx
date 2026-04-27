"use client";

import { ThemeProvider } from "next-themes";
import React, { useState, useEffect } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    // [중요] attribute="class"가 있어야 html 태그에 class="dark"가 붙습니다.
    // enableSystem={false}로 하면 시스템 설정 무시하고 버튼으로만 조절됩니다 (선택사항)
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  );
}