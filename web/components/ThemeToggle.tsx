"use client";

import { useTheme } from "@/components/ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={isDark ? "Activer le mode jour" : "Activer le mode nuit"}
      title={isDark ? "Mode jour" : "Mode nuit"}
    >
      <span className="theme-toggle-icon" aria-hidden>
        {isDark ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
