"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";

/**
 * Theme switching. The brutalism overrides are applied always-on via a static
 * `brutalism-light` class on <html> (layout.tsx); next-themes only toggles the
 * base palette class — `light` (from :root) or `dark` (the base .dark block) —
 * as single tokens (a multi-token value would break DOMTokenList).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      value={{ light: "light", dark: "dark" }}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
