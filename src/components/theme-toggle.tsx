"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  const isDark = resolvedTheme === "dark";

  const toggle = () => setTheme(isDark ? "light" : "dark");

  return (
    <button
      onClick={toggle}
      className="rounded-md p-2 hover:bg-neutral-800 text-neutral-300"
      aria-label="Toggle theme"
    >
      {isDark ? <SunIcon className="size-5" /> : <MoonIcon className="size-5" />}
    </button>
  );
}


