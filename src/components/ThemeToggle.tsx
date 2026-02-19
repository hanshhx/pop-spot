"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-3 rounded-full transition-all duration-300 shadow-lg border backdrop-blur-md
                 bg-white/50 border-gray-200 text-gray-800 hover:bg-white
                 dark:bg-black/30 dark:border-white/10 dark:text-white dark:hover:bg-white/20"
      aria-label="Toggle Dark Mode"
    >
      {theme === "dark" ? <Sun size={24} /> : <Moon size={24} />}
    </button>
  );
}