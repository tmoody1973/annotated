"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@heroui/react";

/** Flips between the brutalism light and dark themes. Renders a stable label
 *  until mounted to avoid a hydration mismatch (next-themes resolves on client). */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  return (
    <Button
      variant="outline"
      size="sm"
      aria-label="Toggle light and dark theme"
      onPress={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted ? (isDark ? "Light" : "Dark") : "Theme"}
    </Button>
  );
}
