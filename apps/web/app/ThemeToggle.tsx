"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

/** Flips between the brutalism light and dark themes. Styled to match the dark
 *  header chrome (acid outline + acid text) so it stays readable in both themes;
 *  renders a stable label until mounted to avoid a hydration mismatch. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      aria-label="Toggle light and dark theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="border-2 border-[color:var(--b-acid)] px-3 py-1.5 text-[13px] font-extrabold uppercase tracking-wide text-[color:var(--b-acid)] hover:bg-[color:var(--b-acid)] hover:text-[color:var(--b-acid-ink)]"
    >
      {mounted ? (isDark ? "Light" : "Dark") : "Theme"}
    </button>
  );
}
