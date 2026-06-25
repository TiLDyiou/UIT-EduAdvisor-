"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggle = () => {
    if (theme === "dark") {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setTheme("light");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setTheme("dark");
    }
  };

  return (
    <button
      onClick={toggle}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-tokyo-border/40 bg-tokyo-night text-tokyo-variable hover:bg-tokyo-storm hover:text-tokyo-cyan transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm focus:outline-none"
      title={theme === "dark" ? "Chuyển sang Chế độ Sáng" : "Chuyển sang Chế độ Tối"}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4 text-tokyo-yellow transition-transform duration-500 hover:rotate-45" />
      ) : (
        <Moon className="h-4 w-4 text-tokyo-blue transition-transform duration-500 hover:-rotate-12" />
      )}
    </button>
  );
}
